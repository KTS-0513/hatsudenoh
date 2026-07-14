// プレイヤー画面・教員モニターで共用する表示部品

import { useState } from 'react';
import type {
  EventCard,
  MissionCard,
  PlantCard,
  PlayerResult,
  Stats,
} from '../../shared/types';
import { STAT_KEYS, STAT_LABELS } from '../../shared/types';
import { missionSpotlightLabel } from '../../shared/engine';

const CATEGORY_CLASS: Record<string, string> = {
  系統安定: 'cat-grid',
  次世代GX: 'cat-gx',
  再生可能: 'cat-renew',
  石油燃料: 'cat-oil',
  化石燃料: 'cat-oil',
  熱利用: 'cat-heat',
};

/** カード画像。/cards/<id>.jpg があればそれを表示、無ければステータス表示にフォールバック */
function CardImage({ card }: { card: PlantCard }) {
  const [failed, setFailed] = useState(false);
  const src = card.image ?? `/cards/${card.id}.jpg`;
  if (failed) return null;
  return (
    <img
      className="card-image"
      src={src}
      alt={card.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** カードの裏面。public/card-back.png があれば表示、無ければ模様のフォールバック */
export function CardBack({ small }: { small?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={`card-back fallback ${small ? 'small' : ''}`} />;
  return (
    <img
      className={`card-back ${small ? 'small' : ''}`}
      src="/card-back.png"
      alt="カード（裏）"
      onError={() => setFailed(true)}
    />
  );
}

/** トップ画面などで使うロゴ画像（card-back.png を流用）。無ければ何も出さない */
export function LogoImage() {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img className="logo-image" src="/card-back.png" alt="発電王" onError={() => setFailed(true)} />
  );
}

export function StatRow({ stats }: { stats: Stats }) {
  return (
    <div className="stat-row">
      {STAT_KEYS.map((k) => (
        <span key={k} className="stat-item">
          <span className="stat-label">{STAT_LABELS[k]}</span>
          <span className="stat-value">{stats[k]}</span>
        </span>
      ))}
    </div>
  );
}

export function CardChip({
  card,
  selected,
  disabled,
  disabledReason,
  onClick,
}: {
  card: PlantCard;
  selected?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={`card-chip ${CATEGORY_CLASS[card.category] ?? ''} ${selected ? 'selected' : ''} ${card.placeholder ? 'placeholder' : ''} ${disabled ? 'banned' : ''}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      <CardImage card={card} />
      <div className="card-chip-head">
        <span className="card-category">{card.category}</span>
        <span className="card-name">{card.name}</span>
      </div>
      <StatRow stats={card.stats} />
      {card.effect && (
        <div className="card-effect">
          <b>【{card.effect.keyword}】</b>
          {card.effect.text}
        </div>
      )}
      {disabled && <div className="banned-label">🚫 {disabledReason ?? 'このミッションでは出せない'}</div>}
    </button>
  );
}

export function MissionPanel({ mission }: { mission: MissionCard | null }) {
  return (
    <div className="panel mission-panel">
      <div className="panel-title">ミッション（社会の要求）</div>
      {mission ? (
        <>
          <div className="panel-card-title">
            {mission.emoji} {mission.title}
          </div>
          <div className="panel-flavor">「{mission.flavor}」</div>
          <div className="spotlight-badge">
            今回の注目：<b>{missionSpotlightLabel(mission)}</b>（この力が2倍で効く）
          </div>
        </>
      ) : (
        <div className="panel-empty">まだめくられていません</div>
      )}
    </div>
  );
}

export function EventPanel({ event }: { event: EventCard | null }) {
  return (
    <div className="panel event-panel">
      <div className="panel-title">イベント（トラブル）</div>
      {event ? (
        <>
          <div className="panel-card-title">{event.title}</div>
          <div className="panel-condition">{event.text}</div>
        </>
      ) : (
        <div className="panel-empty">まだめくられていません</div>
      )}
    </div>
  );
}

/** 判定結果1プレイヤーぶんの内訳表示 */
export function ResultDetail({
  result,
  mission,
}: {
  result: PlayerResult;
  mission: MissionCard;
}) {
  return (
    <div className={`result-detail ${result.winner ? 'cleared' : 'missed'}`}>
      <div className="result-head">
        <span className="result-group">{result.playerName}</span>
        <span className="result-score">スコア {result.score}</span>
        {result.winner && <span className="result-badge win">🏆 勝ち（+{result.points}pt）</span>}
        {result.draw && <span className="result-badge draw">引き分け（+{result.points}pt）</span>}
      </div>

      {result.cards.length > 0 && (
        <BalanceBars totals={result.totals} spotlight={mission.spotlight} />
      )}

      {result.voices.length > 0 && (
        <div className="voices">
          <div className="voices-title">📣 社会の声</div>
          {result.voices.map((v) => (
            <div key={v.stat} className={`voice-row ${v.mood}`}>
              <span className="voice-mood">
                {v.mood === 'angry' ? '😠' : v.mood === 'happy' ? '😊' : '😐'}
              </span>
              <span className="voice-who">{v.who}</span>
              <span className="voice-line">
                {v.line ? `「${v.line}」` : '……'}
              </span>
            </div>
          ))}
        </div>
      )}

      {result.breakdown.length > 0 && (
        <div className="score-breakdown">
          {result.breakdown.map((b, i) => (
            <div key={i} className={`score-line-item ${b.value < 0 ? 'minus' : ''}`}>
              <span>{b.label}</span>
              <span>{b.value >= 0 ? `+${b.value}` : b.value}</span>
            </div>
          ))}
          <div className="score-line-item total">
            <span>合計スコア</span>
            <span>{result.score}</span>
          </div>
        </div>
      )}

      {result.cards.length === 0 ? (
        <div className="panel-empty">カードが提出されていません</div>
      ) : (
        <table className="result-table">
          <thead>
            <tr>
              <th>カード</th>
              {STAT_KEYS.map((k) => (
                <th key={k}>{STAT_LABELS[k]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.cards.map((c) => (
              <tr key={c.cardId} className={c.stopped ? 'stopped' : ''}>
                <td>
                  {c.name}
                  {c.notes.map((n, i) => (
                    <div key={i} className="result-note">
                      {n}
                    </div>
                  ))}
                </td>
                {STAT_KEYS.map((k) => (
                  <td key={k} className={c.final[k] !== c.base[k] ? 'changed' : ''}>
                    {c.final[k] !== c.base[k] ? (
                      <>
                        <s>{c.base[k]}</s> {c.final[k]}
                      </>
                    ) : (
                      c.final[k]
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="totals">
              <td>合計{result.teamNotes.length > 0 && ' ※'}</td>
              {STAT_KEYS.map((k) => (
                <td key={k}>{result.totals[k]}</td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
      {result.teamNotes.map((n, i) => (
        <div key={i} className="team-note">
          ※ {n}
        </div>
      ))}
    </div>
  );
}

/** 出した3枚の「5つの力」を棒グラフで見える化（多面的に強み・弱みを掴む） */
function BalanceBars({ totals, spotlight }: { totals: Stats; spotlight: keyof Stats }) {
  const max = Math.max(1, ...STAT_KEYS.map((k) => totals[k]));
  return (
    <div className="balance-bars">
      <div className="balance-title">5つの力のバランス</div>
      {STAT_KEYS.map((k) => (
        <div key={k} className={`balance-row ${k === spotlight ? 'spot' : ''}`}>
          <span className="balance-label">
            {STAT_LABELS[k]}
            {k === spotlight && ' ★'}
          </span>
          <span className="balance-track">
            <span className="balance-fill" style={{ width: `${(totals[k] / max) * 100}%` }} />
          </span>
          <span className="balance-num">{totals[k]}</span>
        </div>
      ))}
    </div>
  );
}
