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
    <svg
      className={['game-core-visual', `core-${state}`, compact ? 'compact' : '', className].filter(Boolean).join(' ')}
      viewBox="0 0 220 220"
      role="img"
      aria-label="リンクコア"
    >
      <defs>
        <radialGradient id="link-core-glow" cx="50%" cy="46%" r="56%">
          <stop offset="0%" stopColor="#fffbd6" />
          <stop offset="44%" stopColor="#35c2d8" />
          <stop offset="100%" stopColor="#2f80ed" />
        </radialGradient>
        <linearGradient id="link-core-line" x1="0%" x2="100%" y1="50%" y2="50%">
          <stop offset="0%" stopColor="#35c2d8" stopOpacity="0" />
          <stop offset="48%" stopColor="#35c2d8" />
          <stop offset="100%" stopColor="#35c2d8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="core-links">
        <path d="M110 18v44" />
        <path d="M110 158v44" />
        <path d="M18 110h44" />
        <path d="M158 110h44" />
        <path d="M44 44l32 32" />
        <path d="M144 144l32 32" />
        <path d="M176 44l-32 32" />
        <path d="M76 144l-32 32" />
      </g>
      <g className="core-outer">
        <polygon points="110,30 172,66 172,138 110,190 48,138 48,66" />
        <polygon points="110,48 154,74 154,132 110,172 66,132 66,74" />
      </g>
      <circle className="core-orbit orbit-a" cx="110" cy="110" r="76" />
      <circle className="core-orbit orbit-b" cx="110" cy="110" r="56" />
      <circle className="core-body" cx="110" cy="110" r="43" />
      <circle className="core-node node-a" cx="110" cy="74" r="7" />
      <circle className="core-node node-b" cx="142" cy="124" r="7" />
      <circle className="core-node node-c" cx="79" cy="126" r="7" />
      <path className="core-crack crack-a" d="M97 76l12 22-8 14 14 24-5 20" />
      <path className="core-crack crack-b" d="M128 88l-11 18 17 18-9 23" />
      <path className="core-warning-line" d="M58 142c28-18 72-19 104 1" />
    </svg>
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
    <svg
      className={['boss-unlink-visual', `boss-${state}`, compact ? 'compact' : '', className].filter(Boolean).join(' ')}
      viewBox="0 0 260 200"
      role="img"
      aria-label="アンリンクMK-01"
    >
      <defs>
        <linearGradient id="unlink-armor" x1="10%" x2="90%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#3d3148" />
          <stop offset="55%" stopColor="#21112f" />
          <stop offset="100%" stopColor="#100916" />
        </linearGradient>
        <linearGradient id="unlink-red" x1="0%" x2="100%" y1="50%" y2="50%">
          <stop offset="0%" stopColor="#ff5b77" />
          <stop offset="100%" stopColor="#f6c945" />
        </linearGradient>
      </defs>
      <g className="unlink-cables">
        <path d="M54 54c-28 1-38 16-40 38" />
        <path d="M206 54c28 1 38 16 40 38" />
        <path d="M52 143c-29 10-36 24-34 44" />
        <path d="M208 143c29 10 36 24 34 44" />
      </g>
      <path className="unlink-shadow" d="M53 78c20-43 133-43 154 0 17 34 3 84-35 100-30 13-55 13-84 0-38-16-52-66-35-100z" />
      <path className="unlink-armor" d="M55 75c14-36 135-36 150 0 17 40 1 83-38 100-22 10-52 10-74 0-39-17-55-60-38-100z" />
      <path className="unlink-plate left" d="M50 94l-28 16 7 38 34-14z" />
      <path className="unlink-plate right" d="M210 94l28 16-7 38-34-14z" />
      <path className="unlink-horn left" d="M81 57L60 22l48 26z" />
      <path className="unlink-horn right" d="M179 57l21-35-48 26z" />
      <rect className="unlink-eye" x="85" y="91" width="34" height="16" rx="8" />
      <rect className="unlink-eye" x="141" y="91" width="34" height="16" rx="8" />
      <path className="unlink-mouth" d="M96 132h68" />
      <circle className="unlink-core-dot" cx="130" cy="65" r="13" />
      <path className="unlink-mark" d="M99 151h62M111 139l38 24M149 139l-38 24" />
      <g className="unlink-noise">
        <path d="M57 72h24" />
        <path d="M180 72h23" />
        <path d="M70 167h28" />
        <path d="M162 167h29" />
      </g>
    </svg>
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
  return (
    <svg
      className={['coreguard-turret-visual', `turret-${state}`, compact ? 'compact' : '', className].filter(Boolean).join(' ')}
      style={assetStyle(playerId)}
      viewBox="0 0 180 140"
      role="img"
      aria-label="コアガードAI砲台"
    >
      <defs>
        <linearGradient id="turret-body" x1="18%" x2="86%" y1="12%" y2="92%">
          <stop offset="0%" stopColor="var(--asset-accent, #35c2d8)" />
          <stop offset="100%" stopColor="#345995" />
        </linearGradient>
      </defs>
      <path className="turret-shadow" d="M35 117c11 13 96 13 110 0 4-4 2-10-6-12-23-7-76-7-99 0-8 2-10 8-5 12z" />
      <path className="turret-leg left" d="M62 100l-19 23" />
      <path className="turret-leg right" d="M118 100l19 23" />
      <path className="turret-body" d="M42 71c0-28 21-47 48-47s48 19 48 47v22c0 12-9 21-21 21H63c-12 0-21-9-21-21z" />
      <path className="turret-cannon" d="M99 61h52c8 0 13 5 13 12s-5 12-13 12H99z" />
      <circle className="turret-eye" cx="75" cy="65" r="8" />
      <circle className="turret-eye" cx="103" cy="65" r="8" />
      <path className="turret-antenna" d="M90 24V9" />
      <circle className="turret-antenna-dot" cx="90" cy="7" r="5" />
      <circle className="turret-shot" cx="164" cy="73" r="7" />
      <path className="turret-barrier" d="M134 30c27 21 27 64 0 86" />
      <path className="turret-repair-beam" d="M135 84c17 8 27 15 36 30" />
      <path className="turret-noise" d="M52 46h22M109 36h18M62 104h30" />
    </svg>
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
