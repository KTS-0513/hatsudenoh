// 「発電王」判定エンジン（1対1対戦用）
// 計算パイプライン:
//   素のステータス
//   → ミッション特別ルール（太陽光-2 など）
//   → イベント効果（停止・ペナルティ・ブースト）
//   → カード特殊効果（【バックアップ】等）
//   → プレイヤー全体ペナルティ（送電網など）
//   → 合計 → クリア条件（複数）＋必須カード条件 → 勝敗
// 勝敗のタイブレークは「効率性合計 → 安全性合計」の順（確定ルール）。

import type {
  CardResult,
  EventCard,
  MissionCard,
  PlantCard,
  PlayerResult,
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

    const missedReasons: string[] = [];

    // 出禁カードのチェック（提出時にも弾くが、念のため判定でも失格扱いにする）
    const bannedUsed = calcs.filter((c) => isBanned(c.card, mission));
    for (const b of bannedUsed) {
      missedReasons.push(`「${b.card.name}」はこのミッションでは場に出せない（ルール違反）`);
    }

    // 必須カード条件（例: 半導体工場は系統安定orベースロード電源が1枚以上）
    if (mission.requireOneOf && calcs.length > 0) {
      const has = calcs.some((c) =>
        mission.requireOneOf!.tags.some((t) => c.card.tags.includes(t)),
      );
      if (!has) missedReasons.push(`条件未達成: ${mission.requireOneOf.label}`);
    }

    // クリア条件（複数）
    for (const cond of mission.conditions) {
      if (totals[cond.stat] < cond.min) {
        missedReasons.push(
          `${STAT_LABELS[cond.stat]}が${cond.min - totals[cond.stat]}足りない（${totals[cond.stat]}/${cond.min}）`,
        );
      }
    }

    return {
      seat: entry.seat,
      playerName: entry.playerName,
      cards,
      totals,
      teamNotes,
      cleared: missedReasons.length === 0 && calcs.length > 0,
      missedReasons,
      winner: false,
      draw: false,
      points: 0,
    };
  });

  decideWinner(results);
  return results;
}

/** 1対1の勝敗・ポイントを書き込む
 *  両者クリア → 効率性合計→安全性合計のタイブレークで勝者決定（同点なら引き分け）
 *  片方クリア → クリアした方の勝ち
 *  ポイント: 勝ち3pt / 引き分け2pt / クリアしたが負け1pt / 未達成0pt */
export function decideWinner(results: PlayerResult[]): void {
  const cleared = results.filter((r) => r.cleared);

  if (cleared.length === 1) {
    cleared[0].winner = true;
    cleared[0].points = 3;
  } else if (cleared.length >= 2) {
    const [a, b] = cleared;
    const diff =
      a.totals.efficiency - b.totals.efficiency || a.totals.safety - b.totals.safety;
    if (diff === 0) {
      a.draw = b.draw = true;
      a.points = b.points = 2;
    } else {
      const win = diff > 0 ? a : b;
      const lose = diff > 0 ? b : a;
      win.winner = true;
      win.points = 3;
      lose.points = 1;
    }
  }
}

/** ミッションの条件を人が読める形にする（画面表示用） */
export function missionConditionText(mission: MissionCard): string {
  return mission.conditions
    .map((c) =>
      c.stat === 'output'
        ? `目標発電量 ${c.min} 以上`
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
