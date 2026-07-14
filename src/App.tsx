import { useEffect, useState } from 'react';
import { HostView } from './host/HostView';
import { PlayView } from './play/PlayView';
import { HowToPlay } from './HowToPlay';
import { LogoImage } from './components/shared';

// react-routerを使わないシンプルなハッシュルーティング
// #/host → 教員用モニター / #/play → プレイヤー画面（Chromebook）
function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export function App() {
  const hash = useHashRoute();
  if (hash.startsWith('#/host')) return <HostView />;
  if (hash.startsWith('#/play') || hash.startsWith('#/group')) return <PlayView />;
  if (hash.startsWith('#/how')) return <HowToPlay />;
  return <Landing />;
}

function Landing() {
  return (
    <div className="landing">
      <LogoImage />
      <h1 className="app-title">発電王</h1>
      <p className="app-subtitle">目指せ最高のエネルギーミックス</p>

      <div className="landing-howto">
        <p className="landing-lead">
          発電所カードを組み合わせて、社会の願いにこたえる対戦ゲーム。
          <br />
          どの発電所にも強み・弱みがあるから、<b>うまく“混ぜる”</b>のがコツ！
        </p>
        <ol className="landing-steps">
          <li>
            <span className="step-no">1</span>手札6枚から<b>ベスト3枚</b>を選ぶ
          </li>
          <li>
            <span className="step-no">2</span>「5つの力」の合計＋<b>今回の注目</b>で点数
          </li>
          <li>
            <span className="step-no">3</span>低すぎる力があると<b>苦情で減点</b>。バランス大事！
          </li>
        </ol>
      </div>

      <div className="landing-buttons">
        <a className="btn primary big" href="#/play">
          対戦に参加する（生徒用）
        </a>
        <a className="btn big" href="#/how">
          📖 くわしいあそびかた
        </a>
        <a className="btn big" href="#/host">
          先生用モニター
        </a>
      </div>
    </div>
  );
}
