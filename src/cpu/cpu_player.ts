import { ACTION_BALANCE, PLEA_CARDS } from '../data/constants';
import { weightedChoice } from '../core/random';
import type { ActionSubmission, ActionType, BranchPlan, GameState, Player, RandomSource } from '../core/types';

export function chooseCpuAction(state: GameState, player: Player, rng: RandomSource): ActionSubmission {
  const type = player.role === 'spy'
    ? chooseSpyAction(state, player, rng)
    : chooseGunnerAction(state, player, rng);

  return {
    playerId: player.id,
    type,
    targetId: chooseTargetId(state, player, type, rng),
  };
}

export function chooseCpuPlea(_state: GameState, player: Player, rng: RandomSource): string {
  const action = player.lastAction;
  if (!action) return weightedChoice(PLEA_CARDS.map((value) => ({ value, weight: 1 })), rng);

  if (player.role === 'spy') {
    if (action === 'fake_attack') return '攻撃しました';
    if (action === 'boss_heal') return weightedChoice([
      { value: '攻撃しました', weight: 2 },
      { value: 'スキャンしました', weight: 1 },
      { value: '出力が不安定でした', weight: 1 },
    ], rng);
    if (action === 'sabotage') return weightedChoice([
      { value: '妨害されました', weight: 2 },
      { value: '攻撃しました', weight: 1 },
    ], rng);
    if (action === 'scramble_log') return weightedChoice([
      { value: '出力が不安定でした', weight: 2 },
      { value: '防御しました', weight: 1 },
    ], rng);
  }

  switch (action) {
    case 'normal_attack':
    case 'charge_attack':
      return weightedChoice([
        { value: '攻撃しました', weight: 3 },
        { value: '出力が不安定でした', weight: action === 'charge_attack' ? 1 : 0 },
      ], rng);
    case 'defend':
      return '防御しました';
    case 'repair':
      return '回復しました';
    case 'scan':
      return 'スキャンしました';
    default:
      return weightedChoice(PLEA_CARDS.map((value) => ({ value, weight: 1 })), rng);
  }
}

export function shouldUseSuspiciousCoin(state: GameState, spy: Player, rng: RandomSource): boolean {
  if (spy.hasUsedCoin || spy.role !== 'spy') return false;
  const roundBase = [0, 0, 0.1, 0.2, 0.4, 0.6][state.round] ?? 0.4;
  const highestCitizenSuspicion = state.players
    .filter((player) => player.role === 'gunner')
    .reduce((max, player) => Math.max(max, player.suspicion), 0);
  const pressureBonus = spy.suspicion >= 5 ? 0.3 : 0;
  const decoyBonus = highestCitizenSuspicion >= 5 ? 0.2 : 0;
  return rng.next() < Math.min(0.95, roundBase + pressureBonus + decoyBonus);
}

export function chooseCpuVote(state: GameState, voter: Player, rng: RandomSource): string {
  const candidates = state.players.filter((player) => player.id !== voter.id);
  const scored = candidates
    .map((target) => ({
      player: target,
      score: suspicionScore(state, voter, target),
    }))
    .sort((a, b) => b.score - a.score);

  if (voter.role === 'spy') {
    const citizenTargets = scored.filter((item) => item.player.role === 'gunner');
    const decoy = citizenTargets[0] ?? scored[0];
    return decoy.player.id;
  }

  if (rng.next() < 0.2 && scored[1]) {
    return scored[Math.min(scored.length - 1, 1 + Math.floor(rng.next() * 2))].player.id;
  }
  return scored[0].player.id;
}

export function chooseCpuBranchPlan(state: GameState, voter: Player, rng: RandomSource): BranchPlan {
  const condition = state.branchState.condition ?? 'normal';
  if (condition === 'normal') return 'normal';
  if (voter.role === 'spy') {
    return condition === 'smooth'
      ? weightedChoice([
        { value: 'overdrive' as const, weight: 3 },
        { value: 'normal' as const, weight: 1 },
      ], rng)
      : weightedChoice([
        { value: 'normal' as const, weight: 3 },
        { value: 'emergency' as const, weight: 1 },
      ], rng);
  }
  if (condition === 'smooth') {
    return weightedChoice([
      { value: 'overdrive' as const, weight: 2 },
      { value: 'normal' as const, weight: 1 },
    ], rng);
  }
  return weightedChoice([
    { value: 'emergency' as const, weight: 2 },
    { value: 'normal' as const, weight: 1 },
  ], rng);
}

function chooseGunnerAction(state: GameState, player: Player, rng: RandomSource): ActionType {
  const needsRepair = state.baseHp <= 45;
  const needsDefense = state.baseHp <= 35;
  const bossLow = state.bossHp / state.bossMaxHp <= 0.25;
  const profileWeights: Record<Player['cpuProfile'], Array<{ value: ActionType; weight: number }>> = {
    attacker: [
      { value: 'normal_attack', weight: bossLow ? 55 : 45 },
      { value: 'charge_attack', weight: 35 },
      { value: 'defend', weight: needsDefense ? 15 : 5 },
      { value: 'repair', weight: needsRepair ? 20 : 5 },
      { value: 'scan', weight: 10 },
    ],
    support: [
      { value: 'normal_attack', weight: 25 },
      { value: 'charge_attack', weight: 10 },
      { value: 'defend', weight: needsDefense ? 35 : 25 },
      { value: 'repair', weight: needsRepair ? 45 : 30 },
      { value: 'scan', weight: 10 },
    ],
    defender: [
      { value: 'normal_attack', weight: 25 },
      { value: 'charge_attack', weight: 10 },
      { value: 'defend', weight: needsDefense ? 50 : 40 },
      { value: 'repair', weight: needsRepair ? 30 : 15 },
      { value: 'scan', weight: 10 },
    ],
    suspicious: [
      { value: 'normal_attack', weight: 25 },
      { value: 'charge_attack', weight: 15 },
      { value: 'defend', weight: needsDefense ? 20 : 10 },
      { value: 'repair', weight: needsRepair ? 20 : 10 },
      { value: 'scan', weight: 40 },
    ],
    follower: [
      { value: 'normal_attack', weight: 35 },
      { value: 'charge_attack', weight: 15 },
      { value: 'defend', weight: needsDefense ? 25 : 15 },
      { value: 'repair', weight: needsRepair ? 25 : 15 },
      { value: 'scan', weight: 20 },
    ],
  };

  return weightedChoice(profileWeights[player.cpuProfile], rng);
}

