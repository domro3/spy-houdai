# M4 Completion Report

作成日: 2026-06-29

ステータス: M4 Complete / AI Alpha Ready

## 完了定義

M4は、Party Mode Alphaを1PC上でGMなしに進行できる状態まで作り、AIで確認できる進行・バランス・画面分離・UI手触りのリスクを潰すマイルストーンとして完了する。

人間プレイテストは未実施であり、実施済みとは扱わない。人間の体感確認はPost-M4確認事項として残す。

## 完了範囲

- `/board` を公開戦況スクリーン、`/player/:id` を個別作戦端末、`/debug` を開発者用画面として分離した
- Party Modeの砲台行動、スパイ行動、ボス行動、CPU補完、自動進行を実装した
- M4.8のゲームフィールUIとして、ボス・拠点・同期状態・通信ノイズ・結果発表を強化した
- M4.9のプロトタイプ画像を、ボス、拠点、砲台ユニット、通信ノイズに統合した
- 結果発表で勝者、スパイ正体、おまけ投票、称号ハイライトを表示できるようにした
- `npm run playtest:ai -- --games 100` でAI Alpha Preflightを実行できるようにした
- Boardに進行中のスパイ正体、スパイ専用行動名、個別ログ、debugLogが混ざらないことを回帰テスト化した

## AI Alpha Preflight結果

証跡: `docs/playtest/ai_alpha_preflight.md`

- ステータス: PASS
- 試行回数: 100
- 砲台チーム勝率: 57.0%
- 平均ラウンド数: 4.66
- 平均プレイ時間見込み: 5.83分
- 5から8分枠ゲーム率: 94.0%
- 拠点耐久40以下到達率: 41.0%
- 拠点耐久0敗北率: 6.0%
- 短い公開ログ率: 100.0%
- 称号表示ゲーム率: 100.0%

## M4完了時の確認コマンド

確認日: 2026-06-29

```bash
npm test
npm run typecheck
npm run build
npm run sim -- --games 100
npm run sim:party -- --games 100
npm run playtest:ai -- --games 100
```

確認結果:

- `npm test`: 50 passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm run sim -- --games 100`: Advanced Mode 100ゲーム完走、砲台チーム勝率57.0%
- `npm run sim:party -- --games 100`: Party Mode 100ゲーム完走、砲台チーム勝率57.0%、平均4.66ラウンド
- `npm run playtest:ai -- --games 100`: PASS

## Post-M4に残す確認

以下は人間の体感が必要なため、M4完了後の人間確認として残す。

- 人間5人、または実際の端末運用に近い形で1ゲームが最後まで進むか
- 実測時間が5から8分に近いか
- 説明なしでBoardの戦況が読めるか
- Player端末だけで次に押す操作が分かるか
- スパイ本人がスパイ役だと迷わないか
- スパイ妨害、結果発表、称号が盛り上がりにつながるか
- もう一戦したい感覚があるか

## 次フェーズ候補

- Post-M4人間プレイテスト
- 世界観・主要名称の反映方針整理
- 権利レビュー対象への新名称追加
- M5: ローカルネットワーク、端末参加、または公開前レビュー
