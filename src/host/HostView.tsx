// 教員用モニター画面（全対戦の進行状況を一覧・プロジェクター投影用）

import { useEffect, useState } from 'react';
import type { MatchState } from '../../shared/types';
import { socket, useGameState, useServerError } from '../socket';

const PHASE_LABEL: Record<MatchState['phase'], string> = {
  waiting: '相手待ち',
  play: '対戦中',
  judged: '判定済み',
  finished: '終了',
};

export function HostView() {
  const state = useGameState();
  const error = useServerError();
  const [matchCount, setMatchCount] = useState(10);
  const [totalRounds, setTotalRounds] = useState(3);
  const [withEvents, setWithEvents] = useState(false); // 初期は「やさしい」
  const [lanUrls, setLanUrls] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/info')
      .then((r) => r.json())
      .then((d) => setLanUrls(d.urls ?? []))
      .catch(() => {});
  }, []);

  // 生徒に案内する参加URL:
  // - デプロイ版（localhost以外で開いている）→ この画面と同じ公開URLを使う
  // - ローカル起動（localhostで開いている）→ タブレットからはlocalhostが使えないのでLAN内IPを使う
  const origin = window.location.origin;
  const isLocal = /localhost|127\.0\.0\.1/.test(origin);
  const shareBase = isLocal ? (lanUrls[0] ?? origin) : origin;
  const joinUrl = `${shareBase}/#/play`;
  const urls = isLocal ? lanUrls : [origin];

  if (!state) return <div className="loading">サーバーに接続中…</div>;

  if (!state.started) {
    return (
      <div className="lobby">
        <h1 className="app-title">発電王</h1>
        <p className="app-subtitle">目指せ最高のエネルギーミックス（1対1対戦）</p>
        {error && <div className="toast">{error}</div>}
        <div className="lobby-form">
          <label>
            対戦数（最大10）
            <select value={matchCount} onChange={(e) => setMatchCount(+e.target.value)}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n}卓（{n * 2}人）
                </option>
              ))}
            </select>
          </label>
          <label>
            ラウンド数
            <select value={totalRounds} onChange={(e) => setTotalRounds(+e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            モード
            <select value={withEvents ? 'normal' : 'easy'} onChange={(e) => setWithEvents(e.target.value === 'normal')}>
              <option value="easy">やさしい（イベントなし）</option>
              <option value="normal">ふつう（イベントあり）</option>
            </select>
          </label>
          <button
            className="btn primary big"
            onClick={() => socket.emit('host:setup', { matchCount, totalRounds, withEvents })}
          >
            ゲーム開始
          </button>
        </div>
        <div className="url-hint">
          Chromebookからのアクセス先: <b>{joinUrl}</b>
          {isLocal && urls.length > 1 && (
            <div>（つながらない場合は {urls.slice(1).map((u) => `${u}/#/play`).join(' / ')} も試してください）</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="host">
      {error && <div className="toast">{error}</div>}
      <header className="host-header">
        <h1 className="app-title small">発電王 モニター</h1>
        <span className="url-hint small">参加URL: {joinUrl}</span>
        <button
          className="btn tiny"
          onClick={() => {
            if (window.confirm('全対戦をリセットします。よろしいですか？')) {
              socket.emit('host:reset');
            }
          }}
        >
          全対戦リセット
        </button>
      </header>

      <div className="monitor-grid">
        {state.matches.map((m) => (
          <MatchCell key={m.id} match={m} totalRounds={state.totalRounds} />
        ))}
      </div>
    </div>
  );
}

function MatchCell({ match, totalRounds }: { match: MatchState; totalRounds: number }) {
  const [a, b] = match.players;
  const winner =
    match.phase === 'finished'
      ? a.score > b.score
        ? a
        : b.score > a.score
          ? b
          : null
      : null;

  return (
    <div className={`monitor-cell phase-${match.phase}`}>
      <div className="monitor-cell-head">
        <span className="monitor-match-id">対戦 {match.id}</span>
        <span className="monitor-phase">{PHASE_LABEL[match.phase]}</span>
        {match.phase !== 'waiting' && (
          <span className="monitor-round">
            R{Math.max(match.round, 1)}/{totalRounds}
          </span>
        )}
      </div>
      <div className="monitor-players">
        {match.players.map((p) => (
          <div key={p.seat} className={`monitor-player ${p.connected > 0 ? 'online' : ''}`}>
            <span className="monitor-player-name">
              {p.claimed ? p.name : `席${p.seat}（あき）`}
            </span>
            <span className="monitor-player-status">
              {match.phase === 'play' && (p.submission ? '✅提出' : '検討中')}
              {(match.phase === 'judged' || match.phase === 'finished') && `${p.score}pt`}
            </span>
          </div>
        ))}
      </div>
      {match.mission && match.phase !== 'finished' && (
        <div className="monitor-mission">
          📋 {match.mission.title}
          {match.event && <> ／ ⚡ {match.event.title}</>}
        </div>
      )}
      {match.phase === 'judged' && match.results && (
        <div className="monitor-verdict">
          {match.results.find((r) => r.winner)
            ? `🏆 ${match.results.find((r) => r.winner)!.playerName}`
            : match.results.some((r) => r.draw)
              ? '引き分け'
              : '両者未達成'}
        </div>
      )}
      {match.phase === 'finished' && (
        <div className="monitor-verdict">{winner ? `👑 ${winner.name} 勝利！` : '引き分け！'}</div>
      )}
    </div>
  );
}
