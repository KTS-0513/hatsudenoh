import { describe, expect, it } from 'vitest';
import { EVENT_CARDS, MISSION_CARDS, PLANT_CARDS } from './data';
import { isBanned, judgeMatch } from './engine';
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
const card = (id: string) => {
  const c = PLANT_CARDS.find((c) => c.id === id);
  if (!c) throw new Error(`card not found: ${id}`);
  return c;
};
const entry = (seat: Seat, cardIds: string[], optionalOn: string[] = []) => ({
  seat,
  playerName: `プレイヤー${seat}`,
  cardIds,
  optionalOn,
});

describe('イベント効果', () => {
  it('「梅雨入り・長雨」で太陽光（住宅用・メガソーラー）の発電量が0になる', () => {
    const [r] = judgeMatch(
      mission('smart-community'),
      event('rainy-season'),
      [entry('A', ['res-solar', 'mega-solar', 'small-hydro'])],
      PLANT_CARDS,
    );
    expect(r.cards[0].final.output).toBe(0);
    expect(r.cards[1].final.output).toBe(0);
    expect(r.cards[0].stopped).toBe(true);
    expect(r.cards[2].final.output).toBe(2); // 水力は無事
  });

  it('「無風」で風力3種の発電量が0になり、原子力（ベースロード）は影響を受けない', () => {
    const [r] = judgeMatch(
      mission('semiconductor'),
      event('no-wind'),
      [entry('A', ['onshore-wind', 'offshore-wind', 'nuclear'])],
      PLANT_CARDS,
    );
    expect(r.cards[0].final.output).toBe(0);
    expect(r.cards[1].final.output).toBe(0);
    expect(r.cards[2].final.output).toBe(5);
  });

  it('「シーレーン封鎖」で自給率1のカードの効率性が-4される（下限0）', () => {
    const [r] = judgeMatch(
      mission('semiconductor'),
      event('sealane-blockade'),
      [entry('A', ['coal', 'oil', 'lng'])],
      PLANT_CARDS,
    );
    const coal = r.cards.find((c) => c.cardId === 'coal')!; // 自給率1: 効率5→1
    const oil = r.cards.find((c) => c.cardId === 'oil')!; // 自給率1: 効率4→0
    const lng = r.cards.find((c) => c.cardId === 'lng')!; // 自給率2: 対象外
    expect(coal.final.efficiency).toBe(1);
    expect(oil.final.efficiency).toBe(0);
    expect(lng.final.efficiency).toBe(5);
  });

  it('「台風」で太陽光・風力は0、水力系（一般・中小・揚水）は+2', () => {
    const [r] = judgeMatch(
      mission('semiconductor'),
      event('typhoon'),
      [entry('A', ['mega-solar', 'dam-hydro', 'pumped-hydro'])],
      PLANT_CARDS,
    );
    expect(r.cards.find((c) => c.cardId === 'mega-solar')!.final.output).toBe(0);
    expect(r.cards.find((c) => c.cardId === 'dam-hydro')!.final.output).toBe(5); // 3+2
    expect(r.cards.find((c) => c.cardId === 'pumped-hydro')!.final.output).toBe(5); // 3+2
  });

  it('「送電網の負荷増大」で揚水・蓄電池がないプレイヤーは発電量合計-4', () => {
    const results = judgeMatch(
      mission('semiconductor'),
      event('grid-overload'),
      [
        entry('A', ['coal', 'nuclear']), // 安定化設備なし → -4
        entry('B', ['coal', 'grid-battery']), // 蓄電池あり → ペナルティなし
      ],
      PLANT_CARDS,
    );
    expect(results[0].totals.output).toBe(6); // 5+5-4
    expect(results[0].teamNotes.length).toBe(1);
    expect(results[1].totals.output).toBe(6); // 5+1
    expect(results[1].teamNotes.length).toBe(0);
  });
});

