# Phase 2: Party Mode 追加タスク

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
- [ ] 人間プレイテストで1ゲーム5から8分の手触りを確認する

## 3. 確認コマンド

```bash
npm test
npm run typecheck
npm run build
npm run sim -- --games 100
npm run sim:party -- --games 100
npm run playtest:ai -- --games 100
```

## 4. 完了目安

- Party Modeで1PC上のCPU補充ゲームが最後まで進む
- Advanced Modeの既存テストが壊れていない
- Party Modeの砲台勝率が55から70%程度に入る
- Party ModeのpublicLogが1ラウンド3から4行程度に収まる
- スパイ当て投票が勝敗ではなくボーナス扱いになっている

## 5. AIで進めた到達点

人間プレイテストは未実施のため、最後の体感確認タスクは未完のまま残す。
ただし、以下はAI Alpha Preflightで確認済みとする。

- CPU補完ゲームが100ゲーム完走する
- 平均プレイ時間見込みが5から8分に収まる
- Party Modeの砲台勝率が55から70%の目安内に入る
- publicLogが全ラウンド3から4行に収まる
- 守る・直す・妨害がシミュレーション内で十分に出る
- `/board` に秘密情報が出ず、スパイ専用操作はスパイ端末だけに出る

証跡: `docs/playtest/ai_alpha_preflight.md`
