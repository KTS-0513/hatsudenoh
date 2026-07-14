import { describe, expect, it } from 'vitest';
import { EVENT_CARDS, MISSION_CARDS, PLANT_CARDS } from './data';
import { judgeMatch } from './engine';
import type { EventCard, MissionCard, Seat } from './types';

const event = (id: string): EventCard => {
  const e = EVENT_CARDS.find((e) => e.id === id);
  if (!e) throw new Error(`event not found: ${id}`);
  return e;
};
const mission = (id: string): MissionCard => {
  const m = MISSION_CARDS.find((m) => m.id === id);
  if (!m) throw new Error(`mission not found: ${id}`);
  return m;
};
const entry = (seat: Seat, cardIds: string[], optionalOn: string[] = []) => ({
  seat,
  playerName: `プレイヤー${seat}`,
  cardIds,
  optionalOn,
});
const cardOf = (r: ReturnType<typeof judgeMatch>[number], id: string) =>
  r.cards.find((c) => c.cardId === id)!;

describe('イベント効果（1効果ずつ）', () => {
  it('「長雨」で太陽光の発電量が0になり、ベースロード（石炭）は影響を受けない', () => {
    const [r] = judgeMatch(
      mission('factory'),
      event('rainy'),
      [entry('A', ['res-solar', 'mega-solar', 'coal'])],
      PLANT_CARDS,
    );
    expect(cardOf(r, 'res-solar').final.output).toBe(0);
    expect(cardOf(r, 'mega-solar').final.output).toBe(0);
    expect(cardOf(r, 'coal').final.output).toBe(5); // ベースロードは無事
  });

  it('「無風」で風力3種の発電量が0になる', () => {
    const [r] = judgeMatch(
      mission('factory'),
      event('windless'),
      [entry('A', ['onshore-wind', 'fixed-offshore-wind', 'offshore-wind'])],
      PLANT_CARDS,
    );
    for (const id of ['onshore-wind', 'fixed-offshore-wind', 'offshore-wind']) {
      expect(cardOf(r, id).final.output).toBe(0);
    }
  });

  it('「無風」でメガソーラーも（カード固有効果で）止まる', () => {
    const [r] = judgeMatch(mission('factory'), event('windless'), [entry('A', ['mega-solar'])], PLANT_CARDS);
    expect(r.cards[0].final.output).toBe(0);
  });

  it('「燃料価格の高騰」で自給率2以下のカードの効率が-2される', () => {
    const [r] = judgeMatch(
      mission('household'),
      event('fuel-price-surge'),
      [entry('A', ['coal', 'lng', 'nuclear'])],
      PLANT_CARDS,
    );
    expect(cardOf(r, 'coal').final.efficiency).toBe(3); // 自給率1 → 5-2
    expect(cardOf(r, 'lng').final.efficiency).toBe(3); // 自給率2 → 5-2
    expect(cardOf(r, 'nuclear').final.efficiency).toBe(5); // 自給率4 → 対象外
  });

  it('「猛暑」で太陽光の発電量が+2される', () => {
    const [r] = judgeMatch(mission('factory'), event('heatwave'), [entry('A', ['mega-solar'])], PLANT_CARDS);
    expect(r.cards[0].final.output).toBe(5); // 3+2
  });

  it('「平常運転」は何も起きない', () => {
    const [r] = judgeMatch(mission('factory'), event('calm'), [entry('A', ['mega-solar'])], PLANT_CARDS);
    expect(r.cards[0].final.output).toBe(3);
  });
});

describe('カードの特殊効果（イベントと絡む分）', () => {
  it('LNG【バックアップ】: 相手の再エネが停止していれば+4', () => {
    const results = judgeMatch(
      mission('factory'),
      event('windless'),
      [entry('A', ['lng'], ['lng']), entry('B', ['onshore-wind'])],
      PLANT_CARDS,
    );
    expect(results[0].cards[0].final.output).toBe(9); // 5+4
  });

  it('温泉バイナリー【シナジー】: 地熱と組み合わせた時のみ+5', () => {
    const [withGeo] = judgeMatch(mission('factory'), event('calm'), [entry('A', ['binary', 'geothermal'])], PLANT_CARDS);
    expect(cardOf(withGeo, 'binary').final.output).toBe(6); // 1+5
    const [alone] = judgeMatch(mission('factory'), event('calm'), [entry('A', ['binary', 'lng'])], PLANT_CARDS);
    expect(cardOf(alone, 'binary').final.output).toBe(1);
  });

  it('蓄電池【シナジー】: 太陽光×晴れで効率+2、長雨なら不発', () => {
    const [sunny] = judgeMatch(mission('household'), event('calm'), [entry('A', ['grid-battery', 'mega-solar'])], PLANT_CARDS);
    expect(cardOf(sunny, 'grid-battery').final.efficiency).toBe(3); // 1+2
    const [rainy] = judgeMatch(mission('household'), event('rainy'), [entry('A', ['grid-battery', 'mega-solar'])], PLANT_CARDS);
    expect(cardOf(rainy, 'grid-battery').final.efficiency).toBe(1);
  });
});

