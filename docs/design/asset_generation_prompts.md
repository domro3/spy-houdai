# スパイ砲台 生成AI素材リストとプロンプト

作成日: 2026-07-03

ステータス: ChatGPT / Grok 画像生成用ドラフト。実装前に候補画像を見比べ、採用した素材だけ `docs/release/asset_license_register.md` に生成記録を残す。

参照元:

- `docs/design/art_direction.md`
- `docs/design/worldbuilding.md`
- `spy-houdai-specs/docs/07_rights_policy.md`
- `docs/release/asset_license_register.md`

## 生成時の前提

- 1素材につき1プロンプトで生成する。
- UI文言、数字、ロゴ、ボタン内テキストは画像に焼き込まない。文字は実装側で重ねる。
- 透明背景が使えるツールでは `transparent background` を指定する。
- 透明背景が使えない場合は、無地の暗い背景または薄いグレー背景で作り、あとで切り抜く。
- 生成後は、ツール名、生成日、プロンプト、採用判断を記録する。
- 既存ゲーム、既存キャラクター、既存UIに似た候補は採用しない。

## 共通スタイル指定

以下は全プロンプトの先頭か末尾に足してよい。

```text
Original visual asset for a Japanese browser party sci-fi game called "Spy Houdai". The game is about operator signals controlling turret robots to protect a Link Core from a giant runaway mech boss. Readable party sci-fi style, playful but not childish, compact mobile-game readability, clean silhouettes, dark navy tactical HUD mood with cyan, green, yellow, purple, red-orange semantic accents. Do not imitate or reference any existing game, movie, anime, mascot, logo, or UI. No readable text, no logos, no watermark.
```

## 共通ネガティブ指定

各プロンプトの最後に付ける。

```text
Avoid: existing game style, famous characters, spaceship crew characters, social deduction voting UI, werewolf/villager motifs, realistic military, horror, gore, dark unreadable cyberpunk, magic fantasy effects, ink splatter theme, copied button shapes, copied fonts, readable text, letters, numbers, logos, watermark, screenshot look.
```

## A. 最優先素材

### A1. 戦闘アリーナ背景

用途: 画面中央のボス戦エリア背景。現在のぼかし背景を差し替える。

推奨サイズ: 2048 x 1152。16:9。UIなし。

ファイル名候補: `battle_arena_bg_16x9.webp`

プロンプト:

```text
Create a 16:9 battle arena background for an original Japanese browser party sci-fi game. A compact futuristic defense platform surrounds a glowing Link Core area, with a distant city-network skyline and signal towers in the background. Leave a clear open center area where a giant boss and five turret robots can be placed later. Dark navy and blue-black base, cyan grid lines, subtle green repair lights, small yellow warning lights, very light red-orange danger glow near the horizon. Readable mobile-game background, not too detailed, not too dark, no characters, no boss, no UI panels, no readable text, no logo, no watermark.

Original visual asset for a Japanese browser party sci-fi game called "Spy Houdai". The game is about operator signals controlling turret robots to protect a Link Core from a giant runaway mech boss. Readable party sci-fi style, playful but not childish, compact mobile-game readability, clean silhouettes, dark navy tactical HUD mood with cyan, green, yellow, purple, red-orange semantic accents. Do not imitate or reference any existing game, movie, anime, mascot, logo, or UI. No readable text, no logos, no watermark.

Avoid: existing game style, famous characters, spaceship crew characters, social deduction voting UI, werewolf/villager motifs, realistic military, horror, gore, dark unreadable cyberpunk, magic fantasy effects, ink splatter theme, copied button shapes, copied fonts, readable text, letters, numbers, logos, watermark, screenshot look.
```

採用条件:

- 中央がうるさすぎず、ボスと砲台が重なっても読める。
- UIの外枠やボタンが描き込まれていない。
- 横長画面で左右に余白があり、スマホ横画面でも破綻しない。

### A2. ボス本体: アンリンクMk-01

用途: 中央ボスの本体差し替え。

推奨サイズ: 1024 x 1024。透明PNG。正面寄り3/4。

ファイル名候補:

