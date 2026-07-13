// 「発電王」共有型定義（サーバー・クライアント両方から参照する）
// 1対1の対戦を最大10卓まで並行して行う構成。

export type StatKey =
  | 'output' // 発電量
  | 'safety' // 安全性
  | 'selfSufficiency' // 自給率
  | 'efficiency' // 効率性
  | 'environment'; // 環境

export interface Stats {
  output: number;
  safety: number;
  selfSufficiency: number;
  efficiency: number;
  environment: number;
}

export const STAT_LABELS: Record<StatKey, string> = {
  output: '発電量',
  safety: '安全性',
  selfSufficiency: '自給率',
  efficiency: '効率性',
  environment: '環境',
};

export const STAT_KEYS: StatKey[] = [
  'output',
  'safety',
  'selfSufficiency',
  'efficiency',
  'environment',
];

// ---- 発電所カード ----
// タグはミッション・イベントの効果対象を判定するのに使う:
//   solar / wind / hydro-boost(台風で+2される水力系) / renewable
//   high-co2(サミットで出禁) / large-scale(地方創生で出禁)
//   stabilizer(揚水・蓄電池) / baseload-power(水力・地熱・原子力)

export type CardEffect =
  | {
      kind: 'baseload'; // どんな天候でも変わらず発電できる（天候イベントの影響を受けない）
      keyword: string;
      text: string;
    }
  | {
      kind: 'weather-dependent'; // 表示専用。実際の停止処理は「タグ×イベント」で行う
      keyword: string;
      text: string;
    }
  | {
      kind: 'backup-lng'; // 自分か相手の再エネカードが停止した時、発電量+amount（任意発動）
      keyword: string;
      text: string;
      optional: true;
      amount: number;
    }
  | {
      kind: 'backup-oil'; // 自分の場のカードが停止 or 天候が冬の時、発電量+amountDefault（燃料高騰時は+amountFuelSurge）（任意発動）
      keyword: string;
      text: string;
      optional: true;
      amountDefault: number;
      amountFuelSurge: number;
    }
  | {
      kind: 'backup-pumped'; // 揚水: 再エネ停止時に発動可。場に他の稼働中カードがあれば+amountFull、単独なら+amountLow（任意発動）
      keyword: string;
      text: string;
      optional: true;
      amountFull: number;
      amountLow: number;
    }
  | {
      kind: 'synergy'; // 自分の場に requireTags のカードがあれば stat を +add（自動適用）
      keyword: string;
      text: string;
      requireTags: string[]; // 例: ['solar'](蓄電池) / ['thermal'](温泉バイナリーの「熱」)
      requireSunny?: boolean; // true なら「太陽光を止めるイベントが出ていない＝晴れ」も条件
      stat: StatKey;
      add: number;
    };

export interface PlantCard {
  id: string;
  name: string;
  category: string;
  catchCopy: string;
  tags: string[];
  stats: Stats; // 各0〜5
  effect?: CardEffect;
  zeroOnEvents?: string[]; // タグに関係なく、このイベントIDが出たら発電量0になる（カード固有の効果文用）
  placeholder?: boolean; // 生徒のカードデータ入手待ちの仮数値
}

// ---- ミッションカード ----

export interface MissionCard {
  id: string;
  title: string;
  flavor: string; // 社会の状況（背景）
  lesson?: string; // 技術科としての教訓
  conditions: { stat: StatKey; min: number }[]; // すべて満たせばクリア
  bannedTag?: { tag: string; label: string }; // このタグのカードは場に出せない
  requireOneOf?: { tags: string[]; label: string }; // いずれかのタグのカードが1枚以上必要
  statAdjust?: { tag: string; stat: StatKey; add: number; note: string }; // 例: 大寒波で太陽光-2
  winter?: boolean; // 天候が冬扱い（石油の【バックアップ】発動条件）
}

// ---- イベントカード ----

export type EventEffect =
  | { kind: 'zero-output-by-tag'; tag: string } // 該当タグの発電量を0にする（=停止）
  | { kind: 'stat-penalty'; ifStat: StatKey; lte: number; modify: StatKey; add: number }
  | { kind: 'boost-by-tag'; tag: string; stat: StatKey; add: number } // 台風で水力+2など
  | { kind: 'team-penalty-unless-tag'; tags: string[]; add: number; label: string }; // 指定タグを1枚も出していないと発電量合計にadd

export interface EventCard {
  id: string;
  title: string;
  text: string;
  lesson?: string;
  effects: EventEffect[];
}

// ---- 判定結果 ----

export interface CardResult {
  cardId: string;
  name: string;
  base: Stats;
  final: Stats;
  stopped: boolean;
  notes: string[];
}

export type Seat = 'A' | 'B';

export interface PlayerResult {
  seat: Seat;
  playerName: string;
  cards: CardResult[];
  totals: Stats;
  teamNotes: string[]; // カード単位でなくプレイヤー全体にかかった効果（送電網ペナルティ等）
  cleared: boolean;
  missedReasons: string[];
  winner: boolean;
  draw: boolean; // 両者クリアかつタイブレークも同点
  points: number;
}

// ---- 対戦・全体の進行状態 ----

export type MatchPhase = 'waiting' | 'play' | 'judged' | 'finished';

export interface Submission {
  cardIds: string[]; // 最大3枚
  optionalOn: string[];
  submittedAt: number;
}

export interface PlayerSlot {
  seat: Seat;
  name: string; // 例: "プレイヤーA" または生徒が入力した名前
  claimed: boolean; // 誰かがこの席に着いたか
  connected: number;
  submission: Submission | null;
  score: number;
  wins: number;
  clears: number;
}

export interface MatchState {
  id: number; // 対戦番号 1〜10
  phase: MatchPhase;
  round: number;
  players: PlayerSlot[]; // 常に2席 [A, B]
  mission: MissionCard | null;
  event: EventCard | null;
  results: PlayerResult[] | null;
  missionDeckLeft: number;
  eventDeckLeft: number;
}

export interface GameState {
  started: boolean;
  matchCount: number; // 最大10
  totalRounds: number;
  matches: MatchState[];
}

// ---- Socket.io イベント ----

export interface ClientToServer {
  'host:setup': (opts: { matchCount: number; totalRounds: number }) => void;
  'host:reset': () => void;
  'player:join': (opts: { matchId: number; seat: Seat; name?: string }) => void;
  'player:reveal': (which: 'mission' | 'event') => void;
  'player:submit': (sub: { cardIds: string[]; optionalOn: string[] }) => void;
  'player:retract': () => void;
  'player:next': () => void;
}

export interface ServerToClient {
  state: (state: GameState) => void;
  errorMessage: (msg: string) => void;
}
