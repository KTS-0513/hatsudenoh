// あそびかた・ルール説明（トップ画面と、プレイ中のオーバーレイの両方で使う）
// onClose があればオーバーレイ（×で閉じる）、なければ単独ページ（ホームに戻るリンク）として表示。

import { STAT_LABELS } from '../shared/types';

const STAT_MEANING: Record<string, string> = {
  output: 'どれだけ多くの電気をつくれるか',
  safety: '事故が少なく、止まりにくいか',
  selfSufficiency: '日本国内の資源でまかなえるか（輸入にたよらないか）',
  efficiency: '安く・むだなく発電できるか（コスト）',
  environment: 'CO₂が少なく、自然にやさしいか',
};

export function HowToPlay({ onClose }: { onClose?: () => void }) {
  return (
    <div className={onClose ? 'howto-overlay' : 'howto-page'}>
      <div className="howto-card">
        <div className="howto-head">
          <h1 className="howto-title">📖 発電王 あそびかた</h1>
          {onClose ? (
            <button className="btn tiny" onClick={onClose}>
              × とじる
            </button>
          ) : (
            <a className="btn tiny" href="#/">
              ← ホーム
            </a>
          )}
        </div>

        <section className="howto-sec">
          <h2>🎯 どんなゲーム？</h2>
          <p>
            発電所カードを組み合わせて、社会の「電気がほしい！」という願いにこたえるゲームです。
            でも、どの発電所にも<b>強いところと弱いところ</b>があります。
            うまく組み合わせて（＝<b>エネルギーミックス</b>）、いちばん良い電気の組み合わせを目指しましょう。
          </p>
        </section>

        <section className="howto-sec">
          <h2>🕹️ あそびの流れ</h2>
          <ol className="howto-steps">
            <li>2人で対戦。あいている「席」を選んで入る</li>
            <li>
              <b>ミッション</b>が出る（例：🏭工場長「たくさん電気がほしい！」）。「今回の注目」の力が
              <b>2倍</b>で点数になる
            </li>
            <li>手札が<b>6枚</b>配られる</li>
            <li>
              <b>1回だけ</b>、いらないカードを最大4枚まで交換できる（手札チェンジ）
            </li>
            <li>
              手札から<b>ベスト3枚</b>を選んで出す
            </li>
            <li>2人が出したら自動で点数がつき、点が高いほうの勝ち！</li>
          </ol>
        </section>

        <section className="howto-sec">
          <h2>🏆 点数の決まり方</h2>
          <ul className="howto-points">
            <li>出した3枚の「5つの力」を全部合計</li>
            <li>
              <b>今回の注目</b>の力は、もう一度たされる（＝実質2倍）
            </li>
            <li>
              <b>3種類ちがう発電所</b>を混ぜると「エネルギーミックス・ボーナス」＋6点！
            </li>
            <li>
              ⚠ どれかの力が<b>低すぎる（3枚合計6以下）</b>と、その力を大事にする人から
              <b>苦情</b>が来て<b>−4点</b>！
            </li>
          </ul>
          <p className="howto-tip">
            💡 1つの力だけを追いかけると、切り捨てた力のことで<b>だれかが困って苦情</b>が来ます。
            何かを取ると何かを失う（＝トレードオフ）。だから<b>バランスよく混ぜる</b>のがコツです。
          </p>
        </section>

        <section className="howto-sec">
          <h2>⚡ カードの「5つの力」</h2>
          <ul className="howto-stats">
            {(Object.keys(STAT_MEANING) as (keyof typeof STAT_MEANING)[]).map((k) => (
              <li key={k}>
                <b>{STAT_LABELS[k as keyof typeof STAT_LABELS]}</b>：{STAT_MEANING[k]}
              </li>
            ))}
          </ul>
        </section>

        <section className="howto-sec">
          <h2>🌦️ イベント（ふつうモードのとき）</h2>
          <p>
            長雨で太陽光が止まったり、風がやんで風力が止まったり…天気や世界のできごとが起きます。
            「1つの発電方法だけにたよると、こまる日がある」＝だから<b>混ぜる</b>ことが大事、と気づけます。
          </p>
        </section>

        {!onClose && (
          <div className="howto-foot">
            <a className="btn primary big" href="#/play">
              対戦に参加する
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
