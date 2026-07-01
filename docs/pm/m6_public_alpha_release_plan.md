# M6 Public Alpha Release Plan

作成日: 2026-07-01

ステータス: M6 Public Alpha公開済み / GitHub Pages

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
| デプロイ先 | GitHub Pages予定 |
| 公開URL | `https://domro3.github.io/spy-houdai/` |
| フィードバック先 | 初回は手動収集 |

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
| デプロイ | GitHub Pagesへ公開済み | Actions/Pagesの継続確認 |
| 公開URL | `https://domro3.github.io/spy-houdai/` | 390px/1280pxの回帰確認 |
| フィードバック | 初回は手動収集に決定 | 公開先決定後に外部フォーム化するか再判断 |
| 商標 | J-PlatPat予備確認済み | 正式タイトル、ストア掲載、収益化前は専門家確認 |

## 実施済み

- M5を `Public Alpha v0.1 AI Complete` としてクローズ
- M6用の公開ページ文言を作成
- M6用のフィードバック項目を作成
- 素材/ライセンス台帳を作成
- 未使用かつ配布対象だったプロトタイプPNGを `public/` から削除
- M6 release preflightを追加
- M6 human substitute checkを実施
- GitHub Pages workflowとPages用ビルドコマンドを追加
- GitHub Pagesの `/spy-houdai/` サブパス配信に合わせて、Vite baseとローカルルートを調整
- GitHub repository `domro3/spy-houdai` を作成し、`main` をpush
- GitHub Pagesをworkflowモードで有効化し、公開URLを確認

## 2026-07-01 初回M6 Preflight

証跡: `docs/release/m6_release_preflight.md`

結果: 初回は `NEEDS_DECISION`

自動ゲートはすべてOK。残りは外部判断ブロッカーのみ。

残ブロッカー:

- Git remoteが未設定
- デプロイ設定が未設定
- フィードバック送信先が未決定
- 主要名称の商標検索記録が未入力

## 2026-07-01 人間代替チェック

証跡: `docs/release/m6_human_substitute_check.md`

結果:

- ゲーム本体、スマホ入口、実操作、再戦、表示崩れ、コンソール、素材確認はOK
- J-PlatPat簡易検索と詳細検索を実施
- フィードバックは初回手動収集に決定
- Public Internet公開は、Git remote、デプロイ設定、公開URLがないためNo-Go

## 2026-07-01 GitHub Pages公開

リポジトリ: `https://github.com/domro3/spy-houdai`

公開URL: `https://domro3.github.io/spy-houdai/`

Actions run: `https://github.com/domro3/spy-houdai/actions/runs/28524932748`

確認結果:

- GitHub Pages deploy: success
- `https://domro3.github.io/spy-houdai/`: HTTP 200
- JS asset: HTTP 200
- スマホ幅390pxでPublic Alpha入口表示OK
- `https://domro3.github.io/spy-houdai/board` 直URL表示OK
- サブパスリンクが `/spy-houdai/...` 形式で生成される
- 公開URL上のコンソール警告/エラーなし

## 次アクション

1. 少人数へ公開URLを共有する
2. 手動フィードバックを `docs/release/public_alpha_v0_1_feedback.md` の項目で回収する
3. 進行不能、表示崩れ、もう一戦感を優先してM7候補へ整理する
