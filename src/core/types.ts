export type Role = 'gunner' | 'spy';

export type ActionType =
  | 'normal_attack'
  | 'charge_attack'
  | 'defend'
  | 'repair'
  | 'scan'
  | 'fake_attack'
  | 'boss_heal'
  | 'sabotage'
  | 'scramble_log';

export type CpuProfile =
  | 'attacker'
  | 'support'
  | 'defender'
  | 'suspicious'
  | 'follower';

export type GamePhase = 'action' | 'plea' | 'vote' | 'branch' | 'finished';

export type BranchCondition = 'smooth' | 'normal' | 'hard';

export type BranchPlan = 'normal' | 'overdrive' | 'emergency';

export type CoinResult = 'unused' | 'success' | 'failed';

export interface PlayerStats {
  damage: number;
  healing: number;
  mitigated: number;
  sabotage: number;
  bossHealing: number;
  logScrambles: number;
  robotContribution: number;
  wrongCitizenVotes: number;
  chargeSuccesses: number;
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  isCpu: boolean;
  isConnected: boolean;
  cpuProfile: CpuProfile;
  suspicion: number;
  status: 'active' | 'monitored';
  lastAction?: ActionType;
  lastPlea?: string;
  hasUsedCoin: boolean;
  coinResult: CoinResult;
  stats: PlayerStats;
}

export interface ActionSubmission {
  playerId: string;
  type: ActionType;
  targetId?: string;
}

export interface VoteSubmission {
  voterId: string;
  targetId: string;
}

export interface BranchVoteSubmission {
  voterId: string;
  plan: BranchPlan;
}

export interface ScanReport {
  scannerId: string;
  targetId: string;
  result:
    | 'clear'
    | 'weak_signal'
    | 'missing_log'
    | 'contradiction_possible'
    | 'unstable';
}

export interface SuspiciousCoinEvent {
  playerId: string;
  round: number;
  success: boolean;
}

export interface RoundSummary {
  round: number;
  totalDamage: number;
  bossHealing: number;
  baseDamage: number;
  repairs: number;
  defenseCount: number;
  sabotageCount: number;
  scrambleLog: boolean;
  scans: ScanReport[];
  votes: Record<string, number>;
  publicLogs: string[];
  monitoredPlayerId?: string;
  suspiciousCoin?: SuspiciousCoinEvent;
  branchPlan?: BranchPlan;
}

export interface Award {
  title: string;
  playerId: string;
  reason: string;
}

export interface GameResult {
  bossDefeated: boolean;
  baseDestroyed: boolean;
  winner: 'gunners' | 'spy';
  spyBehindWin: boolean;
  spyId: string;
  finalVoteTargetId?: string;
  sabotageCount: number;
  bossHealingCount: number;
  logScrambleCount: number;
  suspiciousCoin?: SuspiciousCoinEvent;
  awards: Award[];
}

export interface BranchState {
  condition?: BranchCondition;
  plan: BranchPlan;
  resolved: boolean;
}

export interface GameState {
  phase: GamePhase;
  round: number;
  maxRounds: number;
  players: Player[];
  bossHp: number;
  bossMaxHp: number;
  baseHp: number;
  baseMaxHp: number;
  submittedActions: Record<string, ActionSubmission>;
  pleas: Record<string, string>;
  votes: Record<string, VoteSubmission>;
  branchVotes: Record<string, BranchVoteSubmission>;
  roundLogs: string[];
  publicLogs: string[];
  privateLogs: Record<string, string[]>;
  debugLogs: string[];
  monitoredPlayerId?: string;
  branchState: BranchState;
  history: RoundSummary[];
  result?: GameResult;
}

export interface GameSetupOptions {
  totalPlayers: number;
  humanPlayers: number;
  seed?: number;
  spyId?: string;
}

export interface RandomSource {
  next(): number;
}
