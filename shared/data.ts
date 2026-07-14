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
    zeroOnEvents: ['windless'], // カードの効果文により、長雨(solarタグ)に加えて無風でも停止する
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

// ---- ミッションカード（立場の人の「ひとこと」＋注目する力ひとつ） ----
// むずかしい条件文はやめ、「だれが・何を求めているか」を一言で。
// 採点は engine.ts で「注目ステータス×2 ＋ 5つの力の合計 ＋ 多様性ボーナス」。

export const MISSION_CARDS: MissionCard[] = [
  // ===== 発電量（output）=====
  {
    id: 'factory',
    title: '半導体工場の工場長',
    emoji: '🏭',
    flavor:
      '町に世界最大級の半導体工場ができた！ラインは24時間フル稼働。けた違いの電気がないと、生産が止まってしまう。',
    spotlight: 'output',
    question:
      'たくさん発電できたカードは、環境や安全ではどうだった？「電気の量」を最優先にすると、何が犠牲になっただろう？',
    lesson: '大きな電力を出せる電源は、環境やコストで弱点をかかえがち。「量」だけでは選べません。',
  },
  {
    id: 'heat-city',
    title: '猛暑の大都市の市長',
    emoji: '🌆',
    flavor:
      '記録的な猛暑。街じゅうのエアコンが一斉に動き、電力の使用量が過去最高に。停電させるわけにはいかない！',
    spotlight: 'output',
    question:
      'ピーク時に大量の電気を出せたのはどんなカード？ そのカードにたよりきると、平常時や環境面で困ることはないかな？',
    lesson: '需要のピークに合わせた大出力が要る一方、ピーク対応の電源は普段の効率や環境で課題を持ちます。',
  },
  // ===== 環境（environment）=====
  {
    id: 'environment',
    title: '国際環境サミットの議長',
    emoji: '🌳',
    flavor:
      '世界の国々がCO₂削減を約束した脱炭素サミット。日本も、地球のためにクリーンな電気へ切りかえていく番だ。',
    spotlight: 'environment',
    question:
      '環境にやさしいカードを集めたとき、発電量やコストはどうなった？「地球を守ること」と「たくさん・安く発電すること」は両立できる？',
    lesson: 'クリーンな再エネは、発電量やコストで火力・原子力に届きにくい。理想と現実のバランスを考えます。',
  },
  {
    id: 'clean-town',
    title: '観光地のまちづくり課',
    emoji: '🏞️',
    flavor:
      'きれいな空気と海が自慢の観光のまち。景色やしぜんをよごさない電気で、この美しさを未来に残したい。',
    spotlight: 'environment',
    question:
      '自然を守る電気を選ぶと、発電量やコストはどうなった？ 美しさと便利さ、その間でどうバランスを取ればいいだろう？',
    lesson: '環境重視は再エネ中心になり、出力・コスト・安定供給とのトレードオフが生まれます。',
  },
  // ===== 効率・コスト（efficiency）=====
  {
    id: 'household',
    title: '家計をやりくりするお母さん',
    emoji: '👛',
    flavor:
      '物価高で毎月の請求書がずしり…。電気代を1円でも安くしたい。安く・むだなくつくれる電気がありがたいわ。',
    spotlight: 'efficiency',
    question:
      '安く発電できたカードには、どんな特徴があった？「安さ」だけで選ぶと、環境や安全、CO₂はどうなってしまうだろう？',
    lesson: '安く効率よくつくれる電源は、環境や安全で課題があることも。コストだけでは決められません。',
  },
  {
    id: 'factory-cost',
    title: '町工場の社長',
    emoji: '⚙️',
    flavor:
      '電気代が上がって、工場の利益がふっとびそうだ…。安くて効率のよい電気が、この工場を守る命づななんだ。',
    spotlight: 'efficiency',
    question:
      '「安さ」でカードを選んだとき、CO₂や安全の面ではどうだった？ 目先の安さの裏にある“見えないコスト”はなんだろう？',
    lesson: '短期のコストと、環境・安全といった長期のコストは、しばしばぶつかり合います。',
  },
  // ===== 安全性（safety）=====
  {
    id: 'disaster',
    title: '市の防災担当',
    emoji: '🚨',
    flavor:
      '大きな地震で長い停電にみまわれた経験から一言。災害でも止まらない・事故を起こさない、安全な電気を最優先にしたい。',
    spotlight: 'safety',
    question:
      '「止まらない安全な電気」に向いていたのはどんなカード？ 安全な電源だけをそろえたとき、必要な電気の“量”は足りた？',
    lesson: '安全で止まりにくい電源をそろえたいが、安全性の高い電源は出力が小さめなことも多いです。',
  },
  {
    id: 'hospital',
    title: '大きな病院の院長',
    emoji: '🏥',
    flavor:
      '手術中に電気が止まれば、患者さんの命に関わる。一瞬でも止まらない、質の高い安全な電気が絶対に必要だ。',
    spotlight: 'safety',
    question:
      'ぜったいに止まらない電気には何が要る？ 安全をつきつめると、電気の量やコストとはどうぶつかっただろう？',
    lesson: '「電気の質（止まらない・安定）」を担保する電源選びと、量・コストの両立が課題になります。',
  },
  // ===== 自給率（selfSufficiency）=====
  {
    id: 'energy-security',
    title: '国のエネルギー担当',
    emoji: '🗾',
    flavor:
      '世界情勢が不安定で、輸入している燃料がいつ止まるか分からない…。国内でつくれる電気を、もっと増やしておきたい。',
    spotlight: 'selfSufficiency',
    question:
      '国産でつくれる電気（自給率が高いカード）は、どんな種類が多かった？ それらだけにたよると、天気の悪い日はどうなる？',
    lesson: '国産（自給率が高い）電源は再エネ中心で天候に左右されがち。安定供給との両立が課題です。',
  },
  {
    id: 'island',
    title: '離島のまちの人',
    emoji: '⛴️',
    flavor:
      '燃料は船でしか届かない島。天気が荒れると船も来ない。島の中だけでつくれる電気を増やして、自分たちで暮らしを守りたい。',
    spotlight: 'selfSufficiency',
    question:
      '島の中だけでつくれる電気はどんな種類だった？ 天気の悪い日や夜も、それだけで暮らしをまかなえるだろうか？',
    lesson: '地産地消（分散型）の強みと、天候依存・出力の限界というトレードオフを考えます。',
  },
];

