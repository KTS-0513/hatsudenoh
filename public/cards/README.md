# カード画像の置き場所

このフォルダに、生徒が作ったカードの画像を置くと、ゲーム内でそのまま表示されます。

## ルール

- ファイル名は「**カードのID.jpg**」にしてください（下の対応表を参照）
- 形式は **JPG**（拡張子 `.jpg`）
- 画像が無いカードは、これまで通りステータス（数値）表示になります（無くても動きます）

## ファイル名の対応表

| カード名 | ファイル名 |
|---|---|
| 石炭火力発電所 | `coal.jpg` |
| LNG火力発電所 | `lng.jpg` |
| 石油火力発電所 | `oil.jpg` |
| 木質バイオマス発電所 | `biomass.jpg` |
| 廃棄物発電所 | `waste.jpg` |
| 工場排熱回収発電 | `cogen.jpg` |
| 太陽光発電所（住宅用） | `res-solar.jpg` |
| メガソーラー（大規模太陽光） | `mega-solar.jpg` |
| 大型風力発電所（陸上） | `onshore-wind.jpg` |
| 洋上風力発電所（着床式） | `fixed-offshore-wind.jpg` |
| 洋上風力発電所（浮体式） | `offshore-wind.jpg` |
| 地熱発電所 | `geothermal.jpg` |
| 温泉排水バイナリー発電 | `binary.jpg` |
| 中小水力発電所（流れ込み式） | `small-hydro.jpg` |
| 一般水力発電所（ダム式） | `dam-hydro.jpg` |
| 揚水発電所 | `pumped-hydro.jpg` |
| 産業用大型蓄電池システム | `grid-battery.jpg` |
| 原子力発電所 | `nuclear.jpg` |
| アンモニア・水素混焼火力発電 | `ammonia-h2.jpg` |
| 水素タービン発電所 | `h2-turbine.jpg` |

## 入れ方（GitHubの場合）

1. GitHubのリポジトリで `public/cards` フォルダを開く
2. 「Add file」→「Upload files」で、上の名前にリネームした画像をドラッグ＆ドロップ
3. Commit すると、Renderが自動で再デプロイして画像が反映されます
