// 「発電王」判定エンジン（1対1対戦・ポーカー風）
// 手札6枚からベスト3枚を出し、ミッションを「どれだけ攻略できたか」をスコア化して勝敗を決める。
// 計算パイプライン:
//   素のステータス
//   → ミッション特別ルール（太陽光-2 など）
//   → イベント効果（停止・ペナルティ・ブースト）
//   → カード特殊効果（【バックアップ】等）
//   → プレイヤー全体ペナルティ（送電網など）
//   → 合計 → スコア化（指標の合計＋条件ボーナス＋コンボ）→ 高得点が勝ち

import type {
  CardResult,
  EventCard,
  MissionCard,
  PlantCard,
  PlayerResult,
  ScoreBreakdown,
  Seat,
  StatKey,
  Stats,
} from './types';
import { STAT_KEYS, STAT_LABELS } from './types';

export interface JudgeEntry {
  seat: Seat;
  playerName: string;
  cardIds: string[];
  optionalOn: string[];
}

interface CardCalc {
  card: PlantCard;
  stats: Stats;
  stopped: boolean;
  notes: string[];
}

const zeroStats = (): Stats => ({
  output: 0,
  safety: 0,
  selfSufficiency: 0,
  efficiency: 0,
  environment: 0,
});

/** ミッションで場に出せないカードか */
export function isBanned(card: PlantCard, mission: MissionCard | null): boolean {
  return !!mission?.bannedTag && card.tags.includes(mission.bannedTag.tag);
}

