// 「発電王」サーバー（1対1×最大10卓の並行対戦）
// 教員PCで起動し、全対戦の状態を一元管理する。
// - 各対戦は2人のプレイヤー（Chromebook）が自分のペースで進行できる
// - 両者が提出した時点で自動判定
// - 教員のモニター画面では全対戦の進行状況を一覧できる
// - 状態はファイルにも保存し、サーバーを再起動しても復元できる

import express from 'express';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { EVENT_CARDS, MISSION_CARDS, PLANT_CARDS } from '../shared/data';
import { isBanned, judgeMatch } from '../shared/engine';
import type {
  ClientToServer,
  GameState,
  MatchState,
  PlayerSlot,
  Seat,
  ServerToClient,
} from '../shared/types';

const PORT = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');
const DATA_DIR = path.resolve(__dirname, '../.data');
const SAVE_FILE = path.join(DATA_DIR, 'game.json');

const MAX_MATCHES = 10;

// ---- 状態 ----

interface MatchInternal {
  missionDeck: string[];
  eventDeck: string[];
}

interface FullState {
  state: GameState;
  internals: MatchInternal[]; // 各対戦の山札（対戦番号-1がインデックス）
}

const newSlot = (seat: Seat): PlayerSlot => ({
  seat,
  name: `プレイヤー${seat}`,
  claimed: false,
  connected: 0,
  submission: null,
  score: 0,
  wins: 0,
  clears: 0,
});

const newMatch = (id: number): MatchState => ({
  id,
  phase: 'waiting',
  round: 0,
  players: [newSlot('A'), newSlot('B')],
  mission: null,
  event: null,
  results: null,
  missionDeckLeft: MISSION_CARDS.length,
  eventDeckLeft: EVENT_CARDS.length,
});

const newInternal = (): MatchInternal => ({
  missionDeck: MISSION_CARDS.map((m) => m.id),
  eventDeck: EVENT_CARDS.map((e) => e.id),
});

const freshState = (matchCount = MAX_MATCHES, totalRounds = 3): FullState => ({
  state: {
    started: false,
    matchCount,
    totalRounds,
    matches: Array.from({ length: matchCount }, (_, i) => newMatch(i + 1)),
  },
  internals: Array.from({ length: matchCount }, newInternal),
});

let full: FullState = loadState() ?? freshState();

function loadState(): FullState | null {
  try {
    if (existsSync(SAVE_FILE)) {
      const loaded = JSON.parse(readFileSync(SAVE_FILE, 'utf8')) as FullState;
      for (const m of loaded.state.matches) m.players.forEach((p) => (p.connected = 0));
      return loaded;
    }
  } catch (e) {
    console.warn('保存データの読み込みに失敗したため新規状態で開始します:', e);
  }
  return null;
}

function saveState(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(SAVE_FILE, JSON.stringify(full));
  } catch (e) {
    console.warn('状態の保存に失敗:', e);
  }
}

function drawRandom(deck: string[]): string | null {
  if (deck.length === 0) return null;
  const i = Math.floor(Math.random() * deck.length);
  return deck.splice(i, 1)[0];
}

// ---- サーバー本体 ----

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer, {
  cors: { origin: '*' }, // 教室内LANのみで使う前提
});

function lanUrls(): string[] {
  const urls: string[] = [];
  for (const infos of Object.values(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal) {
        urls.push(`http://${info.address}:${PORT}`);
      }
    }
  }
  return urls.length > 0 ? urls : [`http://localhost:${PORT}`];
}

app.get('/api/info', (_req, res) => {
  res.json({ urls: lanUrls() });
});

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

function broadcast(): void {
  for (let i = 0; i < full.state.matches.length; i++) {
    full.state.matches[i].missionDeckLeft = full.internals[i].missionDeck.length;
    full.state.matches[i].eventDeckLeft = full.internals[i].eventDeck.length;
  }
  io.emit('state', full.state);
  saveState();
}

function runJudge(match: MatchState): void {
  if (!match.mission || !match.event) return;
  const entries = match.players.map((p) => ({
    seat: p.seat,
    playerName: p.name,
    cardIds: p.submission?.cardIds ?? [],
    optionalOn: p.submission?.optionalOn ?? [],
  }));
  const results = judgeMatch(match.mission, match.event, entries, PLANT_CARDS);
  for (const r of results) {
    const p = match.players.find((p) => p.seat === r.seat)!;
    p.score += r.points;
    if (r.cleared) p.clears += 1;
    if (r.winner) p.wins += 1;
  }
  match.results = results;
  match.phase = 'judged';
}