- `boss_unlink_mk01_idle.png`
- `boss_unlink_mk01_charge.png`
- `boss_unlink_mk01_damage.png`
- `boss_unlink_mk01_regen.png`

プロンプト:

```text
Create an isolated giant runaway mech boss for an original Japanese party sci-fi turret game. The boss name concept is "Unlink Mk-01": a bulky deformed machine enemy that tries to disconnect the Link Core network. Front-facing three-quarter view, huge rounded armored body, heavy mechanical arms, antenna-like signal disruptors, red-orange glowing core, a few purple glitch cracks, readable silhouette for a small mobile screen. It should feel dangerous and exciting but not horror, not realistic military, not copied from any famous robot. Transparent background if possible. No text, no logo, no watermark.

Make one state only: idle battle stance.

Original visual asset for a Japanese browser party sci-fi game called "Spy Houdai". The game is about operator signals controlling turret robots to protect a Link Core from a giant runaway mech boss. Readable party sci-fi style, playful but not childish, compact mobile-game readability, clean silhouettes, dark navy tactical HUD mood with cyan, green, yellow, purple, red-orange semantic accents. Do not imitate or reference any existing game, movie, anime, mascot, logo, or UI. No readable text, no logos, no watermark.

Avoid: existing game style, famous characters, spaceship crew characters, social deduction voting UI, werewolf/villager motifs, realistic military, horror, gore, dark unreadable cyberpunk, magic fantasy effects, ink splatter theme, copied button shapes, copied fonts, readable text, letters, numbers, logos, watermark, screenshot look.
```

差分生成用の追記:

```text
Create the same boss in a charge warning state: red-orange chest core flaring, warning glow, shoulder vents open, strong danger silhouette, but no text or UI.
```

```text
Create the same boss in a damaged state: armor cracked, sparks and smoke, readable red-orange damage glow, still same silhouette, no gore, no text or UI.
```

```text
Create the same boss in an abnormal regeneration state: purple-red pulse rings around the core, corrupted repair glow, strange signal particles, no text or UI.
```

採用条件:

- 既存ロボット作品に似ていない。
- 小さく表示しても「ボス」とわかる。
- 赤/オレンジが危険、紫が異常信号として読める。

### A3. コアガード砲台セット

用途: 各プレイヤーのタレット本体。攻撃、守り、修理、妨害演出の起点。

推奨サイズ: 1024 x 1024。透明PNG。5色バリエーション。

ファイル名候補:

- `turret_coreguard_p1_blue.png`
- `turret_coreguard_p2_yellow.png`
- `turret_coreguard_p3_green.png`
- `turret_coreguard_p4_cyan.png`
- `turret_coreguard_p5_orange.png`

プロンプト:

```text
Create a set of small friendly turret robot units for an original Japanese party sci-fi game. They are "Core Guard" turret robots controlled by operator signals, not human characters. Each turret has a rounded mechanical body, one short cannon barrel, tiny antenna, glowing cyan sensor eyes, compact base, and a clean readable silhouette. Cute enough for party play but clearly a turret robot, not a spaceship crew, not a mascot copied from any existing work. Use the same shape for five color-accent variants: blue, yellow, green, cyan, orange. Transparent background if possible. No text, no logo, no watermark.

Original visual asset for a Japanese browser party sci-fi game called "Spy Houdai". The game is about operator signals controlling turret robots to protect a Link Core from a giant runaway mech boss. Readable party sci-fi style, playful but not childish, compact mobile-game readability, clean silhouettes, dark navy tactical HUD mood with cyan, green, yellow, purple, red-orange semantic accents. Do not imitate or reference any existing game, movie, anime, mascot, logo, or UI. No readable text, no logos, no watermark.

Avoid: existing game style, famous characters, spaceship crew characters, social deduction voting UI, werewolf/villager motifs, realistic military, horror, gore, dark unreadable cyberpunk, magic fantasy effects, ink splatter theme, copied button shapes, copied fonts, readable text, letters, numbers, logos, watermark, screenshot look.
```

差分生成用の追記:

```text
Create the same turret in an attack action pose: cannon barrel extended, yellow muzzle spark, cyan signal line, no projectile text, transparent background.
```

```text
Create the same turret in a guard action pose: small cyan shield projector deployed, protective bubble glow, no text, transparent background.
```

