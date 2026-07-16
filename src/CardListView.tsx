// カードいちらん（図鑑）。全発電所カードをカテゴリごとに表示する
import { useState } from 'react';
import { PLANT_CARDS } from '../shared/data';
import type { PlantCard } from '../shared/types';
import { CardChip, CardDetail } from './components/shared';

// カテゴリの表示順（ゲーム内で使う分類にそろえる）
const CATEGORY_ORDER = ['再生可能', '系統安定', '次世代GX', '化石燃料', '石油燃料', '熱利用'];

function sortedCategories(): string[] {
  const seen = new Set(PLANT_CARDS.map((c) => c.category));
  const ordered = CATEGORY_ORDER.filter((c) => seen.has(c));
  // 一覧に想定外のカテゴリがあれば末尾に足す
  const extras = [...seen].filter((c) => !CATEGORY_ORDER.includes(c));
  return [...ordered, ...extras];
}

export function CardListView() {
  const [zoomId, setZoomId] = useState<string | null>(null);
  const categories = sortedCategories();
  const zoomCard: PlantCard | undefined = PLANT_CARDS.find((c) => c.id === zoomId);

  return (
    <div className="cardlist">
      {zoomCard && <CardDetail card={zoomCard} onClose={() => setZoomId(null)} />}

      <div className="cardlist-head">
        <a className="btn tiny" href="#/">
          ← もどる
        </a>
        <h1 className="cardlist-title">🃏 カードいちらん（全{PLANT_CARDS.length}枚）</h1>
        <p className="cardlist-lead">
          発電所ごとの「5つの力」と効果を見て、作戦を考えよう。「🔍 大きく」で拡大できます。
        </p>
      </div>

      {categories.map((cat) => {
        const cards = PLANT_CARDS.filter((c) => c.category === cat);
        return (
          <section key={cat} className="cardlist-section">
            <h2 className="cardlist-cat">
              {cat}
              <span className="cardlist-cat-count">{cards.length}枚</span>
            </h2>
            <div className="hand-grid">
              {cards.map((card) => (
                <CardChip key={card.id} card={card} onZoom={() => setZoomId(card.id)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
