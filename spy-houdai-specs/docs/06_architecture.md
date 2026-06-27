# スパイ砲台 実装アーキテクチャ方針

## 1. 最重要方針

ゲームルール本体を通信方式から切り離す。

悪い設計：

```text
通信処理の中にゲームルールを書く
```

良い設計：

```text
Transport は「誰が何を選んだか」を渡すだけ
GameCore がゲーム進行・判定・ログ生成を行う
View は状態を表示するだけ
```

## 2. 段階的実装ロードマップ

### Phase 1：1PC完結プロトタイプ

目的：

- ゲームとして面白いか検証
- オンライン通信なし
- 1台PC上で4〜6人分を操作
- CPU補充対応

実装：

- GameCore
- LocalInput
- SimpleView
- CPUPlayer
- DebugLog

### Phase 2：中央画面＋プレイヤー画面分離

目的：

- 中央画面と個別画面の情報分離
- 秘密情報の扱いを整理

実装：

- SharedScreenView
- PlayerScreenView
- ScreenStateBuilder

### Phase 3：ローカルネットワーク対応

目的：

- 同一Wi-Fi内でスマホ/PCから参加

実装候補：

- ホストPCがローカルサーバー
- 各端末がブラウザで参加
- WebSocket等で行動入力を送信

### Phase 4：オンライン対応

目的：

- インターネット越しにプレイ

候補：

- WebRTC
- Steam Lobby / Steam Networking
- サーバー経由WebSocket
- P2P + シグナリング
- ホスト制オンライン

## 3. 推奨モジュール分割

```text
src/
  core/
    game_state.ts
    game_engine.ts
    rules.ts
    actions.ts
    roles.ts
    balance.ts
    log_builder.ts
    suspicion.ts
    scoring.ts
  cpu/
    cpu_player.ts
    cpu_profiles.ts
    cpu_spy_logic.ts
    cpu_vote_logic.ts
  input/
    local_input.ts
    input_adapter.ts
  view/
    central_view.tsx
    player_panel.tsx
    log_view.tsx
    result_view.tsx
  transport/
    local_transport.ts
    future_network_transport.md
  data/
    constants.ts
  tests/
    game_engine.test.ts
    cpu_simulation.test.ts
```

言語やフレームワークは未確定だが、Web/TypeScriptで作る場合はこの構成が扱いやすい。

## 4. GameCoreの責務

GameCoreは以下を担当する。

- 初期化
- プレイヤー作成
- CPU補充
- 役職配布
- ラウンド開始
- 行動受付
- 行動集計
- ボス行動
- ログ生成
- 弁明受付
- 投票受付
- 疑惑メーター更新
- ラウンド3分岐
- 勝敗判定
- 称号判定

GameCoreはUIや通信方式を知らない。

## 5. Inputの責務

Inputはプレイヤーからの入力をGameCoreに渡す。

入力種類：

- 行動選択
- 対象選択
- 弁明カード選択
- 疑惑投票
- 作戦分岐投票
- 怪しいコイン使用
- 切断/復帰

将来、Inputは以下に差し替え可能にする。

- 1PCローカル入力
- CPU入力
- ローカルネットワーク入力
- オンライン入力

## 6. Viewの責務

ViewはGameStateを表示する。

中央画面用状態とプレイヤー画面用状態を分ける。

重要：

- 中央画面にスパイの正体を出さない
- 各プレイヤーには自分の役職だけ出す
- スパイ専用行動はスパイにだけ出す
- 結果発表時に正体公開する

## 7. Transportの責務

Phase 1ではTransportは不要、またはLocalTransportのみ。  
将来のために、通信方式を差し替えられる抽象にしておく。

Transportが扱うのは、あくまで入力イベント。

例：

```json
{
  "type": "submit_action",
  "playerId": "p1",
  "action": "charge_attack",
  "targetId": null
}
```

## 8. 状態管理の例

GameStateに含めるもの：

- phase
- round
- players
- bossHp
- bossMaxHp
- baseHp
- baseMaxHp
- submittedActions
- roundLogs
- publicLogs
- privateLogs
- suspicion
- monitoredPlayerId
- branchState
- coinUsage
- result
- awards

Playerに含めるもの：

- id
- name
- role
- isCpu
- isConnected
- suspicionValue
- status
- lastAction
- hasUsedCoin

## 9. テスト方針

最初から以下のテストを作る。

- 役職配布でスパイが1人になる
- 5ラウンドでゲームが終了する
- ボスHP0で砲台チーム勝利
- ボスHP残存でスパイ勝利
- 拠点耐久0でスパイ勝利
- 怪しいコイン成功時に2票になる
- 怪しいコイン失敗時に疑惑上昇
- 切断時にCPU操作へ切り替わる
- CPUだけでゲームが最後まで進む
- ラウンド3で分岐判定が発生する

## 10. Phase 1で避けること

Phase 1では以下を実装しない。

- オンライン通信
- WebRTC
- Steam連携
- アカウント
- DB
- 永続保存
- 複雑なアニメーション
- モバイル最適化
- 課金
- ランキング

まずはゲームコアと1PCプロトタイプを完成させる。