describe('スコア計算（注目×2 ＋ 5つの力の合計 ＋ 多様性）', () => {
  it('注目ステータスはもう一度加算される（実質×2）', () => {
    const [r] = judgeMatch(
      mission('environment'), // 注目=環境
      event('calm'),
      [entry('A', ['nuclear', 'onshore-wind', 'small-hydro'])],
      PLANT_CARDS,
    );
    // 合計: 発電量10 安全10 自給14 効率11 環境15
    expect(r.totals.environment).toBe(15);
    const spot = r.breakdown.find((b) => b.label.includes('注目'))!;
    expect(spot.value).toBe(15); // 環境の合計ぶんがもう一度
    // スコア = 内訳の合計
    expect(r.score).toBe(r.breakdown.reduce((s, b) => s + b.value, 0));
  });

  it('3種類ちがう電源で「エネルギーミックス・ボーナス」がつく', () => {
    const [r] = judgeMatch(
      mission('factory'),
      event('calm'),
      [entry('A', ['coal', 'nuclear', 'onshore-wind'])], // 化石燃料・次世代GX・再生可能
      PLANT_CARDS,
    );
    expect(r.breakdown.some((b) => b.label.includes('エネルギーミックス'))).toBe(true);
  });

  it('同じ種類ばかりだと多様性ボーナスは小さい（フラッシュは廃止）', () => {
    const [r] = judgeMatch(
      mission('environment'),
      event('calm'),
      [entry('A', ['mega-solar', 'onshore-wind', 'small-hydro'])], // すべて再生可能
      PLANT_CARDS,
    );
    expect(r.breakdown.some((b) => b.label.includes('エネルギーミックス'))).toBe(false);
  });

  it('未提出はスコア0', () => {
    const results = judgeMatch(mission('factory'), event('calm'), [entry('A', []), entry('B', ['nuclear'])], PLANT_CARDS);
    expect(results[0].score).toBe(0);
    expect(results[1].score).toBeGreaterThan(0);
  });
});

describe('勝敗', () => {
  it('スコアが高い方が勝ち（3pt / 1pt）', () => {
    const results = judgeMatch(
      mission('environment'), // 注目=環境
      event('calm'),
      [
        entry('A', ['nuclear', 'onshore-wind', 'small-hydro']), // 高環境
        entry('B', ['coal', 'oil', 'lng']), // 低環境
      ],
      PLANT_CARDS,
    );
    const a = results.find((r) => r.seat === 'A')!;
    const b = results.find((r) => r.seat === 'B')!;
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.winner).toBe(true);
    expect(a.points).toBe(3);
    expect(b.points).toBe(1);
  });

  it('同スコアなら引き分け（2pt / 2pt）', () => {
    const results = judgeMatch(
      mission('factory'),
      event('calm'),
      [entry('A', ['nuclear', 'onshore-wind', 'small-hydro']), entry('B', ['nuclear', 'onshore-wind', 'small-hydro'])],
      PLANT_CARDS,
    );
    expect(results[0].draw).toBe(true);
    expect(results[0].points).toBe(2);
    expect(results[1].points).toBe(2);
  });
});

describe('イベントなし（やさしいモード）でも判定できる', () => {
  it('event=null でもスコアが計算される', () => {
    const [r] = judgeMatch(mission('disaster'), null, [entry('A', ['nuclear', 'small-hydro', 'grid-battery'])], PLANT_CARDS);
    expect(r.score).toBeGreaterThan(0);
    expect(r.cards.every((c) => !c.stopped)).toBe(true);
  });
});