/** 1対戦（2プレイヤー）ぶんを一括判定する */
export function judgeMatch(
  mission: MissionCard,
  event: EventCard | null,
  entries: JudgeEntry[],
  allCards: PlantCard[],
): PlayerResult[] {
  const cardMap = new Map(allCards.map((c) => [c.id, c]));
  const effects = event?.effects ?? [];

  // 1. 作業用コピー + ミッション特別ルール + イベント効果
  const players = entries.map((entry) => {
    const calcs: CardCalc[] = entry.cardIds
      .map((id) => cardMap.get(id))
      .filter((c): c is PlantCard => !!c)
      .map((card) => ({ card, stats: { ...card.stats }, stopped: false, notes: [] }));

    for (const c of calcs) {
      // ミッションの特別ルール（例: 大寒波で太陽光の発電量-2）
      if (mission.statAdjust && c.card.tags.includes(mission.statAdjust.tag)) {
        c.stats[mission.statAdjust.stat] += mission.statAdjust.add;
        c.notes.push(mission.statAdjust.note);
      }

      // イベント効果
      const isBaseload = c.card.effect?.kind === 'baseload';
      let baseloadNoted = false;
      for (const ef of effects) {
        if (ef.kind === 'zero-output-by-tag') {
          if (isBaseload) {
            if (!baseloadNoted && c.card.tags.includes(ef.tag)) {
              c.notes.push(`【${c.card.effect!.keyword}】天候イベントの影響を受けない`);
              baseloadNoted = true;
            }
          } else if (c.card.tags.includes(ef.tag) && c.stats.output > 0) {
            c.stats.output = 0;
            c.notes.push(`イベント「${event!.title}」により発電量0（停止）`);
          }
        }
        if (ef.kind === 'stat-penalty' && c.card.stats[ef.ifStat] <= ef.lte) {
          c.stats[ef.modify] += ef.add;
          c.notes.push(`イベント「${event!.title}」により${STAT_LABELS[ef.modify]}${ef.add}`);
        }
        if (ef.kind === 'boost-by-tag' && c.card.tags.includes(ef.tag)) {
          c.stats[ef.stat] += ef.add;
          c.notes.push(`イベント「${event!.title}」により${STAT_LABELS[ef.stat]}+${ef.add}`);
        }
      }

      // カード固有の「このイベントが出たら発電量0」（例: 大型風力(陸上)は長雨でも停止）
      if (
        event &&
        c.card.zeroOnEvents?.includes(event.id) &&
        c.card.effect?.kind !== 'baseload' &&
        c.stats.output > 0
      ) {
        c.stats.output = 0;
        c.notes.push(`イベント「${event.title}」により発電量0（停止）`);
      }

      // ミッション・イベントの結果、発電量が0以下になったカードは「停止」扱い
      if (c.card.stats.output > 0 && c.stats.output <= 0) {
        c.stopped = true;
      }
    }
    return { entry, calcs };
  });

  // 2. 対戦全体を見渡して「再エネが停止したか」（LNG【バックアップ】の発動条件）
  const anyRenewableStopped = players.some((p) =>
    p.calcs.some((c) => c.stopped && c.card.tags.includes('renewable')),
  );

  // 3. カードの特殊効果
  const isWinter = !!mission.winter;
  const isFuelSurge = mission.id === 'fuel-price-surge';
  for (const p of players) {
    for (const c of p.calcs) {
      const eff = c.card.effect;
      if (!eff) continue;
      const wantsOn = p.entry.optionalOn.includes(c.card.id);

      if (eff.kind === 'backup-lng' && wantsOn) {
        if (anyRenewableStopped) {
          c.stats.output += eff.amount;
          c.notes.push(`【${eff.keyword}】再エネ停止のため発電量+${eff.amount}`);
        } else {
          c.notes.push(`【${eff.keyword}】条件未成立（停止した再エネなし）のため不発`);
        }
      }

      if (eff.kind === 'backup-oil' && wantsOn) {
        const ownStopped = p.calcs.some((x) => x.stopped);
        if (ownStopped || isWinter) {
          const amount = isFuelSurge ? eff.amountFuelSurge : eff.amountDefault;
          c.stats.output += amount;
          const reason = ownStopped ? '自分の場に停止カードあり' : '天候が冬';
          c.notes.push(`【${eff.keyword}】${reason}のため発電量+${amount}`);
        } else {
          c.notes.push(`【${eff.keyword}】条件未成立（停止カードなし・冬でもない）のため不発`);
        }
      }

      // 揚水【バックアップ】: 再エネ停止時に発動可。
      // くみ上げ用の電気を確保できる（場に他の稼働中カードがある）なら+4、単独なら+2
      if (eff.kind === 'backup-pumped' && wantsOn) {
        if (anyRenewableStopped) {
          const hasOtherActive = p.calcs.some((x) => x !== c && !x.stopped);
          const amount = hasOtherActive ? eff.amountFull : eff.amountLow;
          c.stats.output += amount;
          const reason = hasOtherActive
            ? '再エネ停止・くみ上げ電力あり'
            : '再エネ停止・単独運転（くみ上げ電力が限られる）';
          c.notes.push(`【${eff.keyword}】${reason}のため発電量+${amount}`);
        } else {
          c.notes.push(`【${eff.keyword}】条件未成立（停止した再エネなし）のため不発`);
        }
      }

      // シナジー（自動適用）: 例) 温泉バイナリー=場に地熱発電所があれば発電量+5 / 蓄電池=太陽光×晴れで効率+2
      // 自分自身は条件のカードに数えない
      if (eff.kind === 'synergy') {
        const hasReq = p.calcs.some(
          (x) => x !== c && eff.requireTags.some((t) => x.card.tags.includes(t)),
        );
        const sunny = !effects.some((e) => e.kind === 'zero-output-by-tag' && e.tag === 'solar');
        if (hasReq && (!eff.requireSunny || sunny)) {
          c.stats[eff.stat] += eff.add;
          c.notes.push(`【${eff.keyword}】条件成立のため${STAT_LABELS[eff.stat]}+${eff.add}`);
        } else {
          const reason = !hasReq ? '対象カードが場にない' : '晴れではない';
          c.notes.push(`【${eff.keyword}】条件未成立（${reason}）のため不発`);
        }
      }
    }
  }

  // 4. 下限0にそろえて合計し、プレイヤー全体ペナルティ → クリア条件判定
  const results: PlayerResult[] = players.map(({ entry, calcs }) => {
    const cards: CardResult[] = calcs.map((c) => {
      for (const k of STAT_KEYS) {
        if (c.stats[k] < 0) {
          c.notes.push(`${STAT_LABELS[k]}は0未満にならないため0として計算`);
          c.stats[k] = 0;
        }
      }
      return {
        cardId: c.card.id,
        name: c.card.name,
        base: { ...c.card.stats },
        final: c.stats,
        stopped: c.stopped,
        notes: c.notes,
      };
    });

    const totals = cards.reduce((acc, c) => {
      for (const k of STAT_KEYS) acc[k] += c.final[k];
      return acc;
    }, zeroStats());

    const teamNotes: string[] = [];
    for (const ef of effects) {
      if (ef.kind === 'team-penalty-unless-tag') {
        const hasTag = calcs.some((c) => ef.tags.some((t) => c.card.tags.includes(t)));
        if (!hasTag && calcs.length > 0) {
          totals.output = Math.max(0, totals.output + ef.add);
          teamNotes.push(ef.label);
        }
      }
    }

    // ---- スコア計算（ポーカー風「どれだけ攻略できたか」） ----
    const breakdown: ScoreBreakdown[] = [];
    const played = calcs.length > 0;

    // ① ミッションが評価する指標の合計（重み付き）
    for (const s of mission.scoreStats) {
      const raw = totals[s.stat];
      const value = raw * s.weight;
      breakdown.push({
        label:
          s.weight === 1
            ? `${STAT_LABELS[s.stat]}の合計`
            : `${STAT_LABELS[s.stat]}の合計 ×${s.weight}`,
        value,
      });
    }

    // ② 各条件の達成状況（満たすごとにボーナス、全部満たすと完全クリア）
    const conditionStatus: { label: string; ok: boolean }[] = [];
    let metCount = 0;
    for (const cond of mission.conditions) {
      const ok = totals[cond.stat] >= cond.min;
      if (ok) metCount++;
      conditionStatus.push({
        label: `${STAT_LABELS[cond.stat]} ${cond.min}以上（現在 ${totals[cond.stat]}）`,
        ok,
      });
    }
    if (metCount > 0) {
      breakdown.push({ label: `条件達成ボーナス（${metCount}個）`, value: metCount * 3 });
    }

    // ③ 必須カード条件（満たすとボーナス、無いと減点）
    let requireOk = true;
    if (mission.requireOneOf && played) {
      requireOk = calcs.some((c) =>
        mission.requireOneOf!.tags.some((t) => c.card.tags.includes(t)),
      );
      conditionStatus.push({ label: mission.requireOneOf.label, ok: requireOk });
      breakdown.push({
        label: requireOk ? '必須カード条件クリア' : '必須カードなし（減点）',
        value: requireOk ? 3 : -5,
      });
    }

    // ④ ポーカー風のコンボボーナス
    if (played) {
      const cats = new Set(calcs.map((c) => c.card.category));
      if (calcs.length === 3 && cats.size === 1) {
        breakdown.push({ label: '同カテゴリ3枚そろい（フラッシュ）', value: 4 });
      } else if (calcs.length === 3 && cats.size === 3) {
        breakdown.push({ label: '3種のカテゴリ（多様性ボーナス）', value: 3 });
      }
    }

    // ⑤ 出禁カードを使っていたら大きく減点
    const bannedUsed = calcs.filter((c) => isBanned(c.card, mission));
    for (const b of bannedUsed) {
      breakdown.push({ label: `「${b.card.name}」は出禁カード（大幅減点）`, value: -10 });
    }

    const score = played ? breakdown.reduce((sum, b) => sum + b.value, 0) : 0;
    const cleared = played && metCount === mission.conditions.length && requireOk && bannedUsed.length === 0;
    if (cleared) breakdown.push({ label: '🎉 完全クリアボーナス', value: 5 });
    const finalScore = cleared ? score + 5 : score;

    return {
      seat: entry.seat,
      playerName: entry.playerName,
      cards,
      totals,
      teamNotes,
      score: Math.max(0, finalScore),
      breakdown,
      cleared,
      conditionStatus,
      winner: false,
      draw: false,
      points: 0,
    };
  });

  decideWinner(results);
  return results;
}