function chooseSpyAction(state: GameState, player: Player, rng: RandomSource): ActionType {
  const roundTables: Record<number, Array<{ value: ActionType; weight: number }>> = {
    1: [
      { value: 'normal_attack', weight: 35 },
      { value: 'fake_attack', weight: 35 },
      { value: 'defend', weight: 10 },
      { value: 'repair', weight: 10 },
      { value: 'scan', weight: 10 },
    ],
    2: [
      { value: 'normal_attack', weight: 25 },
      { value: 'fake_attack', weight: 30 },
      { value: 'defend', weight: 5 },
      { value: 'repair', weight: 5 },
      { value: 'scan', weight: 10 },
      { value: 'boss_heal', weight: 10 },
      { value: 'sabotage', weight: 10 },
      { value: 'scramble_log', weight: 5 },
    ],
    3: [
      { value: 'normal_attack', weight: 20 },
      { value: 'fake_attack', weight: 25 },
      { value: 'defend', weight: 5 },
      { value: 'repair', weight: 5 },
      { value: 'scan', weight: 10 },
      { value: 'boss_heal', weight: 15 },
      { value: 'sabotage', weight: 15 },
      { value: 'scramble_log', weight: 5 },
    ],
    4: [
      { value: 'normal_attack', weight: 15 },
      { value: 'fake_attack', weight: 25 },
      { value: 'defend', weight: 5 },
      { value: 'repair', weight: 5 },
      { value: 'scan', weight: 5 },
      { value: 'boss_heal', weight: 20 },
      { value: 'sabotage', weight: 20 },
      { value: 'scramble_log', weight: 5 },
    ],
    5: [
      { value: 'normal_attack', weight: 10 },
      { value: 'fake_attack', weight: 20 },
      { value: 'boss_heal', weight: 30 },
      { value: 'sabotage', weight: 30 },
      { value: 'scramble_log', weight: 10 },
    ],
  };

  const options = roundTables[state.round].map((option) => ({ ...option }));
  const bossRate = state.bossHp / state.bossMaxHp;
  const baseRate = state.baseHp / state.baseMaxHp;
  adjust(options, 'normal_attack', player.suspicion >= 5 ? 15 : 0);
  adjust(options, 'fake_attack', player.suspicion >= 5 ? 10 : 0);
  adjust(options, 'boss_heal', player.suspicion >= 5 ? -10 : 0);
  adjust(options, 'sabotage', player.suspicion >= 5 ? -10 : 0);
  adjust(options, 'scramble_log', player.suspicion >= 5 ? -5 : 0);
  adjust(options, 'boss_heal', bossRate <= 0.3 ? 15 : 0);
  adjust(options, 'sabotage', bossRate <= 0.3 ? 15 : 0);
  adjust(options, 'normal_attack', bossRate <= 0.3 ? -10 : 0);
  adjust(options, 'fake_attack', bossRate <= 0.3 ? -10 : 0);
  adjust(options, 'fake_attack', baseRate <= 0.3 ? 10 : 0);
  adjust(options, 'boss_heal', baseRate <= 0.3 ? -10 : 0);
  if (state.monitoredPlayerId === player.id) {
    adjust(options, 'normal_attack', 20);
    adjust(options, 'defend', 10);
    adjust(options, 'sabotage', -15);
    adjust(options, 'boss_heal', -15);
  }
  return weightedChoice(options, rng);
}

function chooseTargetId(state: GameState, player: Player, type: ActionType, rng: RandomSource): string | undefined {
  if (type !== 'scan' && type !== 'sabotage') return undefined;
  const candidates = state.players.filter((candidate) => candidate.id !== player.id);
  if (type === 'sabotage') {
    return weightedChoice(candidates.map((candidate) => ({
      value: candidate.id,
      weight: candidate.lastAction === 'charge_attack' ? 3 : 1,
    })), rng);
  }
  return [...candidates].sort((a, b) => b.suspicion - a.suspicion)[0]?.id;
}

function suspicionScore(state: GameState, voter: Player, target: Player): number {
  const wasMonitored = state.monitoredPlayerId === target.id ? 2 : 0;
  const latestScan = [...state.history]
    .reverse()
    .flatMap((summary) => summary.scans)
    .find((scan) => scan.targetId === target.id);
  const scanScore = latestScan?.result === 'weak_signal'
    ? 2
    : latestScan?.result === 'missing_log' || latestScan?.result === 'contradiction_possible'
      ? 3
      : latestScan?.result === 'clear'
        ? -1
        : 0;
  const spyAvoidance = voter.role === 'spy' && target.role === 'spy' ? -100 : 0;
  return target.suspicion * 2 + wasMonitored + scanScore + spyAvoidance;
}

function adjust(options: Array<{ value: ActionType; weight: number }>, value: ActionType, delta: number): void {
  const option = options.find((item) => item.value === value);
  if (option) {
    option.weight = Math.max(0, option.weight + delta);
  }
}
