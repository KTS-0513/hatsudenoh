// 「発電王」マスタデータ
// 数値・文言はすべてこのファイルだけで調整できる。
//
// ★ ステータスについて
//   提出済みカードのレーダーチャートから読み取った値（±1の読み違いがありうるので、
//   おかしい値があればここを直す）。placeholder: true のカードは未提出のため仮数値。

import type { EventCard, MissionCard, PlantCard } from './types';

// ---- 発電所カード（20種: 提出済み15 + 未提出5） ----

export const PLANT_CARDS: PlantCard[] = [
  // ===== 化石燃料・バイオマス・熱利用 =====
  {
    id: 'coal',
    name: '石炭火力発電所',
    category: '化石燃料',
    catchCopy: '安価・安定な日本の主電力',
    tags: ['thermal', 'coal', 'high-co2', 'large-scale'],
    stats: { output: 5, safety: 3, selfSufficiency: 1, efficiency: 5, environment: 1 },
    effect: {
      kind: 'baseload',
      keyword: 'ベースロード',
      text: 'このカードは、すべての『天候・気候イベント』の効果を受けない。',
    },
  },
  {
    id: 'lng',
    name: 'LNG火力発電所',
    category: '系統安定',
    catchCopy: 'ナチュラル・ガス・オブ・パワー',
    tags: ['thermal', 'lng'],
    stats: { output: 5, safety: 4, selfSufficiency: 2, efficiency: 5, environment: 2 },
    effect: {
      kind: 'backup-lng',
      keyword: 'バックアップ',
      text: 'もし自分か他のプレイヤーの再エネカードが停止した時、このカードの発電量を『+4』できる。',
      optional: true,
      amount: 4,
    },
  },
  {
    id: 'oil',
    name: '石油火力発電所',
    category: '石油燃料',
    catchCopy: 'ピンチになったらおまかせあれ！',
    tags: ['thermal', 'oil', 'high-co2'],
    stats: { output: 5, safety: 3, selfSufficiency: 1, efficiency: 4, environment: 1 },
    effect: {
      kind: 'backup-oil',
      keyword: 'バックアップ',
      text: '自分の場に出ている発電所カード・再生エネルギーが停止、または天候が冬の場合使用可。このカードの発電量を＋5（燃料価格の高騰の場合は＋3）にできる。',
      optional: true,
      amountDefault: 5,
      amountFuelSurge: 3,
    },
  },
  {
    id: 'biomass',
    name: '木質バイオマス発電所',
    category: '次世代GX',
    catchCopy: '邪魔な木はすべてこちらへ',
    tags: ['renewable', 'biomass', 'thermal'],
    stats: { output: 2, safety: 2, selfSufficiency: 3, efficiency: 2, environment: 5 },
    effect: {
      kind: 'baseload',
      keyword: 'ベースロード',
      text: '天候・気候に影響されない。',
    },
  },
  {
    id: 'waste',
    name: '廃棄物発電所',
    category: '化石燃料',
    catchCopy: 'ゴミを電気に変える！',
    tags: ['waste', 'thermal'],
    stats: { output: 1, safety: 4, selfSufficiency: 4, efficiency: 4, environment: 1 },
    effect: {
      kind: 'baseload',
      keyword: 'ベースロード',
      text: 'このカードは、すべての『天気・天候イベント』の効果を受けない。',
    },
  },
  {
    id: 'cogen',
    name: '工場排熱回収発電',
    category: '化石燃料', // カードの表記どおり（要確認: 熱利用系のカードだが化石燃料と印字されている）
    catchCopy: '捨てられる熱を電気に変える',
    tags: ['cogen', 'thermal'],
    stats: { output: 1, safety: 5, selfSufficiency: 5, efficiency: 1, environment: 5 },
    effect: {
      kind: 'synergy',
      keyword: 'シナジー',
      // カードの表記は『＋21』だが、能力値が0〜5のゲームでは桁違いのため+2の書き間違いと解釈（要確認）
      text: 'もしその場に『熱』（火力系カード）がある時、その『効率性』を『＋2』する。',
      requireTags: ['thermal'],
      stat: 'efficiency',
      add: 2,
    },
  },

  // ===== 自然エネルギー（再エネ） =====
  {
    id: 'res-solar',
    name: '太陽光発電所（住宅用）',
    category: '再生可能',
    catchCopy: '元を取ったら、お金儲け！？',
    tags: ['renewable', 'solar'],
    stats: { output: 1, safety: 5, selfSufficiency: 4, efficiency: 3, environment: 5 },
    effect: {
      kind: 'weather-dependent',
      keyword: 'お天気依存',
      text: 'もしイベントカードで『長雨』が起きたら、このカードの発電量を『0』にする。',
    },
  },
  {
    id: 'mega-solar',
    name: 'メガソーラー（大規模太陽光）',
    category: '再生可能',
    catchCopy: 'お日さまの力でみんなの笑顔をチャージしたりますぜ',
    tags: ['renewable', 'solar'],
    stats: { output: 3, safety: 1, selfSufficiency: 2, efficiency: 5, environment: 3 },
    effect: {
      kind: 'weather-dependent',
      keyword: 'お天気依存',
      text: 'メガソーラーは天気の影響が非常に高い。もしイベントカードで天気影響が起きたら、この発電力を0にする。',
    },
    zeroOnEvents: ['no-wind'], // カードの効果文により、長雨・台風(solarタグ)に加えて無風でも停止する
  },
  {
    id: 'onshore-wind',
    name: '大型風力発電所（陸上）',
    category: '再生可能',
    catchCopy: '環境にもmoneyにも優しい！',
    tags: ['renewable', 'wind'],
    stats: { output: 3, safety: 3, selfSufficiency: 5, efficiency: 3, environment: 5 },
    // カードの効果文には「長雨や無風が起きたら0」とあるが、現実に即して無風（と台風）のみで停止に修正済み
    effect: {
      kind: 'weather-dependent',
      keyword: 'お天気依存',
      text: 'もしイベントカードで『無風』が起きたら、このカードの発電量を『0』にする。',
    },
  },
  {
    id: 'fixed-offshore-wind',
    name: '洋上風力発電所（着床式）',
    category: '再生可能',
    catchCopy: '浅い海に支柱を立てる。陸より強く安定した風。',
    tags: ['renewable', 'wind'],
    stats: { output: 5, safety: 4, selfSufficiency: 4, efficiency: 3, environment: 2 },
    // カードの表記は「天候・気候イベントの効果を受けない」だが、風力が天候無効は不自然なため
    // 他の風力と同じ「無風・台風で停止」に修正済み
    effect: {
      kind: 'weather-dependent',
      keyword: 'お天気依存',
      text: 'もしイベントカードで『無風』が起きたら、このカードの発電量を『0』にする。',
    },
  },
  {
    id: 'offshore-wind',
    name: '洋上風力発電所（浮体式）',
    category: '再生可能',
    catchCopy: '潮風で風車を回し、島国の日本のエネルギーを回す。',
    tags: ['renewable', 'wind'],
    stats: { output: 1, safety: 4, selfSufficiency: 5, efficiency: 1, environment: 5 },
    effect: {
      kind: 'weather-dependent',
      keyword: 'お天気依存',
      text: 'もしイベントカードで『無風』が起きたら、このカードの発電量を『0』にする。',
    },
  },
  {
    id: 'geothermal',
    name: '地熱発電所',
    category: '再生可能', // カードの印字は「化石燃料」だがテンプレートの直し忘れと思われるため再生可能で実装（要確認）
    catchCopy: '噴き出す高温',
    tags: ['renewable', 'geothermal', 'baseload-power'],
    stats: { output: 3, safety: 4, selfSufficiency: 3, efficiency: 3, environment: 2 },
    // カードの特殊効果欄は「太陽光の発電量がすべて0になる。」と書かれているが、
    // イベント（長雨）の効果文が混入したものと思われるため未実装（要確認）
  },
  {
    id: 'binary',
    name: '温泉排水バイナリー発電',
    category: '再生可能',
    catchCopy: '一石二鳥 〜身体と財布温めます〜',
    tags: ['renewable', 'geothermal'],
    stats: { output: 1, safety: 5, selfSufficiency: 4, efficiency: 3, environment: 4 },
    effect: {
      kind: 'synergy',
      keyword: 'シナジー',
      text: '温泉地でのみ使える発電方法。もし自分の場に『地熱発電所』があったら、このカードの発電量を『+5』する。',
      requireTags: ['geothermal'], // 自分自身は数えないため、実質「地熱発電所と組み合わせた時のみ」
      stat: 'output',
      add: 5,
    },
  },
  // ※中小水力・一般水力(ダム式)はカード未提出のため、他カードとのバランスを見てアプリ側で数値を設定した
  {
    id: 'small-hydro',
    name: '中小水力発電所（流れ込み式）',
    category: '再生可能',
    catchCopy: 'ダムを作らず川の流れをそのまま利用',
    tags: ['renewable', 'hydro', 'hydro-boost', 'baseload-power'],
    stats: { output: 2, safety: 5, selfSufficiency: 5, efficiency: 3, environment: 5 },
  },
  {
    id: 'dam-hydro',
    name: '一般水力発電所（ダム式）',
    category: '再生可能',
    catchCopy: '安定供給・国産エネルギーの代表格',
    tags: ['renewable', 'hydro', 'hydro-boost', 'large-scale', 'baseload-power'],
    stats: { output: 3, safety: 4, selfSufficiency: 5, efficiency: 4, environment: 4 },
    effect: {
      kind: 'baseload',
      keyword: 'ベースロード',
      text: 'どんな天候でも変わらず発電することができる。',
    },
  },

  // ===== 系統安定・調整 =====
  {
    id: 'pumped-hydro',
    name: '揚水発電所',
    category: '系統安定',
    catchCopy: '大きな蓄電池！！',
    tags: ['hydro', 'hydro-boost', 'stabilizer'],
    stats: { output: 3, safety: 3, selfSufficiency: 3, efficiency: 4, environment: 5 },
    effect: {
      kind: 'backup-pumped',
      keyword: 'バックアップ',
      // カードの「+4（または+2）」の条件を「くみ上げ用の電気を確保できているか」で設定:
      // 場に他の稼働中カードがあれば+4、揚水単独なら+2（水をくみ上げる電気が足りない）
      text: 'もし自分か他のプレイヤーの再エネカードが停止した時、このカードの発電量を『＋4』できる。（自分の場に他に稼働中の発電所がない場合は、水をくみ上げる電気が足りないため『＋2』）',
      optional: true,
      amountFull: 4,
      amountLow: 2,
    },
  },
  {
    id: 'grid-battery',
    name: '産業用大型蓄電池システム（系統用蓄電池）',
    category: '系統安定',
    catchCopy: '再生可能エネルギーを支える',
    tags: ['stabilizer'],
    stats: { output: 1, safety: 5, selfSufficiency: 2, efficiency: 1, environment: 5 },
    effect: {
      kind: 'synergy',
      keyword: 'シナジー',
      text: 'もし場に太陽光発電があり晴れだった場合、効率性を＋2あげる。',
      requireTags: ['solar'],
      requireSunny: true,
      stat: 'efficiency',
      add: 2,
    },
  },

  // ===== 脱炭素・GX最新技術 =====
  {
    id: 'nuclear',
    name: '原子力発電所',
    category: '次世代GX',
    catchCopy: '少ない燃料で24時間安定発電！',
    tags: ['nuclear', 'large-scale', 'baseload-power'],
    stats: { output: 5, safety: 2, selfSufficiency: 4, efficiency: 5, environment: 5 },
    effect: {
      kind: 'baseload',
      keyword: 'ベースロード',
      text: 'どんな天候でも変わらず発電することができる。',
    },
  },
  {
    id: 'ammonia-h2',
    name: 'アンモニア・水素混焼火力発電',
    category: '次世代GX',
    catchCopy: '安全な発電所',
    tags: ['thermal', 'gx'],
    // カードのレーダーは最大値4表記のため読み取り値（要確認）
    stats: { output: 3, safety: 4, selfSufficiency: 3, efficiency: 2, environment: 3 },
    effect: {
      kind: 'baseload',
      keyword: 'ベースロード',
      text: '天候・気候に影響されない。',
    },
  },
  {
    id: 'h2-turbine',
    name: '水素タービン発電所',
    category: '次世代GX',
    catchCopy: '水の力で電気を！',
    tags: ['thermal', 'gx'],
    stats: { output: 1, safety: 2, selfSufficiency: 5, efficiency: 1, environment: 5 },
    effect: {
      kind: 'baseload',
      keyword: 'ベースロード',
      text: 'このカードはすべての『天候・気候イベント』の効果を受けない。',
    },
  },
];

