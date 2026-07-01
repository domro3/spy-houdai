# M6 Public Alpha Release Plan

作成日: 2026-07-01

ステータス: M6 Started / Public Alpha公開準備 / デプロイ先未決

## 目的

M6では、M5で完成したスマホ単体Public Alpha v0.1を、公開できる形へ近づける。

M6の中心は、ゲーム内容の追加ではなく、公開前に必要な配布・説明・権利・フィードバック導線を整えること。

## M6の対象

- 静的Web Alphaとして配布できるビルド状態を確認する
- 公開ページ用の説明文を用意する
- Alpha版であること、未完成範囲、推奨環境を明記する
- フィードバック収集項目を用意する
- 権利・商標・素材ライセンスの公開前チェック対象を整理する
- デプロイ先と公開URLの未決事項を明確にする

## M6でやらない

- オンライン/マッチング/アカウント対応
- 正規版相当のグラフィック制作
- ストア販売ページの完成
- 商標や法律判断の確定
- 人間プレイテスト結果の捏造

## 公開形態

| 項目 | 現時点の扱い |
| --- | --- |
| 公開名 | Public Alpha v0.1 |
| 入口 | `/` |
| 対象端末 | スマホ縦画面優先 |
| プレイ形式 | p1手動 + CPU4基 |
| Board | 任意補助 |
| 配布方式 | 静的Webビルド |
| デプロイ先 | 要決定 |
| 公開URL | 要決定 |
| フィードバック先 | 要決定 |

## 完了条件

- `npm run build` が通り、`dist/index.html` と配布JS/CSSが生成される
- `npm run playtest:m5 -- --games 100` がPASSする
- `npm run release:m6` が自動ゲートPASSになる
- 公開ページ文言が `docs/release/public_alpha_v0_1_page_copy.md` にある
- フィードバック項目が `docs/release/public_alpha_v0_1_feedback.md` にある
- 素材/ライセンス台帳が `docs/release/asset_license_register.md` にある
- デプロイ先、公開URL、フィードバック先が決まる
- 商標検索対象の未確認を認識したうえで、公開名として進めるか仮名公開にするか判断する

## 現時点のブロッカー

| 種別 | 内容 | 次アクション |
| --- | --- | --- |
| デプロイ | Git remoteとデプロイ設定が未設定 | GitHub Pages、Netlify、Vercel、itch.io等から決める |
| 公開URL | 未決定 | デプロイ先決定後に確定 |
| フィードバック | 送信先が未決定 | Google Forms、GitHub Discussions、メール、X投稿などから決める |
| 商標 | `スパイ砲台` など主要名称が商標検索前 | 公開名にする前に検索日・検索先・結果を記録する |

## 実施済み

- M5を `Public Alpha v0.1 AI Complete` としてクローズ
- M6用の公開ページ文言を作成
- M6用のフィードバック項目を作成
- 素材/ライセンス台帳を作成
- 未使用かつ配布対象だったプロトタイプPNGを `public/` から削除
- M6 release preflightを追加

## 2026-07-01 初回M6 Preflight

証跡: `docs/release/m6_release_preflight.md`

結果: `NEEDS_DECISION`

自動ゲートはすべてOK。残りは外部判断ブロッカーのみ。

残ブロッカー:

- Git remoteが未設定
- デプロイ設定が未設定
- フィードバック送信先が未決定
- 主要名称の商標検索記録が未入力

## 次アクション

1. デプロイ先を決める
2. フィードバック送信先を決める
3. 商標検索チェック記録を埋める
4. 公開URLで390px/1280pxの最終確認を行う
5. Public Alpha v0.1公開Go/No-Goを判定する
