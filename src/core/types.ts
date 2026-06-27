export type Role = 'gunner' | 'spy';

export type GameMode = 'party' | 'advanced';

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

export type BossActionType =
  | 'normal_attack'
  | 'big_charge'
  | 'armor_regen'
  | 'target_lock';

export interface BossDefinition {
  id: string;
  name: string;
  description: string;
  maxHpByPlayerCount: Record<4 | 5 | 6, number>;
  actionWeights: Partial<Record<BossActionType, number>>;
  specialRules?: string[];
}

export interface BossActionPlan {
  type: BossActionType;
  targetPlayerId?: string;
}

export type BranchCondition = 'smooth' | 'normal' | 'hard';

export type BranchPlan = 'normal' | 'overdrive' | 'emergency';

export type CoinResult = 'unused' | 'success' | 'failed';

export type ScanResult = 'clear' | 'weak_noise' | 'strong_signal' | 'unstable';

export type EvidenceKind =
  | 'scan_clear'
  | 'scan_weak_noise'
  | 'scan_strong_signal'
  | 'monitored_noise'
  | 'monitored_mismatch'
  | 'monitored_clear';

export interface PlayerStats {
  damage: number;
  healing: number;
  mitigated: number;
  sabotage: number;
  sabotageAttack: number;
  sabotageDefense: number;
  sabotageRepair: number;
  bossSyncedSabotage: number;
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
  result: ScanResult;
}

export interface EvidenceEvent {
  playerId: string;
  round: number;
  kind: EvidenceKind;
  weight: number;
  reason: string;
}

export interface InferenceHint {
  playerId: string;
  suspicion: number;
  score: number;
  reason: string;
}

export interface SuspiciousCoinEvent {
  playerId: string;
  round: number;
  success: boolean;
}

export interface RoundSummary {
  round: number;
  bossAction?: BossActionPlan;
  totalDamage: number;
  bossHealing: number;
  spyBossHelpCount: number;
  armorRegenAttemptCount: number;
  armorRegenSuccessCount: number;
  baseDamage: number;
  repairs: number;
  defenseCount: number;
  sabotageCount: number;
  scrambleLog: boolean;
  scans: ScanReport[];
  votes: Record<string, number>;
  publicLogs: string[];
  evidence: EvidenceEvent[];
  monitoredHint?: string;
  monitoredPlayerId?: string;
  suspiciousCoin?: SuspiciousCoinEvent;
  branchPlan?: BranchPlan;
}

export interface Award {
  title: string;
  playerId?: string;
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
  spyBossHelpCount: number;
  armorRegenAttemptCount: number;
  armorRegenSuccessCount: number;
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
  mode: GameMode;
  phase: GamePhase;
  round: number;
  maxRounds: number;
  players: Player[];
  boss: BossDefinition;
  currentBossAction: BossActionPlan;
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
  inferenceHints: InferenceHint[];
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
  mode?: GameMode;
  bossId?: string;
}

export interface RandomSource {
  next(): number;
}