// ---- イベントカード（ふつうモードのみ・効果は1つだけ） ----
// やさしいモードでは出ません。ふつうモードで慣れてきたら「もう一波乱」を足す役。

export const EVENT_CARDS: EventCard[] = [
  {
    id: 'calm',
    title: '平常運転',
    text: '今回は天気も世界も落ち着いている。特別なことは起きない。',
    lesson: '',
    effects: [],
  },
  {
    id: 'rainy',
    title: '長雨（曇りつづき）',
    text: '太陽が出ず、太陽光発電の発電量が0になる。',
    question: '太陽光が止まってしまったこんな日、電気を止めないためには、どんなカードがあると安心だった？',
    lesson: '太陽光は天気に左右されます。だから他の電源と組み合わせる（ミックスする）必要があります。',
    effects: [{ kind: 'zero-output-by-tag', tag: 'solar' }],
  },
  {
    id: 'windless',
    title: '無風（風がやんだ）',
    text: '風がまったく吹かず、風力発電の発電量が0になる。',
    question: '太陽光も風力も、自然しだいで止まることがある。もし両方が止まる日が来たら、何にたよればいいだろう？',
    lesson: '風力も自然しだい。太陽光と風力だけに頼ると、両方止まる日に困ってしまいます。',
    effects: [{ kind: 'zero-output-by-tag', tag: 'wind' }],
  },
  {
    id: 'fuel-price-surge',
    title: '燃料価格の高騰',
    text: '輸入した燃料の値段が急上昇。自給率が低い（輸入だのみの）発電所は効率が下がる（-2）。',
    question: '燃料を輸入にたよると、なぜ電気代まで上がってしまうのだろう？ 日本にできることは何かな？',
    lesson: '燃料を輸入に頼ると、世界の情勢しだいで電気代が上がってしまうリスクがあります。',
    effects: [{ kind: 'stat-penalty', ifStat: 'selfSufficiency', lte: 2, modify: 'efficiency', add: -2 }],
  },
  {
    id: 'heatwave',
    title: '猛暑（ギラギラの晴れ）',
    text: '強い日ざしで、太陽光発電の発電量が+2される。',
    question: '晴れの日、太陽光は大かつやく。でも天気は毎日変わる。天気だのみの電源だけで、一年中だいじょうぶかな？',
    lesson: '天気は敵にも味方にもなります。晴れの日に強い太陽光の「良い面」も体感しましょう。',
    effects: [{ kind: 'boost-by-tag', tag: 'solar', stat: 'output', add: 2 }],
  },
];
