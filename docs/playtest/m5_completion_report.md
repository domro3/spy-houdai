# M5 Completion Report

作成日: 2026-07-01
更新日: 2026-07-01

ステータス: M5 Closed / Public Alpha v0.1 AI Complete

最終判定: 2026-07-01にM5は終了とする。Public Alpha v0.1は、スマホ単体の `/` 入口から `p1手動 + CPU4基` で1ゲームを完走し、結果確認と再戦まで進める検証版として扱う。

## 完了定義

M5は、M4で作ったParty Mode Alphaを、初見プレイヤーがスマホで触れるPublic Alpha v0.1入口へ整理するマイルストーンとする。

人間スモークで本来見るべき「迷わないか」「次操作が分かるか」「公開Alphaとして雑に見えないか」は、今回の指示によりAI確認へ置き換えた。主観的な面白さは直接測れないため、以下をM5の完了ゲートとする。

- `/` がPublic Alpha v0.1入口として成立する
- スマホ縦画面で主CTAと基本説明が読める
- Boardなしでp1操作、CPU4基補完、スパイ予想、結果確認まで到達できる
- 通常端末にスパイ専用行動や秘密情報が漏れない
- 結果画面で勝者、スパイ正体、おまけ投票、称号が読める
- 再戦で新規SeedのROUND 1へ戻れる
- M4 AI Alpha Preflightの数値・秘密情報ゲートを維持する

## 完了範囲

- `/` をスマホ向け主入口として整備した
- 入口コピーを、短時間の正体隠匿/協力ゲームであることが伝わる文言へ変更した
- `5から8分目安`、`スマホ縦推奨`、`CPU4基同期` の確認ポイントを入口に追加した
- `この端末で開始` から、p1手動 + CPU4基のソロAlphaを開始できる
- Boardは必須ではなく、共有表示・確認用の任意補助として残した
- `/dev` に開発Shellを残し、公開入口とは分離した
- Player HUDで次操作、ボス予告、拠点耐久、行動ボタンをスマホ幅で確認できる
- 結果画面から `もう一戦`、`入口へ戻る`、`Boardで確認` へ進める
- 再戦時はSeedを更新し、新しいゲームとして開始する
- M5専用の `npm run playtest:m5` を追加した

## M5 AI Preflight結果

証跡: `docs/playtest/m5_public_alpha_preflight.md`

- ステータス: PASS
- Seed: 20260627
- M4回帰シミュレーション: 100ゲーム
- ゲート数: 7
- ブロッカー: なし

ゲート:

- 初見入口コピー: OK
- Public Alphaルート契約: OK
- Player端末の次操作ガイド: OK
- 秘密情報ガード: OK
- Boardなしソロ完走: OK
- 結果/再戦導線: OK
- M4 Alpha品質回帰: OK

## 確認コマンド

```bash
npm run typecheck
npm test
npm run build
npm run playtest:ai -- --games 100
npm run playtest:m5 -- --games 100
```

確認結果:

- `npm run typecheck`: passed
- `npm test`: passed
- `npm run build`: passed
- `npm run playtest:ai -- --games 100`: PASS
- `npm run playtest:m5 -- --games 100`: PASS

## ブラウザ確認

確認URL: `http://127.0.0.1:5173/`

- 390px幅で `/` 入口に横スクロールなし
- 390px幅で主CTA `この端末で開始` がファーストビュー内に表示される
- 390px幅で `この端末で開始` からPlayer HUDへ進む
- 390px幅で行動ボタン3種が表示される
- 1280px幅で入口の見出し、確認ポイント、CTA、起動設定が崩れない
- ブラウザコンソールエラーなし

## Go / No-Go判定

| 項目 | 判定 | メモ |
| --- | --- | --- |
| 390px前後のスマホ幅で主要操作が横にはみ出さない | OK | ブラウザ確認済み |
| 次に押す操作が画面上部または主要CTAとして分かる | OK | 入口CTA、Player HUD、判断チップ、M5 preflightで確認 |
| 通常プレイヤーにはスパイ専用行動が出ない | OK | M5 preflightで確認 |
| スマホ内の戦況サマリーから秘密情報が漏れない | OK | M4/M5 preflightで確認 |
| Boardなしでも結果確認まで到達できる | OK | M5 preflightで確認 |
| 1ゲームが最後まで進む | OK | M5 preflight、M4 AI Alpha Preflightで確認 |
| `npm test`、`npm run build`、`npm run playtest:ai -- --games 100` が通る | OK | 確認済み |

## M5外へ送ること

- 本番デプロイ設定と公開URL整備
- 公開前の権利・商標・表記レビュー
- ストア/販売ページ整備
- オンライン/マッチング/アカウント対応
- 1台スマホを複数人で回す導線
- 横画面対応
- 正規版相当のグラフィック制作
- 公開後の人間プレイテストによる面白さ、盛り上がり、もう一戦感の確認

## クローズ判定

M5は終了。Public Alpha v0.1のスマホ単体入口として、AIで確認できるM5ブロッカーは残っていない。

次フェーズは、Public Alpha公開準備またはM6として、デプロイ、権利レビュー、公開文言、人間からの実測フィードバック収集を扱う。