// ---- ミッションカード（社会の要求・5種） ----

export const MISSION_CARDS: MissionCard[] = [
  {
    id: 'environment-summit',
    title: '国際環境サミット：脱炭素への誓い',
    flavor:
      '地球温暖化を防止するため、世界中で温室効果ガスの削減目標が厳しく設定された。クリーンなエネルギーへの大転換が求められている！',
    lesson:
      '再エネだけで電力を賄おうとすると、発電量の確保やコストの折り合いが難しくなる「トレードオフ」を体験します。',
    // 目標値は3枚上限で達成可能な水準に調整済み（原案: 発電量12・環境15）
    conditions: [
      { stat: 'output', min: 10 },
      { stat: 'environment', min: 13 },
    ],
    bannedTag: {
      tag: 'high-co2',
      label: '「石炭火力」「石油火力」などのCO2大量排出カードは場に出せない',
    },
  },
  {
    id: 'cold-wave',
    title: '大寒波襲来：冬の電力危機',
    flavor:
      '数十年に一度の大寒波が日本列島を襲い、暖房のための電力需要が爆発的に増加。安定した大電力を供給しつつ、燃料切れによるブラックアウトを防げ！',
    lesson:
      '再エネが機能しにくい極限状態において、24時間安定して大出力を出せる電源やバックアップ技術の重要性を理解します。',
    // 目標値は3枚上限で達成可能な水準に調整済み（原案: 発電量25）
    // 発電量18は石油の【バックアップ】(冬+5)を使わないとほぼ届かない設計＝バックアップの大切さを学ぶ
    conditions: [
      { stat: 'output', min: 18 },
      { stat: 'selfSufficiency', min: 8 },
    ],
    statAdjust: {
      tag: 'solar',
      stat: 'output',
      add: -2,
      note: '寒波の影響（悪天候・日照時間の短さ）により太陽光の発電量-2',
    },
    winter: true, // 石油火力の【バックアップ】が使用可能
  },
  {
    id: 'semiconductor',
    title: '最先端半導体工場の誘致：1秒の停電も許さない',
    flavor:
      '地域に世界最新鋭の半導体工場が建設された。半導体製造には、1秒の停電や電圧低下も許されない「完璧に安定した電気」が大量に必要だ！',
    lesson:
      'ただ発電するだけでなく、電気の「質（安定性・周波数の維持）」を担保する調整技術が必要不可欠であることを学びます。',
    // 目標値は3枚上限で達成可能な水準に調整済み（原案: 発電量18）
    conditions: [
      { stat: 'output', min: 11 },
      { stat: 'safety', min: 12 },
    ],
    requireOneOf: {
      tags: ['stabilizer', 'baseload-power'],
      label:
        '「系統安定・調整（揚水・蓄電池）」または「ベースロード電源（水力・地熱・原子力）」のカードが1枚以上必要',
    },
  },
  {
    id: 'fuel-price-surge',
    title: '燃料価格の急騰：電気代を安く抑えよ',
    flavor:
      '世界情勢の悪化により、輸入している石炭、石油、LNGの価格がトリプル高騰！家計や工場の電気代を抑えるため、国産エネルギーと低コストの発電方法を選択せよ！',
    lesson:
      '日本の「エネルギー自給率の低さ（約12%）」が、世界情勢によって人々の経済生活（電気代）に直接大打撃を与えるリスクを学びます。',
    // 目標値は3枚上限で達成可能な水準に調整済み（原案: 発電量15・効率14・自給12）
    // 自給率10は輸入燃料系(石炭・石油・LNG)に頼ると届かない設計＝ミッションのテーマどおり
    conditions: [
      { stat: 'output', min: 10 },
      { stat: 'efficiency', min: 11 },
      { stat: 'selfSufficiency', min: 10 },
    ],
  },
  {
    id: 'smart-community',
    title: '地方創生：分散型スマートコミュニティ',
    flavor:
      '巨大な発電所に頼るのではなく、地域にある資源（温泉、ゴミ、森林、川の流れなど）を活用し、災害に強くて自立した「エコタウン」を構築せよ！',
    lesson:
      '大規模集中型発電のメリット（大出力）と、分散型エネルギーシステム（災害時の強さ、地域資源の有効利用）のメリットを比較・評価します。',
    conditions: [
      { stat: 'output', min: 10 },
      { stat: 'environment', min: 12 },
    ],
    bannedTag: {
      tag: 'large-scale',
      label: '「大規模発電（原子力、大型石炭火力、大型ダム水力）」は場に出せない',
    },
  },
];