describe('カード固有の効果（生徒カードの転記分）', () => {
  it('大型風力（陸上）は「長雨」では停止しない（無風のみ・現実に即して修正済み）', () => {
    const [r] = judgeMatch(
      mission('semiconductor'),
      event('rainy-season'),
      [entry('A', ['onshore-wind'])],
      PLANT_CARDS,
    );
    expect(r.cards[0].final.output).toBe(3);
    expect(r.cards[0].stopped).toBe(false);
  });

  it('洋上風力（着床式）も「無風」で停止する（天候無効から修正済み）', () => {
    const [r] = judgeMatch(
      mission('semiconductor'),
      event('no-wind'),
      [entry('A', ['fixed-offshore-wind'])],
      PLANT_CARDS,
    );
    expect(r.cards[0].final.output).toBe(0);
    expect(r.cards[0].stopped).toBe(true);
  });

  it('メガソーラーは効果文どおり「無風」でも発電量0になる', () => {
    const [r] = judgeMatch(
      mission('semiconductor'),
      event('no-wind'),
      [entry('A', ['mega-solar'])],
      PLANT_CARDS,
    );
    expect(r.cards[0].final.output).toBe(0);
    expect(r.cards[0].stopped).toBe(true);
  });

  it('揚水【バックアップ】: 再エネ停止時、他に稼働中カードがあれば+4、単独なら+2', () => {
    const withOther = judgeMatch(
      mission('semiconductor'),
      event('no-wind'),
      [
        entry('A', ['pumped-hydro', 'nuclear'], ['pumped-hydro']),
        entry('B', ['offshore-wind']),
      ],
      PLANT_CARDS,
    );
    expect(
      withOther[0].cards.find((c) => c.cardId === 'pumped-hydro')!.final.output,
    ).toBe(7); // 3+4

    const alone = judgeMatch(
      mission('semiconductor'),
      event('no-wind'),
      [entry('A', ['pumped-hydro'], ['pumped-hydro']), entry('B', ['offshore-wind'])],
      PLANT_CARDS,
    );
    expect(alone[0].cards[0].final.output).toBe(5); // 3+2（単独運転）
  });

  it('温泉バイナリー【シナジー】: 地熱発電所と組み合わせた時のみ発電量+5', () => {
    const [withGeo] = judgeMatch(
      mission('semiconductor'),
      event('sealane-blockade'),
      [entry('A', ['binary', 'geothermal'])],
      PLANT_CARDS,
    );
    expect(withGeo.cards.find((c) => c.cardId === 'binary')!.final.output).toBe(6); // 1+5

    // 火力（LNG）では発動しない。バイナリー自身のgeothermalタグでも発動しない
    const [withLng] = judgeMatch(
      mission('semiconductor'),
      event('sealane-blockade'),
      [entry('A', ['binary', 'lng'])],
      PLANT_CARDS,
    );
    const binary = withLng.cards.find((c) => c.cardId === 'binary')!;
    expect(binary.final.output).toBe(1);
    expect(binary.notes.join('')).toContain('不発');
  });

  it('コジェネ【シナジー】: 場に火力系カードがあれば効率性+2', () => {
    const [r] = judgeMatch(
      mission('semiconductor'),
      event('sealane-blockade'),
      [entry('A', ['cogen', 'lng'])],
      PLANT_CARDS,
    );
    expect(r.cards.find((c) => c.cardId === 'cogen')!.final.efficiency).toBe(3); // 1+2
  });

  it('蓄電池【シナジー】: 太陽光×晴れで効率+2、長雨（晴れでない）なら不発', () => {
    const [sunny] = judgeMatch(
      mission('semiconductor'),
      event('sealane-blockade'), // 太陽光を止めるイベントではない=晴れ扱い
      [entry('A', ['grid-battery', 'mega-solar'])],
      PLANT_CARDS,
    );
    expect(sunny.cards.find((c) => c.cardId === 'grid-battery')!.final.efficiency).toBe(3); // 1+2

    const [rainy] = judgeMatch(
      mission('semiconductor'),
      event('rainy-season'),
      [entry('A', ['grid-battery', 'mega-solar'])],
      PLANT_CARDS,
    );
    const battery = rainy.cards.find((c) => c.cardId === 'grid-battery')!;
    expect(battery.final.efficiency).toBe(1);
    expect(battery.notes.join('')).toContain('不発');
  });
});