```text
Create the same turret in a repair action pose: green repair arm and wrench-like tool, small mechanical particles, no text, transparent background.
```

```text
Create the same turret in a noise or sabotage state: cannon slightly misaligned, purple-black glitch sparks, signal jitter, but do not reveal it as an obvious villain, no text, transparent background.
```

採用条件:

- 人型や宇宙船クルー風に見えない。
- 砲身、アンテナ、センサーが読める。
- P1からP5の色差が小画面でもわかる。

### A4. リンクコア

用途: 防衛対象。背景または中央右のコア表示に使う。

推奨サイズ: 1024 x 1024。透明PNG。

ファイル名候補:

- `link_core_idle.png`
- `link_core_damaged.png`
- `link_core_repaired.png`

プロンプト:

```text
Create an isolated "Link Core" object for an original Japanese party sci-fi turret game. It is the central network core that connects signals and operator commands. Shape: glowing cyan-blue energy orb inside a compact hexagonal mechanical frame, small antenna fins, subtle circuit lines, readable silhouette, friendly futuristic device, not a magic crystal. Include a soft cyan aura and tiny signal particles. Transparent background if possible. No text, no logo, no watermark.

Original visual asset for a Japanese browser party sci-fi game called "Spy Houdai". The game is about operator signals controlling turret robots to protect a Link Core from a giant runaway mech boss. Readable party sci-fi style, playful but not childish, compact mobile-game readability, clean silhouettes, dark navy tactical HUD mood with cyan, green, yellow, purple, red-orange semantic accents. Do not imitate or reference any existing game, movie, anime, mascot, logo, or UI. No readable text, no logos, no watermark.

Avoid: existing game style, famous characters, spaceship crew characters, social deduction voting UI, werewolf/villager motifs, realistic military, horror, gore, dark unreadable cyberpunk, magic fantasy effects, ink splatter theme, copied button shapes, copied fonts, readable text, letters, numbers, logos, watermark, screenshot look.
```

差分生成用の追記:

```text
Create the same Link Core in a damaged state: dim cyan light, small red-orange cracks, a few warning sparks, no text, transparent background.
```

```text
Create the same Link Core in a repaired state: bright cyan and green signal flow, clean particles, stable glow, no text, transparent background.
```

採用条件:

- 魔法アイテムではなく、通信中枢の機械として見える。
- 背景に置いても、アイコンにしても破綻しない。

### A5. 信号エフェクトセット

用途: オペレーターが指示を送り、タレットがアクションする演出。アニメーションや数値ポップの下に重ねる。

2026-07-03時点では、透明PNGではなく、黒背景の加算合成用PNGとして生成し、CSSの `mix-blend-mode: screen` で重ねる運用を採用した。発光や粒子の柔らかい境界を残しやすいため。

推奨サイズ: 512 x 512または1024 x 1024。透明PNG。可能なら個別素材。

ファイル名候補:

- `fx_attack_beam_hit.png`
- `fx_guard_shield.png`
- `fx_repair_particles.png`
- `fx_spy_noise.png`
- `fx_boss_charge_warning.png`
- `fx_boss_abnormal_heal.png`

プロンプト:

```text
Create a transparent PNG effect asset set for an original party sci-fi turret game. Six separate effects, consistent style, clean mobile readability:
1. attack signal: cyan beam with small yellow hit sparks
2. guard signal: cyan shield bubble and deflection arc
3. repair signal: green mechanical repair particles and small wrench-shaped light streaks
4. sabotage signal: purple-black glitch noise, broken signal lines, small black sparks
5. boss charge warning: red-orange pulse ring with yellow warning sparks
6. abnormal boss heal: purple-red corrupted pulse with small repair particles

No text, no icons with letters, no logos, no UI panels, transparent background if possible.

Original visual asset for a Japanese browser party sci-fi game called "Spy Houdai". The game is about operator signals controlling turret robots to protect a Link Core from a giant runaway mech boss. Readable party sci-fi style, playful but not childish, compact mobile-game readability, clean silhouettes, dark navy tactical HUD mood with cyan, green, yellow, purple, red-orange semantic accents. Do not imitate or reference any existing game, movie, anime, mascot, logo, or UI. No readable text, no logos, no watermark.

Avoid: existing game style, famous characters, spaceship crew characters, social deduction voting UI, werewolf/villager motifs, realistic military, horror, gore, dark unreadable cyberpunk, magic fantasy effects, ink splatter theme, copied button shapes, copied fonts, readable text, letters, numbers, logos, watermark, screenshot look.
```

