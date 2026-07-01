# Phase 2: Party Mode 追加タスク

ステータス: M5 Closed / Public Alpha v0.1 AI Complete

M4はAI Alpha PreflightとPost-M4人間スモークチェックを完了し、2026-06-30に終了判定した。M5はPublic Alpha v0.1のスマホ単体入口として、2026-07-01にAI完了判定した。

## 1. 目的

Phase 1完了後、標準入口としてParty Modeを追加する。

既存の推理寄り実装は削除せず、Advanced Modeとして扱う。

## 2. 実装タスク

- [x] 現在のPhase 1実装をコミットする
- [x] GameModeを追加する
- [x] Advanced Modeとして既存Phase 1挙動を残す
- [x] Party Mode用の砲台行動3種を追加する
- [x] Party Mode用のスパイ行動3種を追加する
- [x] BossDefinitionを追加する
- [x] 初期ボス `prototype_gigant` を追加する
- [x] ボス行動4種を追加する
- [x] Party Mode用CPU自動進行を追加する
- [x] Party Mode用シミュレーションコマンドを追加する
- [x] AI Alpha PreflightでCPUプレイ・時間見込み・公開ログ・画面分離を自動確認する
- [x] M4をAI Alpha Readyとしてクローズし、人間プレイテストをPost-M4確認へ移管する
- [x] Post-M4人間スモークチェックを記録し、M4をAlpha Playtest Readyと判定する
- [x] 2026-06-30にM4を終了判定し、残改善をM5/Public Alpha準備へ移管する
- [x] `/` をPublic Alpha v0.1のスマホ単体入口として整える
- [x] `p1手動 + CPU4基` のBoardなしソロAlphaをM5の主導線にする
- [x] M5 AI Public Alpha Preflightで初見入口、次操作、秘密情報、ソロ完走、結果/再戦を確認する
- [x] 2026-07-01にM5を終了判定し、公開準備/M6へ移管する

## 3. 確認コマンド

```bash
npm test
npm run typecheck
npm run build
npm run sim -- --games 100
npm run sim:party -- --games 100
npm run playtest:ai -- --games 100
npm run playtest:m5 -- --games 100
```

## 4. 完了目安

- Party Modeで1PC上のCPU補充ゲームが最後まで進む
- Advanced Modeの既存テストが壊れていない
- Party Modeの砲台勝率が55から70%程度に入る
- Party ModeのpublicLogが1ラウンド3から4行程度に収まる
- スパイ当て投票が勝敗ではなくボーナス扱いになっている

## 5. AIで進めた到達点

以下はAI Alpha Preflightで確認済みとする。

- CPU補完ゲームが100ゲーム完走する
- 平均プレイ時間見込みが5から8分に収まる
- Party Modeの砲台勝率が55から70%の目安内に入る
- publicLogが全ラウンド3から4行に収まる
- 守る・直す・妨害がシミュレーション内で十分に出る
- 結果発表で称号とおまけ投票称号が出る
- `/board` に秘密情報が出ず、スパイ専用操作はスパイ端末だけに出る

証跡: `docs/playtest/ai_alpha_preflight.md`

## 6. Post-M4人間スモークチェック

記録元: `docs/playtest/alpha_checklist.md`

- [x] 人間プレイテストで1ゲーム5から8分の手触りを確認する
- [x] 説明なしでBoardの戦況が読めるか確認する
- [ ] Player端末だけで次に押す操作が分かるか確認する
- [ ] 結果発表と称号が盛り上がりにつながるか確認する

未完の人間再確認項目は、M4ブロッカーではなくM5/Public Alpha v0.1準備の確認項目として引き継ぐ。

M4完了レポート: `docs/playtest/m4_completion_report.md`

## 7. M5へ送った改善候補

- Player端末の次操作表示を強める
- 「個別状態」の文言を見直す
- スパイ妨害の気づきやすさを上げる
- 他プレイヤー待ち時間の退屈さを軽減する
- UIのワクワク感を強める

## 8. M5 AI完了判定

記録元:

- `docs/playtest/m5_public_alpha_preflight.md`
- `docs/playtest/m5_completion_report.md`
- `docs/pm/mobile_screen_redesign_plan.md`

確認済み:

- `/` がPublic Alpha v0.1入口として表示される
- 入口でAlpha版、スマホ推奨、5から8分目安、CPU4基同期、Boardなし進行が分かる
- p1 AIユーザー + CPU4基でスパイ予想と結果まで到達する
- 結果画面で勝者、スパイ正体、おまけ投票、称号が読める
- 再戦で新規SeedのROUND 1へ戻れる
- Board/通常端末に秘密情報が漏れない
- M4 AI Alpha Preflightの品質ゲートを維持する

M5で閉じた扱い:

- Player端末の次操作表示を強める
- 「個別状態」の文言をPublic Alpha入口では前面に出さない
- Boardなしソロ導線では他プレイヤー待ち時間をCPU自動同期で短縮する
- UIの最低限のPublic Alpha感を、既存CSS/SVGビジュアルと入口コピーで確保する

M5外へ送る扱い:

- 妨害演出のさらなる強化
- 公開後の人間プレイテストによる面白さ、盛り上がり、もう一戦感の確認
- デプロイ、権利レビュー、公開文言、配布ページ整備
