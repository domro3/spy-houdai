# スパイ砲台 仕様書セット

このフォルダは、ゲーム企画『スパイ砲台』を Codex / Claude Code などの開発エージェントに渡すための仕様書セットです。

## ゲーム概要

**スパイ砲台**は、全員で巨大ボスを倒す協力型パーティゲームです。  
ただし、プレイヤーの中に1人だけ、ボス側のスパイが紛れています。

キャッチコピー：

> 全員砲台、1人だけスパイ。

標準入口のParty Modeでは、プレイヤーはラウンドごとに「撃つ・守る・直す」を選び、ボス予告に合わせて巨大ボスと戦います。
スパイは味方のふりをしながら、「弱く撃つ・邪魔する・ボスを助ける」で場を揺らします。

既存Phase 1のスキャン、監視対象ログ、怪しいコイン、最終推理ヒントなどの推理寄り要素はAdvanced Modeとして残します。

## 現時点の開発方針

最終的にはオンライン対応を目指しますが、最初からオンライン通信は実装しません。

開発ロードマップ：

1. **1PC完結プロトタイプ**
2. **権利リスクレビュー**
3. **Party Mode標準入口化**
4. **中央画面＋プレイヤー画面分離**
5. **CPU補充・1人練習モード**
6. **ローカルネットワーク対応**
7. **オンライン対応**

最初のCodex依頼では、**1PC完結のMVPプロトタイプ**を作成します。

## ファイル構成

```text
spy-houdai-specs/
  README.md
  docs/
    00_project_brief.md
    01_mvp_spec.md
    02_game_rules.md
    03_balance_table.md
    04_cpu_design.md
    05_screen_design.md
    06_architecture.md
    07_rights_policy.md
    08_party_mode.md
  tasks/
    phase1_local_prototype_tasks.md
    phase1_5_rights_review_tasks.md
    phase2_party_mode_tasks.md
  prompts/
    codex_initial_prompt.md
    codex_followup_prompt.md
```

## Codexへの渡し方

まずは `prompts/codex_initial_prompt.md` を Codex に渡してください。  
その際、`docs/` と `tasks/` の内容を参照するように指示してください。

## 最初の実装でやること

- オンライン通信なし
- 1台PC上で完結
- 4〜6人プレイ相当
- 人間操作とCPU操作を混在可能
- 役職配布
- ラウンド進行
- 行動選択
- ボスHP・拠点耐久
- スパイ妨害
- 疑惑メーター
- 投票
- 怪しいコイン
- ラウンド3中間作戦分岐
- 切断時の砲台ロボ引き継ぎ
- 結果発表・称号表示

## Phase 2 Party Modeで追加すること

- Party Mode / Advanced Modeのモード分離
- Party Mode用の3行動
- ボス行動4種
- BossDefinitionによる拡張可能なボス定義
- 初期ボス `prototype_gigant`
- Party Mode用CPUシミュレーション
- `npm run sim:party`

## 最初の実装でやらないこと

- オンライン通信
- ローカルネットワーク通信
- スマホ連携
- アカウント
- マッチング
- 課金
- ランキング
- 複雑なアニメーション
- 本格的なグラフィック

## Phase 1.5で確認すること

Phase 1の1PCプロトタイプ完了後、公開・配布・配信者テストの前に `docs/07_rights_policy.md` と `tasks/phase1_5_rights_review_tasks.md` を確認します。

- UI文言・ログ文言・称号名が既存作品に寄りすぎていないか
- 画像・BGM・SE・フォント・アイコンの出所とライセンス
- タイトル・主要アイテム名・作戦名の商標検索
- 他ゲーム名や「○○風」表現を公式説明で前面に出していないか
- 生成AI素材を使う場合の生成記録
