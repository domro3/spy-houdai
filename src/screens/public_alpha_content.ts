import type { GameIconName } from '../components/game/assets/visual/GameVisualAssets';

export interface PublicAlphaHighlight {
  icon: GameIconName;
  label: string;
  value: string;
}

export const PUBLIC_ALPHA_ENTRY = {
  kicker: 'Public Alpha v0.1 / スマホ単体ルート',
  headlineLines: ['5分で見つける', '通信スパイ'],
  body: 'ボスを止める5基の砲台に、1基だけ妨害役が紛れます。あなたはp1を操作し、残りの砲台はCPUが同期します。',
  primaryCta: 'この端末で開始',
  boardCta: '共有Boardを見る',
  routeActions: ['P1端末', 'Board', '開発Shell'],
  highlights: [
    { icon: 'timer', label: '5から8分目安', value: '1ゲームを短く検証' },
    { icon: 'player', label: 'スマホ縦推奨', value: 'p1をこの端末で操作' },
    { icon: 'sync', label: 'CPU4基同期', value: 'Boardなしで最後まで進行' },
  ] satisfies PublicAlphaHighlight[],
} as const;