io.on('connection', (socket) => {
  let myMatchId: number | null = null;
  let mySeat: Seat | null = null;

  socket.emit('state', full.state);
  const fail = (msg: string) => socket.emit('errorMessage', msg);

  const myMatch = (): { match: MatchState; internal: MatchInternal; me: PlayerSlot } | null => {
    if (myMatchId === null || mySeat === null) return null;
    const idx = full.state.matches.findIndex((m) => m.id === myMatchId);
    if (idx < 0) return null;
    const match = full.state.matches[idx];
    const me = match.players.find((p) => p.seat === mySeat)!;
    return { match, internal: full.internals[idx], me };
  };

  // ---- 教員（モニター）操作 ----

  socket.on('host:setup', ({ matchCount, totalRounds }) => {
    const n = Math.max(1, Math.min(MAX_MATCHES, Math.floor(matchCount)));
    const rounds = Math.max(1, Math.min(5, Math.floor(totalRounds)));
    full = freshState(n, rounds);
    full.state.started = true;
    broadcast();
  });

  socket.on('host:reset', () => {
    full = freshState(full.state.matchCount, full.state.totalRounds);
    broadcast();
  });

  // ---- プレイヤー操作 ----

  socket.on('player:join', ({ matchId, seat, name }) => {
    if (!full.state.started) return fail('先生がゲームを開始するまで待ってね');
    const match = full.state.matches.find((m) => m.id === matchId);
    if (!match) return fail('その対戦はありません');
    const slot = match.players.find((p) => p.seat === seat);
    if (!slot) return fail('その席はありません');

    // 前にいた席から抜ける
    const prev = myMatch();
    if (prev) prev.me.connected = Math.max(0, prev.me.connected - 1);

    myMatchId = matchId;
    mySeat = seat;
    slot.claimed = true;
    slot.connected += 1;
    if (name && name.trim()) slot.name = name.trim().slice(0, 12);

    // 両席が埋まったら対戦開始
    if (match.phase === 'waiting' && match.players.every((p) => p.claimed)) {
      match.phase = 'play';
      match.round = 1;
    }
    broadcast();
  });

  socket.on('player:reveal', (which) => {
    const ctx = myMatch();
    if (!ctx) return fail('先に対戦に参加してください');
    const { match, internal } = ctx;
    if (match.phase !== 'play') return fail('今はめくれません');

    if (which === 'mission') {
      if (match.mission) return; // すでにめくられている（相打ち防止）
      const id = drawRandom(internal.missionDeck);
      if (!id) return fail('ミッションの山札が空です');
      match.mission = MISSION_CARDS.find((m) => m.id === id)!;
    } else {
      if (match.event) return;
      const id = drawRandom(internal.eventDeck);
      if (!id) return fail('イベントの山札が空です');
      match.event = EVENT_CARDS.find((e) => e.id === id)!;
    }
    broadcast();
  });

  socket.on('player:submit', ({ cardIds, optionalOn }) => {
    const ctx = myMatch();
    if (!ctx) return fail('先に対戦に参加してください');
    const { match, me } = ctx;
    if (match.phase !== 'play') return fail('今は提出できません');
    if (!match.mission || !match.event) return fail('先にミッションとイベントをめくってください');

    const unique = [...new Set(cardIds)]
      .map((id) => PLANT_CARDS.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => !!c);
    if (unique.length === 0) return fail('カードを1枚以上選んでください');
    if (unique.length > 3) return fail('場に出せるのは最大3枚までです');
    const banned = unique.find((c) => isBanned(c, match.mission));
    if (banned) return fail(`「${banned.name}」はこのミッションでは場に出せません`);

    const ids = unique.map((c) => c.id);
    me.submission = {
      cardIds: ids,
      optionalOn: [...new Set(optionalOn)].filter((id) => ids.includes(id)),
      submittedAt: Date.now(),
    };

    // 両者提出で自動判定
    if (match.players.every((p) => p.submission)) {
      runJudge(match);
    }
    broadcast();
  });

  socket.on('player:retract', () => {
    const ctx = myMatch();
    if (!ctx) return;
    const { match, me } = ctx;
    if (match.phase !== 'play') return fail('判定後は取り下げできません');
    me.submission = null;
    broadcast();
  });

  socket.on('player:next', () => {
    const ctx = myMatch();
    if (!ctx) return;
    const { match } = ctx;
    if (match.phase !== 'judged') return;
    if (match.round >= full.state.totalRounds) {
      match.phase = 'finished';
    } else {
      match.round += 1;
      match.phase = 'play';
      match.mission = null;
      match.event = null;
      match.results = null;
      match.players.forEach((p) => (p.submission = null)); // 場は毎ラウンドリセット
    }
    broadcast();
  });

  socket.on('disconnect', () => {
    const ctx = myMatch();
    if (ctx) {
      ctx.me.connected = Math.max(0, ctx.me.connected - 1);
      broadcast();
    }
  });
});

httpServer.listen(PORT, () => {
  console.log('「発電王」サーバー起動！（1対1×最大10卓）');
  console.log('Chromebookからは次のURLへアクセス:');
  for (const url of lanUrls()) console.log(`  ${url}`);
});