describe('ミッションの特別ルール', () => {
  it('「国際環境サミット」ではCO2大量排出カード（石炭・石油）が出禁', () => {
    const m = mission('environment-summit');
    expect(isBanned(card('coal'), m)).toBe(true);
    expect(isBanned(card('oil'), m)).toBe(true);
    expect(isBanned(card('lng'), m)).toBe(false);
    // 出禁カードを使うと大幅減点され、完全クリアにならない
    const [r] = judgeMatch(m, event('rainy-season'), [entry('A', ['coal'])], PLANT_CARDS);
    expect(r.cleared).toBe(false);
    expect(r.breakdown.some((b) => b.label.includes('出禁') && b.value < 0)).toBe(true);
  });

  it('「地方創生」では大規模発電（原子力・石炭・大型ダム水力）が出禁', () => {
    const m = mission('smart-community');
    expect(isBanned(card('nuclear'), m)).toBe(true);
    expect(isBanned(card('coal'), m)).toBe(true);
    expect(isBanned(card('dam-hydro'), m)).toBe(true);
    expect(isBanned(card('small-hydro'), m)).toBe(false);
  });

  it('「大寒波襲来」では太陽光の発電量-2、石油の【バックアップ】が冬条件で発動可', () => {
    const [r] = judgeMatch(
      mission('cold-wave'),
      event('sealane-blockade'),
      [entry('A', ['mega-solar', 'oil'], ['oil'])],
      PLANT_CARDS,
    );
    expect(r.cards.find((c) => c.cardId === 'mega-solar')!.final.output).toBe(1); // 3-2
    expect(r.cards.find((c) => c.cardId === 'oil')!.final.output).toBe(10); // 5+5（冬）
  });

  it('「半導体工場」は系統安定/ベースロード電源が1枚もないと必須条件が未達で減点', () => {
    const m = mission('semiconductor');
    const [without] = judgeMatch(
      m,
      event('rainy-season'),
      [entry('A', ['coal', 'lng', 'oil'])], // 必須カードなし
      PLANT_CARDS,
    );
    expect(without.conditionStatus.some((c) => !c.ok && c.label.includes('系統安定'))).toBe(true);
    expect(without.breakdown.some((b) => b.label.includes('必須カードなし'))).toBe(true);

    const [withStab] = judgeMatch(
      m,
      event('rainy-season'),
      [entry('A', ['coal', 'lng', 'nuclear'])], // 原子力=ベースロード電源
      PLANT_CARDS,
    );
    expect(withStab.conditionStatus.some((c) => !c.ok && c.label.includes('系統安定'))).toBe(false);
  });

  it('「燃料価格の急騰」ミッション中は石油バックアップの加算が+3になる', () => {
    // 梅雨で自分の太陽光が停止 → バックアップ発動条件成立、ただし加算は+3
    const [r] = judgeMatch(
      mission('fuel-price-surge'),
      event('rainy-season'),
      [entry('A', ['oil', 'res-solar'], ['oil'])],
      PLANT_CARDS,
    );
    expect(r.cards.find((c) => c.cardId === 'oil')!.final.output).toBe(8); // 5+3
  });

  it('複合条件（燃料急騰）を満たさない手でも、スコアは計算され完全クリアにはならない', () => {
    const [r] = judgeMatch(
      mission('fuel-price-surge'),
      event('rainy-season'),
      [entry('A', ['dam-hydro', 'geothermal', 'cogen'])], // 出力8で発電量条件に届かない
      PLANT_CARDS,
    );
    expect(r.cleared).toBe(false);
    expect(r.conditionStatus.some((c) => !c.ok && c.label.includes('発電量'))).toBe(true);
    expect(r.score).toBeGreaterThan(0); // それでもスコアは入る
  });
});

