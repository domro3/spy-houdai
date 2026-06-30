# M4 Completion Report

作成日: 2026-06-29
更新日: 2026-06-30

ステータス: M4 Closed / Alpha Playtest Ready / M5へ移行

最終判定: 2026-06-30にM4は終了とする。以後のスマホ導線、Public Alpha入口、妨害演出、初見説明、公開前レビューはM5またはPublic Alpha v0.1準備タスクとして扱う。

## 完了定義

M4は、Party Mode Alphaを1PC上でGMなしに進行できる状態まで作り、AIで確認できる進行・バランス・画面分離・UI手触りのリスクを潰すマイルストーンとして完了する。

2026-06-29にPost-M4人間スモークチェックが記入され、M4をAlpha Playtest Readyと見なせることを確認した。

2026-06-30に追加のAI確認とスマホHUD追補を行ったうえで、M4の追加対応は打ち切り、次フェーズへ進む。

## 完了範囲

- `/board` を公開戦況スクリーン、`/player/:id` を個別作戦端末、`/debug` を開発者用画面として分離した
- Party Modeの砲台行動、スパイ行動、ボス行動、CPU補完、自動進行を実装した
- M4.8のゲームフィールUIとして、ボス・拠点・同期状態・通信ノイズ・結果発表を強化した
- M4.9のプロトタイプ画像を、ボス、拠点、砲台ユニット、通信ノイズに統合した
- 2026-06-30追補として、スマホファーストPlayer HUDのファーストビューを圧縮し、ボス予告、大技チャージ、HP、拠点耐久、行動ボタンの優先度を整理した
- 2026-06-30追補として、ボス、リンクコア、砲台ユニット、同期/妨害/防御/修理エフェクトをCSS/SVGベースのゲームビジュアル部品へ整理した
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

追補確認日: 2026-06-30

```bash
npm run typecheck
npm test
npm run build
```

追補確認結果:

- `npm run typecheck`: passed
- `npm test`: 51 passed
- `npm run build`: passed
- Chrome/Playwrightで `/board` と `/player/p1` を390px/1280px中心に確認し、ボス、リンクコア、砲台SVGが表示されること、横スクロールが出ないこと、公開画面に秘密情報が漏れないことを確認した

## 人間スモークチェック

記録日: 2026-06-29

記録元:

- `docs/playtest/alpha_checklist.md`
- `docs/playtest/alpha_test_summary_20260629.md`

確認できたこと:

- 人間プレイヤーだけで1ゲームが最後まで進んだ
- 実測時間が5から8分に近かった
- 説明なしでもBoardの戦況が読めた
- スパイ本人は自分がスパイ役だと迷わなかった
- Boardからスパイ情報を見抜けてしまうことはなかった
- もう一度テストしてよい状態と判断された
- M4をAlpha Playtest Readyと見なせると判断された

M5以降へ送る課題:

- Player端末だけでは次に押す操作が分かりにくい
- スパイ妨害に気づきにくい
- 作戦端末で迷いが出た
- 「個別状態」という文言が分かりにくい
- 他プレイヤーの選択待ち時間が退屈に感じられる
- UIのワクワク感が不足している

2026-06-30追補で進めた改善:

- Player端末のファーストビューで、ボス予告、大技チャージ、HP、拠点耐久、行動入力、行動ボタンが見えるように再整理した
- 妨害状態をサマリー、状態カード、個別反応で表示し、ログだけに依存しないようにした
- Board/PlayerのゲームビジュアルをCSS/SVG部品へ寄せ、Public Alpha向けの見た目の土台を強化した
- `/` をPublic Alpha v0.1入口として整え、Boardなしソロ導線、結果からの再戦、再戦時のSeed更新、スマホ用の判断チップを追加確認した

## クローズ判定

M4は終了。M4の完了条件は満たしており、追加で見つかったUI改善はM4ブロッカーではなくM5/Public Alpha v0.1準備へ移管する。

## 次フェーズ候補

- Public Alpha v0.1公開前チェック
- 初見入口の説明とCTA整理
- スパイ妨害の気づきやすさ改善
- 待ち時間の退屈さ軽減
- 世界観・主要名称の反映方針整理
- 権利レビュー対象への新名称追加
- M5: ローカルネットワーク、端末参加、または公開前レビュー
