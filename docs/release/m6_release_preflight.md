# M6 Release Preflight

ステータス: NEEDS_DECISION
作成日: 2026-07-01
コマンド: `npm run release:m6`

このレポートは、Public Alpha v0.1公開準備のうち、AIで確認できる項目と外部判断が必要な項目を分けて記録する。

## 自動ゲート

| 判定 | 項目 | 目標 | 実測 |
| --- | --- | --- | --- |
| OK | M5完了証跡 | M5が完了済みとして記録されている | 必要記録あり |
| OK | M5 AI Preflight | M5のAI代替ゲートがPASSしている | 必要記録あり |
| OK | 公開準備コマンド | build, test, typecheck, playtest:m5, release:m6 | 必要コマンドあり |
| OK | 公開準備ドキュメント | M6計画、公開文言、フィードバック、素材台帳、人間代替チェックがある | 必要ドキュメントあり |
| OK | 公開メタ情報 | viewport、description、OG、theme-colorがある | 必要metaあり |
| OK | 静的ビルド成果物 | dist/index.html と dist/assets のJS/CSSがある | index=あり / assets=2 |
| OK | 公開配布素材 | Finderメタデータや出所未記録のプロトタイプ画像をpublicへ含めない | public files=0 |
| OK | アイコンライセンス | lucide-react が依存関係にあり、ローカルpackageでISC licenseを確認できる | version=0.562.0 / license=ISC |
| OK | 公開文言ポリシー | 既存作品名や寄せすぎ表現を公開文言に含めない | 禁止語なし |

## 外部判断ブロッカー

- Git remoteが未設定。公開先リポジトリまたはデプロイ元を決める。
- デプロイ設定が未設定。GitHub Pages、Netlify、Vercel、itch.io等から選ぶ。

## 判定

- 自動ゲートは通過。外部公開に必要な公開先・デプロイ設定などの判断が残る。
