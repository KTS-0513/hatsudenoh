// 「発電王」サーバー（1対1×最大10卓・ポーカー風）
// 教員PCまたはRender上で起動し、全対戦の状態を一元管理する。
// - 各対戦は2人（席A/B）。両者そろうと手札6枚を配り、山札8枚を場に残す
// - ミッション/イベントを公開 → 1回だけ最大4枚マリガン → ベスト3枚を提出 → 自動採点
// - 手札は各プレイヤーの端末にだけ配信（相手・先生には見えない）
// - 先生モニターは全対戦の状況（提出済み・スコア）をリアルタイムに見られる

import express from 'express';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { EVENT_CARDS, MISSION_CARDS, PLANT_CARDS } from '../shared/data';
import { judgeMatch } from '../shared/engine';
import type {
  ClientToServer,
  EventCard,
  GameState,
  MatchState,
  MissionCard,
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
const HAND_SIZE = 6; // 配る手札の枚数
const PLAY_SIZE = 3; // 場に出せる枚数
const MULLIGAN_MAX = 4; // 手札交換の上限

// ---- 状態 ----

interface MatchInternal {
  missionDeck: string[];
  eventDeck: string[];
  gameDeck: string[]; // 手札を配った後の山札（8枚）
  hands: Record<Seat, string[]>; // 各プレイヤーの手札（非公開）
}

interface FullState {
  state: GameState;
  internals: MatchInternal[]; // 各対戦（対戦番号-1がインデックス）
}

const newSlot = (seat: Seat): PlayerSlot => ({
  seat,
  name: `プレイヤー${seat}`,
  claimed: false,
  connected: 0,
  submission: null,
  handSize: 0,
  mulliganUsed: false,
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
  deckLeft: 0,
  missionDeckLeft: MISSION_CARDS.length,
  eventDeckLeft: EVENT_CARDS.length,
});

const newInternal = (): MatchInternal => ({
  missionDeck: MISSION_CARDS.map((m) => m.id),
  eventDeck: EVENT_CARDS.map((e) => e.id),
  gameDeck: [],
  hands: { A: [], B: [] },
});

const freshState = (matchCount = MAX_MATCHES, totalRounds = 3, withEvents = true): FullState => ({
  state: {
    started: false,
    matchCount,
    totalRounds,
    withEvents,
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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function drawRandom(deck: string[]): string | null {
  if (deck.length === 0) return null;
  const i = Math.floor(Math.random() * deck.length);
  return deck.splice(i, 1)[0];
}

/** 対戦開始時に20枚をシャッフルして手札6+6と山札8に分ける */
function dealHands(match: MatchState, internal: MatchInternal): void {
  const shuffled = shuffle(PLANT_CARDS.map((c) => c.id));
  internal.hands.A = shuffled.slice(0, HAND_SIZE);
  internal.hands.B = shuffled.slice(HAND_SIZE, HAND_SIZE * 2);
  internal.gameDeck = shuffled.slice(HAND_SIZE * 2);
  for (const p of match.players) {
    p.handSize = internal.hands[p.seat].length;
    p.mulliganUsed = false;
    p.submission = null;
  }
  match.deckLeft = internal.gameDeck.length;
}

// ---- サーバー本体 ----

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer, {
  cors: { origin: '*' },
});

// socket.id → どの対戦のどの席か（手札を本人だけに配るために使う）
const seats = new Map<string, { matchId: number; seat: Seat }>();

function lanUrls(): string[] {
  const urls: string[] = [];
  for (const infos of Object.values(networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal) urls.push(`http://${info.address}:${PORT}`);
    }
  }
  return urls.length > 0 ? urls : [`http://localhost:${PORT}`];
}

app.get('/api/info', (_req, res) => res.json({ urls: lanUrls() }));

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

function internalOf(matchId: number): MatchInternal | null {
  const idx = full.state.matches.findIndex((m) => m.id === matchId);
  return idx < 0 ? null : full.internals[idx];
}

function broadcast(): void {
  for (let i = 0; i < full.state.matches.length; i++) {
    full.state.matches[i].missionDeckLeft = full.internals[i].missionDeck.length;
    full.state.matches[i].eventDeckLeft = full.internals[i].eventDeck.length;
    full.state.matches[i].deckLeft = full.internals[i].gameDeck.length;
  }
  io.emit('state', full.state);
  // 手札は各端末にだけ配る
  for (const [sid, { matchId, seat }] of seats) {
    const internal = internalOf(matchId);
    io.to(sid).emit('hand', internal ? internal.hands[seat] : []);
  }
  saveState();
}

function runJudge(match: MatchState): void {
  if (!match.mission) return; // イベントはやさしいモードでは無い（nullでOK）
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
    if (r.winner) p.wins += 1;
  }
  match.results = results;
  match.phase = 'judged';
}

io.on('connection', (socket) => {
  socket.emit('state', full.state);
  const fail = (msg: string) => socket.emit('errorMessage', msg);

  const ctx = () => {
    const s = seats.get(socket.id);
    if (!s) return null;
    const idx = full.state.matches.findIndex((m) => m.id === s.matchId);
    if (idx < 0) return null;
    return {
      match: full.state.matches[idx],
      internal: full.internals[idx],
      me: full.state.matches[idx].players.find((p) => p.seat === s.seat)!,
      seat: s.seat,
    };
  };

  // 接続直後などに、現在の状態（＋その席の手札）を送り直す（取りこぼし防止）
  socket.on('sync', () => {
    socket.emit('state', full.state);
    const s = seats.get(socket.id);
    if (s) {
      const internal = internalOf(s.matchId);
      socket.emit('hand', internal ? internal.hands[s.seat] : []);
    }
  });

  // ---- 教員（モニター）操作 ----
  socket.on('host:setup', ({ matchCount, totalRounds, withEvents }) => {
    const n = Math.max(1, Math.min(MAX_MATCHES, Math.floor(matchCount)));
    const rounds = Math.max(1, Math.min(5, Math.floor(totalRounds)));
    full = freshState(n, rounds, withEvents);
    full.state.started = true;
    seats.clear();
    broadcast();
  });

  socket.on('host:reset', () => {
    full = freshState(full.state.matchCount, full.state.totalRounds, full.state.withEvents);
    seats.clear();
    broadcast();
  });

  // ---- プレイヤー操作 ----
  socket.on('player:join', ({ matchId, seat, name }) => {
    if (!full.state.started) return fail('先生がゲームを開始するまで待ってね');
    const match = full.state.matches.find((m) => m.id === matchId);
    if (!match) return fail('その対戦はありません');
    const slot = match.players.find((p) => p.seat === seat);
    if (!slot) return fail('その席はありません');

    const prev = ctx();
    if (prev) prev.me.connected = Math.max(0, prev.me.connected - 1);

    seats.set(socket.id, { matchId, seat });
    slot.claimed = true;
    slot.connected += 1;
    if (name && name.trim()) slot.name = name.trim().slice(0, 12);

    // 両席が埋まったら対戦開始＋手札配布
    if (match.phase === 'waiting' && match.players.every((p) => p.claimed)) {
      const internal = internalOf(matchId)!;
      match.phase = 'play';
      match.round = 1;
      dealHands(match, internal);
    }
    broadcast();
  });

  socket.on('player:reveal', (which) => {
    const c = ctx();
    if (!c) return fail('先に対戦に参加してください');
    if (c.match.phase !== 'play') return fail('今はめくれません');
    if (which === 'mission') {
      if (c.match.mission) return;
      const id = drawRandom(c.internal.missionDeck);
      if (!id) return fail('ミッションの山札が空です');
      c.match.mission = MISSION_CARDS.find((m) => m.id === id) as MissionCard;
    } else {
      if (!full.state.withEvents) return; // やさしいモードはイベントなし
      if (c.match.event) return;
      const id = drawRandom(c.internal.eventDeck);
      if (!id) return fail('イベントの山札が空です');
      c.match.event = EVENT_CARDS.find((e) => e.id === id) as EventCard;
    }
    broadcast();
  });

  socket.on('player:mulligan', (cardIds) => {
    const c = ctx();
    if (!c) return fail('先に対戦に参加してください');
    if (c.match.phase !== 'play') return fail('今は手札交換できません');
    if (c.me.submission) return fail('提出後は手札交換できません');
    if (c.me.mulliganUsed) return fail('手札交換は1回だけです');

    const hand = c.internal.hands[c.seat];
    const toSwap = [...new Set(cardIds)].filter((id) => hand.includes(id));
    if (toSwap.length === 0) return fail('交換するカードを選んでください');
    if (toSwap.length > MULLIGAN_MAX) return fail(`手札交換は最大${MULLIGAN_MAX}枚までです`);

    // 交換枚数ぶん山札から引く（山札が足りなければ引ける分だけ）
    const draws: string[] = [];
    for (let i = 0; i < toSwap.length && c.internal.gameDeck.length > 0; i++) {
      draws.push(c.internal.gameDeck.shift()!);
    }
    const kept = hand.filter((id) => !toSwap.includes(id));
    // 実際に引けた枚数ぶんだけ交換（引けなかった分は手札に残す）
    const returned = toSwap.slice(draws.length);
    c.internal.hands[c.seat] = [...kept, ...returned, ...draws];
    // 交換で出したカードは山札の底へ戻す（デッキ切れ防止）
    c.internal.gameDeck.push(...toSwap.slice(0, draws.length));
    c.me.handSize = c.internal.hands[c.seat].length;
    c.me.mulliganUsed = true;
    broadcast();
  });

  socket.on('player:submit', ({ cardIds, optionalOn }) => {
    const c = ctx();
    if (!c) return fail('先に対戦に参加してください');
    if (c.match.phase !== 'play') return fail('今は提出できません');
    if (!c.match.mission) return fail('先にミッションをめくってください');
    if (full.state.withEvents && !c.match.event) return fail('先にイベントもめくってください');

    const hand = c.internal.hands[c.seat];
    const unique = [...new Set(cardIds)].filter((id) => hand.includes(id));
    if (unique.length === 0) return fail('手札からカードを選んでください');
    if (unique.length > PLAY_SIZE) return fail(`場に出せるのは最大${PLAY_SIZE}枚までです`);

    c.me.submission = {
      cardIds: unique,
      optionalOn: [...new Set(optionalOn)].filter((id) => unique.includes(id)),
      submittedAt: Date.now(),
    };
    if (c.match.players.every((p) => p.submission)) runJudge(c.match);
    broadcast();
  });

  socket.on('player:retract', () => {
    const c = ctx();
    if (!c) return;
    if (c.match.phase !== 'play') return fail('判定後は取り下げできません');
    c.me.submission = null;
    broadcast();
  });

  socket.on('player:next', () => {
    const c = ctx();
    if (!c) return;
    if (c.match.phase !== 'judged') return;
    if (c.match.round >= full.state.totalRounds) {
      c.match.phase = 'finished';
    } else {
      c.match.round += 1;
      c.match.phase = 'play';
      c.match.mission = null;
      c.match.event = null;
      c.match.results = null;
      dealHands(c.match, c.internal); // 新しい手札を配り直す
    }
    broadcast();
  });

  socket.on('disconnect', () => {
    const c = ctx();
    if (c) c.me.connected = Math.max(0, c.me.connected - 1);
    seats.delete(socket.id);
    broadcast();
  });
});

httpServer.listen(PORT, () => {
  console.log('「発電王」サーバー起動！（1対1×最大10卓・ポーカー風）');
  console.log('参加URL:');
  for (const url of lanUrls()) console.log(`  ${url}`);
});
