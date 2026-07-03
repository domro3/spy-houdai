import type { CSSProperties, ComponentType } from 'react';
import {
  AlertTriangle,
  Bot,
  Bug,
  Cable,
  Clock3,
  Crosshair,
  FileText,
  Gauge,
  Link2,
  RadioTower,
  ScanSearch,
  Shield,
  Skull,
  Swords,
  Unlink,
  UserRound,
  Wrench,
  Zap,
  type LucideProps,
} from 'lucide-react';

export type BackgroundAssetName = 'operation-terminal' | 'boss-battle';
export type LinkCoreState = 'idle' | 'damage' | 'critical';
export type BossMk01State = 'idle' | 'attack' | 'charge' | 'damaged' | 'danger';
export type CoreGuardTurretState = 'idle' | 'attack' | 'guard' | 'repair' | 'suspect';
export type GameEffectName = 'shot-data' | 'guard-barrier' | 'repair-link' | 'noise-corruption' | 'sync-complete';
export type GameIconName =
  | 'attack'
  | 'guard'
  | 'repair'
  | 'scan'
  | 'spy'
  | 'fake-attack'
  | 'sabotage'
  | 'sync'
  | 'warning'
  | 'core'
  | 'boss'
  | 'player'
  | 'timer'
  | 'log';

const iconMap: Record<GameIconName, ComponentType<LucideProps>> = {
  attack: Swords,
  guard: Shield,
  repair: Wrench,
  scan: ScanSearch,
  spy: Bug,
  'fake-attack': Crosshair,
  sabotage: Cable,
  sync: Link2,
  warning: AlertTriangle,
  core: RadioTower,
  boss: Skull,
  player: UserRound,
  timer: Clock3,
  log: FileText,
};

const playerAccents: Record<string, string> = {
  p1: '#2f80ed',
  p2: '#35c2d8',
  p3: '#36b37e',
  p4: '#f6c945',
  p5: '#f58b4b',
  p6: '#9a6bff',
};

export function generatedAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

const generatedAssets = {
  bossUnlinkMk01: generatedAssetUrl('assets/generated/boss_unlink_mk01_idle.png'),
  coreGuardTurret: generatedAssetUrl('assets/generated/turret_coreguard_base_blue.png'),
  linkCore: generatedAssetUrl('assets/generated/link_core_idle.png'),
} as const;

function assetStyle(playerId?: string): CSSProperties | undefined {
  if (!playerId) return undefined;
  return { '--asset-accent': playerAccents[playerId] ?? '#35c2d8' } as CSSProperties;
}

export function GameBackdrop({ variant }: { variant: BackgroundAssetName }) {
  return <div className={`game-backdrop bg-${variant}`} aria-hidden="true" />;
}

export function GameIcon({
  name,
  size = 32,
  className,
}: {
  name: GameIconName;
  size?: 32 | 64 | number;
  className?: string;
}) {
  const Icon = iconMap[name];
  return (
    <span className={['game-icon', `icon-${name}`, className].filter(Boolean).join(' ')} aria-hidden="true">
      <Icon size={size} strokeWidth={2.6} />
    </span>
  );
}

export function LinkCoreVisual({
  state = 'idle',
  compact = false,
  className,
}: {
  state?: LinkCoreState;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={['game-core-visual', 'generated-core', `core-${state}`, compact ? 'compact' : '', className].filter(Boolean).join(' ')}
      role="img"
      aria-label="リンクコア"
    >
      <img src={generatedAssets.linkCore} alt="" draggable={false} />
    </span>
  );
}

export function BossUnlinkMk01({
  state = 'idle',
  compact = false,
  className,
}: {
  state?: BossMk01State;
  compact?: boolean;
  className?: string;
}) {
  return (
    <img
      className={['boss-unlink-visual', 'generated-boss', `boss-${state}`, compact ? 'compact' : '', className].filter(Boolean).join(' ')}
      src={generatedAssets.bossUnlinkMk01}
      alt="アンリンクMK-01"
      draggable={false}
    />
  );
}

export function CoreGuardTurret({
  state = 'idle',
  playerId,
  compact = false,
  className,
}: {
  state?: CoreGuardTurretState;
  playerId?: string;
  compact?: boolean;
  className?: string;
}) {
  const playerClass = playerId ? `player-${playerId}` : '';

  return (
    <span
      className={['coreguard-turret-visual', 'generated-turret', `turret-${state}`, playerClass, compact ? 'compact' : '', className].filter(Boolean).join(' ')}
      style={assetStyle(playerId)}
      role="img"
      aria-label="コアガードAI砲台"
    >
      <img src={generatedAssets.coreGuardTurret} alt="" draggable={false} />
    </span>
  );
}

export function GameEffect({
  name,
  active = true,
  className,
}: {
  name: GameEffectName;
  active?: boolean;
  className?: string;
}) {
  return (
    <span className={['game-effect', `effect-${name}`, active ? 'active' : '', className].filter(Boolean).join(' ')} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

export function actionIconName(actionType: string): GameIconName {
  if (actionType === 'defend') return 'guard';
  if (actionType === 'repair') return 'repair';
  if (actionType === 'scan') return 'scan';
  if (actionType === 'fake_attack') return 'fake-attack';
  if (actionType === 'sabotage' || actionType === 'scramble_log') return 'sabotage';
  if (actionType === 'boss_heal') return 'spy';
  return 'attack';
}

export function turretStateForAction(actionType?: string, wasSabotaged = false): CoreGuardTurretState {
  if (wasSabotaged) return 'suspect';
  if (actionType === 'defend') return 'guard';
  if (actionType === 'repair') return 'repair';
  if (actionType === 'sabotage' || actionType === 'scramble_log' || actionType === 'fake_attack' || actionType === 'boss_heal') {
    return 'suspect';
  }
  if (actionType) return 'attack';
  return 'idle';
}
