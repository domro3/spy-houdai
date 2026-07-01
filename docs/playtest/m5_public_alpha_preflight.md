# M5 Public Alpha AI Preflight

ステータス: PASS
作成日: 2026-07-01
コマンド: `npm run playtest:m5 -- --games 100`

このレポートは、M5/Public Alpha v0.1準備の人間スモーク確認項目をAIで代替確認するための証跡である。
主観的な「面白さ」は直接測らず、初見入口、次操作、秘密情報、ソロ完走、結果/再戦、既存Alpha品質ゲートを検査する。

## サマリー

- Seed: 20260627
- M4回帰シミュレーション: 100ゲーム
- ゲート数: 7
- ブロッカー: なし

## ゲート

| 判定 | 項目 | 目標 | 実測 |
| --- | --- | --- | --- |
| OK | 初見入口コピー | Alpha版、スマホ、短時間、ソロ開始、CPU同期、Board任意が入口で分かる | 必要語句をすべて含む |
| OK | Public Alphaルート契約 | `/` が主入口、Board/Player/Dev/Debugが補助導線として残る | /:alpha / /board:board / /player/p1:player / /dev:split / /debug:debug |
| OK | Player端末の次操作ガイド | 通常プレイヤーが行動・ボス予告・基本3行動・ヘルプ文を見て次操作を選べる | instruction=行動を選んでください / board=1基の作戦待ち / actions=撃つ, 守る, 直す |
| OK | 秘密情報ガード | Boardと通常端末にスパイ専用情報が漏れず、スパイ端末だけに裏行動が出る | 漏えい検出なし |
| OK | Boardなしソロ完走 | p1 AIユーザー + CPU4基でスパイ予想と結果まで到達する | finished=true / voteSeen=true / steps=6 / awards=6 |
| OK | 結果/再戦導線 | 結果で勝者・スパイ正体・おまけ投票・称号が見え、再戦Seedで新規ROUND 1へ戻れる | winner=砲台チーム / spy=黄砲台 / bonus=おまけ投票成功 / rematchSeed=350953206 |
| OK | M4 Alpha品質回帰 | CPU補完、時間見込み、勝率、ログ量、称号、秘密情報が既存ゲートを通る | status=pass / win=57.0% / minutes=5.83 / targetTime=94.0% |

## ソロAlpha操作トレース

| Round | Phase | Instruction | AI操作 |
| ---: | --- | --- | --- |
| 1 | action | 行動を選んでください | 守る |
| 2 | action | 行動を選んでください | 撃つ |
| 3 | action | 行動を選んでください | 守る |
| 4 | action | 行動を選んでください | 撃つ |
| 5 | action | 行動を選んでください | 撃つ |
| 5 | vote | おまけでスパイを予想してください | 予想:青砲台 |

## ブロッカー

- なし

## メモ

- M5 Public Alpha Preflightは、人間の追加スモークチェックをAIで代替するための導線・表示・完走ゲートである。
- 面白さやワクワク感そのものは人間の感情実測ではないため、入口の明確さ、操作可能性、結果/再戦の可視性に置き換えて判定する。
- M4 AI Alpha Preflightの数値・秘密情報ゲートも同時に通すことで、M5の公開Alpha入口が既存品質を落としていないことを確認する。
