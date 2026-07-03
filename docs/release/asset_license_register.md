# Asset And License Register

作成日: 2026-07-01

用途: Public Alpha v0.1公開前の素材・ライセンス確認台帳。

## 現在の公開ビルド方針

Public Alpha v0.1では、出所未記録の画像、BGM、SE、外部フォントを配布しない。

画面上の戦闘背景、ボス、砲台、リンクコア、オペレーター端末サムネ、主要アクションエフェクトは生成AI素材を生成記録つきで使う。アイコン、一部補助エフェクトはコード内のCSS/SVGベースの仮ビジュアルを継続使用する。

## 素材一覧

| 種別 | 現状 | 公開ビルドでの扱い | 確認状況 |
| --- | --- | --- | --- |
| ボス/砲台 | 生成AI PNG + Reactコンポーネント | 使用する | 2026-07-03生成記録あり |
| アクションエフェクト | 生成AI PNG + CSS合成 | 使用する | 2026-07-03生成記録あり |
| リンクコア | 生成AI PNG + Reactコンポーネント | 使用する | 2026-07-03生成記録あり |
| オペレーター端末サムネ | 生成AI PNG | 使用する | 2026-07-03生成記録あり |
| UIアイコン | `lucide-react` | 使用する | `node_modules/lucide-react/package.json` で ISC license を確認 |
| フォント | システムフォント | 使用する | 外部フォントなし |
| BGM | 未使用 | 配布しない | 追加時に別途確認 |
| SE | 未使用 | 配布しない | 追加時に別途確認 |
| 生成AI画像 | 戦闘背景、ボス、砲台、リンクコア、オペレーター端末サムネ、主要アクションエフェクト | 使用する | 2026-07-03生成記録あり |
| プロトタイプPNG | 旧M4検討用 | `public/` から削除 | 出所記録がないため配布対象外 |

## Lucide確認

ローカル確認:

```text
package: lucide-react
version: 0.562.0
license: ISC
```

公開ページやREADMEに第三者素材のクレジット欄を作る場合、`lucide-react` の利用を記録する。

## 名称・商標確認

2026-07-01時点で、AIによる一般Web完全一致検索と、J-PlatPat公式DBでの検索を行った。

これは法律判断ではなく、Public Alpha公開可否を決めるための予備調査記録である。

- 公式確認先: https://www.j-platpat.inpit.go.jp/
- JPOの検索案内: https://www.jpo.go.jp/support/startup/shohyo_search.html
- J-PlatPatの商標検索では、検索対象種別 `出願・登録情報`、`商標(検索用)`、`称呼(類似検索)` を確認した。

| 対象 | J-PlatPat結果 | M6での扱い |
| --- | --- | --- |
| スパイ砲台 | `商標(検索用)` 0件。簡易検索も0件。 | Public Alphaでは仮名扱いで使用可。正式タイトル化前は専門家確認推奨 |
| スパイ放題 | `商標(検索用)` 0件。簡易検索も0件。 | タイトル候補としては優先しない |
| SPY HOUDAI / Spy Houdai | スペース入りはOR検索で広くヒットするため参考外。`SPYHOUDAI` / `SpyHoudai` は0件。 | 英字表記を使う場合はスペースなし表記を優先 |
| Spy Turret | スペース入りはOR検索で広くヒットするため参考外。`SPYTURRET` / `SpyTurret` は0件。一般WebでFortnite関連の既存利用あり。 | 公開タイトルや固有名にはしない |
| みんな砲台 | `商標(検索用)` 0件。 | コピー候補としては弱める |
| 怪しいコイン | `商標(検索用)` 0件。一般Webでは外部ゲームイベントや一般表現として既存利用あり。 | 主要アイテム名としては代替名も検討 |
| オーバードライブ作戦 | `商標(検索用)` 0件。一般Webでは攻略・ファン文脈で既存利用あり。 | 内部作戦名に留め、公開コピーでは前面に出さない |
| 緊急弱体化プロトコル | `商標(検索用)` 0件。 | Public Alpha内の仮用語として使用可 |
| 全員砲台、1人だけスパイ | `商標(検索用)` 0件。簡易検索も0件。 | Public Alphaコピーとして使用可 |

称呼類似検索:

| 称呼 | J-PlatPat結果 | M6での扱い |
| --- | --- | --- |
| スパイホウダイ | 2件。`スカイ4D / スカイフォーディー`、`SpiderTie / スパイダータイ`。ゲーム名としての直接一致ではない。 | Public Alphaの仮名としては重大ブロッカーなし |
| スパイホーダイ | 2件。上記と同じ。 | Public Alphaの仮名としては重大ブロッカーなし |

注意:

- J-PlatPatの検索結果は、同一・類似の有無を人間が最終判断するものではない。
- 正式タイトル、ストア掲載、商標出願、収益化前には、弁理士または知財相談窓口で確認する。

## 生成AI素材記録

生成日: 2026-07-03

生成ツール: Codex built-in image generation

プロンプト管理: `docs/design/asset_generation_prompts.md`

| ファイル | 用途 | プロンプトID | 採用判断 | 備考 |
| --- | --- | --- | --- | --- |
| `public/assets/generated/battle_arena_bg_16x9.png` | 戦闘アリーナ背景 | A1 | 暫定採用 | UI文字なし。既存作品類似が強くないことを目視確認 |
| `public/assets/generated/boss_unlink_mk01_idle.png` | ボス本体 | A2 | 暫定採用 | クロマキー背景をローカル除去。既存作品類似が強くないことを目視確認 |
| `public/assets/generated/turret_coreguard_base_blue.png` | コアガード砲台ベース | A3 | 暫定採用 | クロマキー背景をローカル除去。色バリエーションはCSSフィルタで試験反映 |
| `public/assets/generated/link_core_idle.png` | リンクコア | A4 | 暫定採用 | クロマキー背景をローカル除去。既存作品類似が強くないことを目視確認 |
| `public/assets/generated/fx_attack_beam.png` | 攻撃エフェクト | A5 | 暫定採用 | 黒背景の加算合成用素材。既存作品類似が強くないことを目視確認 |
| `public/assets/generated/fx_guard_shield.png` | 守りエフェクト | A5 | 暫定採用 | 黒背景の加算合成用素材。既存作品類似が強くないことを目視確認 |
| `public/assets/generated/fx_repair_particles.png` | 修理エフェクト | A5 | 暫定採用 | 黒背景の加算合成用素材。既存作品類似が強くないことを目視確認 |
| `public/assets/generated/fx_spy_noise.png` | 妨害/ノイズエフェクト | A5 | 暫定採用 | 黒背景の加算合成用素材。既存作品類似が強くないことを目視確認 |
| `public/assets/generated/fx_boss_charge_warning.png` | ボス大技予告エフェクト | A5 | 暫定採用 | 黒背景の加算合成用素材。既存作品類似が強くないことを目視確認 |
| `public/assets/generated/operator_terminal_thumbnail.png` | オペレーター端末サムネ | B1 | 暫定採用 | UI文字なし。既存作品類似が強くないことを目視確認 |

## 未決事項

- 正式タイトル、ストア掲載、収益化前の専門家確認
- 新しい画像/BGM/SEを追加する場合の出所・ライセンス記録
- 生成AI素材を正式採用する場合の人間による最終類似性確認
