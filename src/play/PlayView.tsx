// プレイヤー画面（各生徒のChromebook用・1対1対戦）

import { useEffect, useState } from 'react';
import { PLANT_CARDS } from '../../shared/data';
import { hasOptionalEffect } from '../../shared/engine';
import type { MatchState, PlantCard, Seat } from '../../shared/types';
import { socket, useGameState, useHand, useServerError } from '../socket';
import { CardBack, CardChip, EventPanel, MissionPanel, ResultDetail } from '../components/shared';
import { HowToPlay } from '../HowToPlay';

const STORAGE_KEY = 'hatsuden-player';
const cardById = (id: string): PlantCard => PLANT_CARDS.find((c) => c.id === id)!;

interface SavedSeat {
  matchId: number;
  seat: Seat;
  name: string;
}

const loadSaved = (): SavedSeat | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedSeat) : null;
  } catch {
    return null;
  }
};

export function PlayView() {
  const state = useGameState();
  const hand = useHand(); // この端末のプレイヤーの手札6枚
  const error = useServerError();
  const [saved, setSaved] = useState<SavedSeat | null>(loadSaved);
  const [nameInput, setNameInput] = useState(saved?.name ?? '');
  const [selected, setSelected] = useState<string[]>([]); // 場に出す3枚
  const [optionalOn, setOptionalOn] = useState<string[]>([]);
  const [mulliganMode, setMulliganMode] = useState(false);
  const [swapSel, setSwapSel] = useState<string[]>([]); // 交換するカード
  const [showHelp, setShowHelp] = useState(false);

  // 再接続・リロード時に自動で同じ席へ戻る
  useEffect(() => {
    if (saved && state?.started) {
      socket.emit('player:join', { matchId: saved.matchId, seat: saved.seat, name: saved.name });
    }
  }, [saved, state?.started]);

  const match: MatchState | null =
    saved && state ? (state.matches.find((m) => m.id === saved.matchId) ?? null) : null;

  // ラウンドが変わった／手札が変わったら選択をリセット
  const round = match?.round;
  useEffect(() => {
    setSelected([]);
    setOptionalOn([]);
    setSwapSel([]);
    setMulliganMode(false);
  }, [round, saved?.matchId, hand.join(',')]);

  if (!state) return <div className="loading">サーバーに接続中…</div>;

  if (!state.started) {
    return (
      <div className="waiting-screen">
        <h1 className="app-title">発電王</h1>
        <p>先生がゲームを開始するまで待っていてね</p>
      </div>
    );
  }

  // ---- 対戦・席選び ----
  if (!saved || !match) {
    return (
      <div className="join-screen">
        {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
        <h1 className="app-title">発電王</h1>
        {error && <div className="toast">{error}</div>}
        <p>名前を入れて、あいている席を選んでね</p>
        <button className="btn" onClick={() => setShowHelp(true)}>
          📖 あそびかたを見る
        </button>
        <input
          className="name-input"
          placeholder="なまえ（省略OK）"
          maxLength={12}
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
        />
        <div className="match-join-grid">
          {state.matches.map((m) => (
            <div key={m.id} className="match-join-cell">
              <div className="match-join-title">対戦 {m.id}</div>
              <div className="seat-buttons">
                {m.players.map((p) => (
                  <button
                    key={p.seat}
                    className={`btn seat ${p.claimed ? 'taken' : 'free'}`}
                    disabled={p.claimed}
                    onClick={() => {
                      const s: SavedSeat = { matchId: m.id, seat: p.seat, name: nameInput };
                      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
                      setSaved(s);
                      socket.emit('player:join', {
                        matchId: m.id,
                        seat: p.seat,
                        name: nameInput,
                      });
                    }}
                  >
                    {p.claimed ? p.name : `席${p.seat} あき`}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const me = match.players.find((p) => p.seat === saved.seat)!;
  const opponent = match.players.find((p) => p.seat !== saved.seat)!;
  // やさしいモードはイベント不要。ふつうモードはミッション＋イベント両方めくれたら準備完了
  const ready = !!match.mission && (!state.withEvents || !!match.event);

  const toggleCard = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        setOptionalOn((o) => o.filter((x) => x !== id));
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const leaveSeat = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSaved(null);
  };

  const myResult = match.results?.find((r) => r.seat === me.seat) ?? null;
  const oppResult = match.results?.find((r) => r.seat === opponent.seat) ?? null;

  return (
    <div className="play">
      {error && <div className="toast">{error}</div>}
      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
      <header className="group-header">
        <span className="group-name">
          対戦{match.id}　{me.name} <span className="vs">vs</span> {opponent.name}
          {!opponent.claimed && '（待機中）'}
        </span>
        <span className="round-indicator">
          ラウンド {Math.max(match.round, 1)} / {state.totalRounds}
        </span>
        <button className="btn tiny" onClick={() => setShowHelp(true)}>
          📖 あそびかた
        </button>
        <button className="btn tiny" onClick={leaveSeat}>
          席をはなれる
        </button>
      </header>

      {match.phase === 'waiting' && (
        <div className="waiting-screen">
          <p>対戦相手が席につくのを待っています…</p>
          <p className="hint">同じ「対戦{match.id}」のもう一つの席に相手が入ると始まるよ</p>
        </div>
      )}

      {match.phase !== 'waiting' && (
        <div className={state.withEvents ? 'panels' : 'panels single'}>
          <MissionPanel mission={match.mission} />
          {state.withEvents && <EventPanel event={match.event} />}
        </div>
      )}

      {match.phase === 'play' && (
        <div className="table-info">
          <div className="opp-hand">
            <span className="table-label">{opponent.name}の手札</span>
            <span className="back-row">
              {Array.from({ length: opponent.handSize }).map((_, i) => (
                <CardBack key={i} small />
              ))}
              {opponent.handSize === 0 && <span className="hint">（待機中）</span>}
            </span>
          </div>
          <div className="deck-info">
            <span className="table-label">山札</span>
            <CardBack small />
            <span className="deck-count">{match.deckLeft}</span>
          </div>
        </div>
      )}

      {match.phase === 'play' && !ready && (
        <div className="reveal-actions">
          {!match.mission && (
            <button className="btn primary big" onClick={() => socket.emit('player:reveal', 'mission')}>
              ミッションをめくる（残り{match.missionDeckLeft}）
            </button>
          )}
          {state.withEvents && match.mission && !match.event && (
            <button className="btn primary big" onClick={() => socket.emit('player:reveal', 'event')}>
              イベントをめくる（残り{match.eventDeckLeft}）
            </button>
          )}
          <p className="hint">どちらのプレイヤーがめくってもOK</p>
        </div>
      )}

      {match.phase === 'play' && ready && !me.submission && mulliganMode && (
        <div className="picker">
          <div className="panel-title">
            交換するカードを選ぼう（{swapSel.length} / 最大4枚）
          </div>
          <p className="hint">選んだカードが山札のカードと入れ替わります（1回だけ）</p>
          <div className="hand-grid">
            {hand.map((id) => {
              const c = cardById(id);
              return (
                <CardChip
                  key={id}
                  card={c}
                  selected={swapSel.includes(id)}
                  onClick={() =>
                    setSwapSel((prev) =>
                      prev.includes(id)
                        ? prev.filter((x) => x !== id)
                        : prev.length >= 4
                          ? prev
                          : [...prev, id],
                    )
                  }
                />
              );
            })}
          </div>
          <div className="button-row">
            <button
              className="btn primary big"
              disabled={swapSel.length === 0}
              onClick={() => socket.emit('player:mulligan', swapSel)}
            >
              選んだ{swapSel.length}枚を交換する
            </button>
            <button className="btn" onClick={() => { setMulliganMode(false); setSwapSel([]); }}>
              やめる
            </button>
          </div>
        </div>
      )}

      {match.phase === 'play' && ready && !me.submission && !mulliganMode && (
        <div className="picker">
          <div className="panel-title">
            手札からベスト3枚を選ぼう（{selected.length} / 3枚）
          </div>
          <p className="hint">
            ⚠ どれかの力が低すぎる（3枚合計6以下）と、その力を大事にする人から<b>苦情</b>が来て減点！
            バランスも考えよう
          </p>
          {!me.mulliganUsed && (
            <button className="btn mulligan" onClick={() => setMulliganMode(true)}>
              🔄 手札を交換する（1回だけ・最大4枚）
            </button>
          )}
          <div className="hand-grid">
            {hand.map((id) => {
              const c = cardById(id);
              return (
                <CardChip
                  key={id}
                  card={c}
                  selected={selected.includes(id)}
                  onClick={() => toggleCard(id)}
                />
              );
            })}
          </div>

          {selected.some((id) => hasOptionalEffect(cardById(id))) && (
            <div className="optional-effects">
              <div className="panel-title">特殊効果を使う？（【バックアップ】など）</div>
              {selected
                .map(cardById)
                .filter(hasOptionalEffect)
                .map((c) => (
                  <label key={c.id} className="optional-toggle">
                    <input
                      type="checkbox"
                      checked={optionalOn.includes(c.id)}
                      onChange={(e) =>
                        setOptionalOn((prev) =>
                          e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                        )
                      }
                    />
                    <span>
                      <b>{c.name}</b> 【{c.effect!.keyword}】を発動する
                    </span>
                  </label>
                ))}
              <div className="hint">条件を満たしていない場合は発動しません（判定時に表示されます）</div>
            </div>
          )}

          <button
            className="btn primary big"
            disabled={selected.length === 0}
            onClick={() => socket.emit('player:submit', { cardIds: selected, optionalOn })}
          >
            この{selected.length}枚で提出する
          </button>
          <div className="hint">
            {opponent.submission ? `${opponent.name}は提出済み！` : `${opponent.name}も選んでいます…`}
          </div>
        </div>
      )}

      {match.phase === 'play' && me.submission && (
        <div className="submitted">
          <div className="submitted-mark">✅ 提出済み</div>
          <div className="submitted-cards">
            {me.submission.cardIds.map((id) => {
              const c = PLANT_CARDS.find((c) => c.id === id)!;
              return (
                <div key={id} className="submitted-card">
                  {c.name}
                  {me.submission!.optionalOn.includes(id) && (
                    <span className="submitted-effect">【{c.effect?.keyword}】発動</span>
                  )}
                </div>
              );
            })}
          </div>
          <p>{opponent.name}の提出を待っています…（そろったら自動で判定）</p>
          <button
            className="btn"
            onClick={() => {
              setSelected(me.submission!.cardIds);
              setOptionalOn(me.submission!.optionalOn);
              socket.emit('player:retract');
            }}
          >
            出し直す
          </button>
        </div>
      )}

      {match.phase === 'judged' && match.mission && myResult && oppResult && (
        <div className="results">
          <div className="verdict-banner">
            {myResult.winner && '🏆 このラウンドはあなたの勝ち！'}
            {oppResult.winner && `このラウンドは${opponent.name}の勝ち`}
            {myResult.draw && '引き分け！'}
          </div>
          <ResultDetail result={myResult} mission={match.mission} />
          <ResultDetail result={oppResult} mission={match.mission} />
          <div className="reflect">
            <b>🤔 考えてみよう（答えはみんなで話そう）</b>
            <p className="reflect-q">{match.mission.question}</p>
            {match.event?.question && <p className="reflect-q">{match.event.question}</p>}
          </div>
          <div className="score-line">
            通算: {me.name} {me.score}pt − {opponent.name} {opponent.score}pt
          </div>
          <button className="btn primary big" onClick={() => socket.emit('player:next')}>
            {match.round >= state.totalRounds ? '最終結果へ' : '次のラウンドへ'}
          </button>
        </div>
      )}

      {match.phase === 'finished' && (
        <div className="finished">
          <h2>対戦終了！</h2>
          <FinalVerdict meScore={me.score} oppScore={opponent.score} meName={me.name} oppName={opponent.name} />
          <div className="score-line">
            {me.name} {me.score}pt − {opponent.name} {opponent.score}pt
          </div>
          <div className="reflect">
            <b>🤔 みんなで考えよう</b>
            <p className="reflect-q">
              いろんな立場の人が、それぞれちがう電気を求めていたね。
              「これ1枚あれば全部かなう」という完ぺきな発電所は、あったかな？
            </p>
            <p className="reflect-q">
              なぜ日本は、1種類ではなく<b>いろいろな発電を組み合わせて（エネルギーミックス）</b>電気をつくっているのだろう？
            </p>
          </div>
          <p className="hint">先生の合図があるまで待っていてね</p>
        </div>
      )}
    </div>
  );
}

function FinalVerdict({
  meScore,
  oppScore,
  meName,
  oppName,
}: {
  meScore: number;
  oppScore: number;
  meName: string;
  oppName: string;
}) {
  if (meScore > oppScore) return <div className="final-verdict win">👑 {meName}の勝利！</div>;
  if (meScore < oppScore) return <div className="final-verdict lose">{oppName}の勝利！</div>;
  return <div className="final-verdict draw">引き分け！</div>;
}
