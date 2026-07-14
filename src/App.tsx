import { useEffect, useState } from 'react';
import { HostView } from './host/HostView';
import { PlayView } from './play/PlayView';
import { HowToPlay } from './HowToPlay';

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
      <h1 className="app-title">発電王</h1>
      <p className="app-subtitle">目指せ最高のエネルギーミックス</p>
      <div className="landing-buttons">
        <a className="btn primary big" href="#/play">
          対戦に参加する（生徒用）
        </a>
        <a className="btn big" href="#/how">
          📖 あそびかた
        </a>
        <a className="btn big" href="#/host">
          先生用モニター
        </a>
      </div>
    </div>
  );
}