// ---- イベントカード（トラブル・5種） ----

export const EVENT_CARDS: EventCard[] = [
  {
    id: 'rainy-season',
    title: '梅雨入り・長雨（曇天）',
    text: '場に出ているすべての「太陽光発電（住宅用・メガソーラー）」の発電量を0にする。',
    lesson:
      '太陽光発電の最大の弱点である「天候依存性」を体感し、火力や揚水発電によるバックアップの必要性に気づきます。',
    effects: [{ kind: 'zero-output-by-tag', tag: 'solar' }],
  },
  {
    id: 'no-wind',
    title: '太平洋高気圧の停滞（無風状態）',
    text: '場に出ているすべての「風力発電（陸上・洋上着床・洋上浮体）」の発電量を0にする。',
    lesson:
      '太陽光だけでなく、風力も自然現象に左右されること、それらを複数組み合わせる（多様化する）意味を学びます。',
    effects: [{ kind: 'zero-output-by-tag', tag: 'wind' }],
  },
  {
    id: 'sealane-blockade',
    title: 'シーレーン（燃料輸送ルート）の封鎖',
    text: '自給率が1の発電カード（石油火力、石炭火力など）は、効率性の数値を一律-4（コスト増）とする。',
    lesson:
      '資源のほぼ全てを海外に依存している日本のエネルギーセキュリティ（燃料調達リスク）の現実を学びます。',
    effects: [
      { kind: 'stat-penalty', ifStat: 'selfSufficiency', lte: 1, modify: 'efficiency', add: -4 },
    ],
  },
  {
    id: 'typhoon',
    title: '猛烈な台風の接近',
    text: 'すべての太陽光、風力カードの発電量は0になる。ただし、場に出ているすべての「水力発電（一般・中小水力・揚水）」は、豊富な水量により発電量が＋2される。',
    lesson:
      '自然災害は発電の脅威になる一方で、その力を味方にできるエネルギー変換技術（水力）もあるという多角的な視点を学びます。',
    effects: [
      { kind: 'zero-output-by-tag', tag: 'solar' },
      { kind: 'zero-output-by-tag', tag: 'wind' },
      { kind: 'boost-by-tag', tag: 'hydro-boost', stat: 'output', add: 2 },
    ],
  },
  {
    id: 'grid-overload',
    title: '送電網（系統）の負荷増大',
    text: '自分の場に「揚水発電」または「産業用大型蓄電池」のカードが出ていないプレイヤーは、送電制限ペナルティとして発電量の合計値から-4される。',
    lesson:
      '電気は「つくる技術」と同じくらい、「ためる技術」や「送る技術（送電網の安定化）」が社会を維持するために極めて重要であることを学びます。',
    effects: [
      {
        kind: 'team-penalty-unless-tag',
        tags: ['stabilizer'],
        add: -4,
        label: '揚水発電・蓄電池が場にないため送電制限ペナルティ（発電量合計-4）',
      },
    ],
  },
];