/** 1対1の勝敗・勝ち点を書き込む
 *  スコアが高い方が勝ち。同点なら引き分け。
 *  勝ち点: 勝ち3pt / 引き分け2pt / 負け1pt（提出していれば） / 未提出0pt */
export function decideWinner(results: PlayerResult[]): void {
  const played = results.filter((r) => r.cards.length > 0);
  if (played.length === 0) return;

  if (played.length === 1) {
    played[0].winner = true;
    played[0].points = 3;
    return;
  }

  const [a, b] = played;
  if (a.score === b.score) {
    a.draw = b.draw = true;
    a.points = b.points = 2;
  } else {
    const win = a.score > b.score ? a : b;
    const lose = a.score > b.score ? b : a;
    win.winner = true;
    win.points = 3;
    lose.points = 1;
  }
}

/** ミッションのスコア対象を人が読める形にする（画面表示用） */
export function missionScoreText(mission: MissionCard): string {
  return mission.scoreStats
    .map((s) =>
      s.weight === 1 ? STAT_LABELS[s.stat] : `${STAT_LABELS[s.stat]}（×${s.weight}）`,
    )
    .join('＋');
}

/** ミッションの目標条件（達成でボーナス）を人が読める形にする（画面表示用） */
export function missionConditionText(mission: MissionCard): string {
  if (mission.conditions.length === 0) return '（目標条件なし・スコアを稼ごう）';
  return mission.conditions
    .map((c) =>
      c.stat === 'output'
        ? `発電量 ${c.min} 以上`
        : `${STAT_LABELS[c.stat]}の合計 ${c.min} 以上`,
    )
    .join('、');
}

/** ミッションの特別ルール文を列挙する（画面表示用） */
export function missionSpecialRules(mission: MissionCard): string[] {
  const rules: string[] = [];
  if (mission.bannedTag) rules.push(mission.bannedTag.label);
  if (mission.requireOneOf) rules.push(mission.requireOneOf.label);
  if (mission.statAdjust) rules.push(mission.statAdjust.note);
  if (mission.winter) rules.push('天候は「冬」扱い（石油火力の【バックアップ】が使用可能）');
  return rules;
}

/** 任意効果（発動するかを選べる効果）を持つカードか */
export function hasOptionalEffect(card: PlantCard): boolean {
  return (
    card.effect?.kind === 'backup-lng' ||
    card.effect?.kind === 'backup-oil' ||
    card.effect?.kind === 'backup-pumped'
  );
}