採用条件:

- 色だけでなく形で役割がわかる。
- 透明化してUI上に重ねやすい。
- 数値表示を邪魔しない。

### A6. アクションアイコンセット

用途: ボタン、ログ、結果パネル、状態表示。

推奨サイズ: 512 x 512。透明PNGまたはSVG化しやすい単色アイコン。

ファイル名候補:

- `icon_action_attack.png`
- `icon_action_guard.png`
- `icon_action_repair.png`
- `icon_action_noise.png`
- `icon_action_boss_repair.png`
- `icon_action_sync.png`

プロンプト:

```text
Create a consistent icon set for an original Japanese party sci-fi turret game HUD. Six icons, simple readable line-and-fill style, rounded sci-fi but not copied from any existing UI:
attack: turret crosshair and small spark
guard: shield and signal arc
repair: mechanical wrench with green circuit particle
noise: broken signal wave with purple glitch fragments
boss repair: corrupted red-purple core pulse
sync: antenna link signal

Use transparent background, thick readable shapes for mobile buttons, cyan, blue, green, purple, red-orange, yellow accents. No readable text, no letters, no numbers, no logos, no watermark.

Avoid: existing game style, famous characters, spaceship crew characters, social deduction voting UI, werewolf/villager motifs, realistic military, horror, gore, dark unreadable cyberpunk, magic fantasy effects, ink splatter theme, copied button shapes, copied fonts, readable text, letters, numbers, logos, watermark, screenshot look.
```

採用条件:

- 32px表示でも意味が伝わる。
- 既存の一般アイコンに似すぎず、砲台/信号らしさがある。
- UIボタンのテキストなしでも補助になる。

### A7. HUDパネル用テクスチャ

用途: 画面全体のガラスパネル、背景グリッド、枠線の質感。

推奨サイズ: 2048 x 1152。16:9。透過または暗色背景。

ファイル名候補:

- `hud_panel_grid_overlay.png`
- `hud_panel_dark_texture.webp`

プロンプト:

```text
Create a subtle dark sci-fi HUD texture for a mobile browser game screen. Dark navy transparent-glass feeling, fine cyan grid lines, faint circuit traces, soft panel glow, very subtle purple signal noise in the corners, no buttons, no text, no logos, no characters. It should work as a background overlay behind UI panels without making text unreadable. 16:9, high resolution, clean and restrained.

Original visual asset for a Japanese browser party sci-fi game called "Spy Houdai". Readable party sci-fi style, compact mobile-game readability, dark navy tactical HUD mood with cyan, green, yellow, purple, red-orange semantic accents. Do not imitate or reference any existing game, movie, anime, mascot, logo, or UI. No readable text, no logos, no watermark.

Avoid: existing game style, famous characters, spaceship crew characters, social deduction voting UI, werewolf/villager motifs, realistic military, horror, gore, dark unreadable cyberpunk, magic fantasy effects, ink splatter theme, copied button shapes, copied fonts, readable text, letters, numbers, logos, watermark, screenshot look.
```

採用条件:

- テキストの可読性を落とさない。
- 画面全体が単色の暗青だけにならない。
- CSSのボーダーや影と混ざっても邪魔にならない。

## B. 次点素材

### B1. オペレーター端末サムネイル

用途: 左下のプレイヤーカードや端末状態表示。

推奨サイズ: 1024 x 768または1024 x 1024。透明PNGまたは背景付き。

ファイル名候補: `operator_terminal_thumbnail.png`

プロンプト:

```text
Create a small operator terminal illustration for an original Japanese party sci-fi game. It should show a compact command console sending signals to turret robots: headset-like antenna, small glowing buttons, cyan signal line, tiny P-channel style slots without readable letters. No human character, no large face, no UI text. Friendly tactical device, readable at thumbnail size, dark navy and cyan with small yellow and green accents. Transparent background if possible.

Original visual asset for a Japanese browser party sci-fi game called "Spy Houdai". The game is about operator signals controlling turret robots to protect a Link Core from a giant runaway mech boss. Readable party sci-fi style, playful but not childish, compact mobile-game readability, clean silhouettes, dark navy tactical HUD mood with cyan, green, yellow, purple, red-orange semantic accents. Do not imitate or reference any existing game, movie, anime, mascot, logo, or UI. No readable text, no logos, no watermark.

Avoid: existing game style, famous characters, spaceship crew characters, social deduction voting UI, werewolf/villager motifs, realistic military, horror, gore, dark unreadable cyberpunk, magic fantasy effects, ink splatter theme, copied button shapes, copied fonts, readable text, letters, numbers, logos, watermark, screenshot look.
```

採用条件:

- プレイヤーは「人」ではなく「指示を出すオペレーター」として伝わる。
- 砲台やボスより目立ちすぎない。

### B2. 結果バッジ/状態チップ背景

用途: ラウンド結果、手動/通常、未選択、ボス予告などの小さい表示。

推奨サイズ: 512 x 256。9-sliceしやすい余白つき。

ファイル名候補:

- `badge_status_blue.png`
- `badge_status_warning.png`
- `badge_status_noise.png`

プロンプト:

```text
Create three small sci-fi HUD badge backgrounds for a mobile party game UI. Rounded compact chips with glassy panel texture, no text:
1. stable blue/cyan status chip
2. red-orange/yellow warning chip
3. purple-black glitch noise chip

Make them clean, readable, and suitable for overlaying Japanese text later. No readable text, no letters, no numbers, no logo, no watermark. Avoid copied UI button styles from existing games.
```

採用条件:

- 文字を載せたときに読める。
- 既存ゲームのUI部品に見えない。

### B3. キービジュアル

用途: リリースページ、SNS、テスト募集。ゲーム内には直接使わない。

推奨サイズ: 1920 x 1080。

ファイル名候補: `key_visual_public_alpha_16x9.webp`

プロンプト:

```text
Create a key visual for an original Japanese browser party sci-fi game called "Spy Houdai". Five small Core Guard turret robots send operator signals toward a giant runaway mech boss "Unlink Mk-01" while protecting a glowing Link Core. Wide 16:9 composition, energetic but readable, dark navy tactical base with cyan team signals, green repair particles, yellow sparks, purple glitch sabotage, red-orange boss danger. No UI panels, no readable text, no logo, no watermark. Original design only, do not imitate any existing game, anime, movie, or mascot.

Avoid: existing game style, famous characters, spaceship crew characters, social deduction voting UI, werewolf/villager motifs, realistic military, horror, gore, dark unreadable cyberpunk, magic fantasy effects, ink splatter theme, copied button shapes, copied fonts, readable text, letters, numbers, logos, watermark, screenshot look.
```

採用条件:

- ゲーム内容が1枚で伝わる。
- UI素材ではなく宣伝素材として分けて管理する。
- タイトル文字は別レイヤーで載せる。

## 生成記録テンプレート

採用した素材は `docs/release/asset_license_register.md` に以下を追記する。

```md
## 生成AI素材記録

| ファイル | 用途 | ツール | 生成日 | プロンプトID | 採用判断 | 備考 |
| --- | --- | --- | --- | --- | --- | --- |
| public/assets/generated/battle_arena_bg_16x9.webp | 戦闘背景 | ChatGPT / Grok | YYYY-MM-DD | A1 | 採用 / 不採用 | 既存作品類似なしを目視確認 |
```

## 推奨生成順

1. A1 戦闘アリーナ背景
2. A2 ボス本体
3. A3 コアガード砲台セット
4. A5 信号エフェクトセット
5. A6 アクションアイコンセット
6. A7 HUDパネル用テクスチャ
7. A4 リンクコア
8. B1以降の補助素材

最初はA1からA3だけを作り、現在の画面に仮配置してから、エフェクトとHUD素材を足す。背景、ボス、砲台の3点が揃うと、画面の印象が大きく変わる。