describe('LNG【バックアップ】（対戦相手の停止も参照）', () => {
  it('相手の再エネが停止していれば+4', () => {
    const results = judgeMatch(
      mission('semiconductor'),
      event('no-wind'),
      [entry('A', ['lng'], ['lng']), entry('B', ['onshore-wind'])],
      PLANT_CARDS,
    );
    expect(results[0].cards[0].final.output).toBe(9); // 5+4
  });

  it('誰の再エネも停止していなければ不発', () => {
    const results = judgeMatch(
      mission('semiconductor'),
      event('sealane-blockade'),
      [entry('A', ['lng'], ['lng']), entry('B', ['nuclear'])],
      PLANT_CARDS,
    );
    expect(results[0].cards[0].final.output).toBe(5);
    expect(results[0].cards[0].notes.join('')).toContain('不発');
  });
});

describe('ミッションの完全クリア可能性（3枚上限）', () => {
  // どのミッションも「3枚」で完全クリアできる組み合わせが存在することを保証する
  const winningCombos: Record<string, { cards: string[]; optionalOn?: string[] }> = {
    'environment-summit': { cards: ['nuclear', 'onshore-wind', 'biomass'] },
    'cold-wave': { cards: ['dam-hydro', 'nuclear', 'oil'], optionalOn: ['oil'] },
    semiconductor: { cards: ['lng', 'fixed-offshore-wind', 'dam-hydro'] },
    'fuel-price-surge': { cards: ['nuclear', 'dam-hydro', 'pumped-hydro'] },
    'smart-community': { cards: ['fixed-offshore-wind', 'pumped-hydro', 'small-hydro'] },
  };

  for (const m of MISSION_CARDS) {
    it(`「${m.title}」は完全クリア可能な組み合わせがある`, () => {
      const combo = winningCombos[m.id];
      expect(combo).toBeDefined();
      const [r] = judgeMatch(
        m,
        event('sealane-blockade'),
        [entry('A', combo.cards, combo.optionalOn ?? [])],
        PLANT_CARDS,
      );
      expect(r.conditionStatus.every((c) => c.ok)).toBe(true);
      expect(r.cleared).toBe(true);
    });
  }
});

describe('ポーカー風スコアと勝敗', () => {
  it('スコアが高い方が勝ち（提出3枚）', () => {
    const results = judgeMatch(
      mission('environment-summit'),
      event('sealane-blockade'),
      [
        entry('A', ['nuclear', 'onshore-wind', 'biomass']), // 高環境
        entry('B', ['lng', 'waste', 'cogen']), // 低環境
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

  it('同スコアなら引き分け（2pt/2pt）', () => {
    const results = judgeMatch(
      mission('smart-community'),
      event('sealane-blockade'),
      [
        entry('A', ['fixed-offshore-wind', 'pumped-hydro', 'small-hydro']),
        entry('B', ['fixed-offshore-wind', 'pumped-hydro', 'small-hydro']),
      ],
      PLANT_CARDS,
    );
    expect(results[0].draw).toBe(true);
    expect(results[0].points).toBe(2);
    expect(results[1].points).toBe(2);
  });

  it('未提出のプレイヤーはスコア0で、提出した側の勝ち', () => {
    const results = judgeMatch(
      mission('smart-community'),
      event('sealane-blockade'),
      [entry('A', []), entry('B', ['fixed-offshore-wind', 'pumped-hydro', 'small-hydro'])],
      PLANT_CARDS,
    );
    expect(results[0].score).toBe(0);
    expect(results[1].winner).toBe(true);
  });

  it('同カテゴリ3枚でフラッシュボーナスがつく', () => {
    const [r] = judgeMatch(
      mission('smart-community'),
      event('sealane-blockade'),
      [entry('A', ['mega-solar', 'onshore-wind', 'small-hydro'])], // すべて再生可能
      PLANT_CARDS,
    );
    expect(r.breakdown.some((b) => b.label.includes('フラッシュ'))).toBe(true);
  });
});

