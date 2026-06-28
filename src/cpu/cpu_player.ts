import { ACTION_BALANCE, PLEA_CARDS } from '../data/constants';
import { evidenceScoreForPlayer } from '../core/inference';
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
  if (state.mode === 'party') return false;
  if (spy.hasUsedCoin || spy.role !== 'spy') return false;
  if (state.round < ACTION_BALANCE.suspiciousCoinMinRound) return false;
  const roundBase = [0, 0, 0, 0.1, 0.2, 0.35][state.round] ?? 0.2;
  const highestCitizenSuspicion = state.players
    .filter((player) => player.role === 'gunner')
    .reduce((max, player) => Math.max(max, player.suspicion), 0);
  const pressureBonus = spy.suspicion >= 5 ? 0.15 : 0;
  const decoyBonus = highestCitizenSuspicion >= 5 ? 0.1 : 0;
  return rng.next() < Math.min(0.7, roundBase + pressureBonus + decoyBonus);
}

export function chooseCpuVote(state: GameState, voter: Player, rng: RandomSource): string {
  if (state.mode === 'party') {
    return choosePartyVote(state, voter, rng);
  }

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

  if (rng.next() < 0.3 && scored[1]) {
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
  if (state.mode === 'party') {
    return choosePartyGunnerAction(state, player, rng);
  }

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
  if (state.mode === 'party') {
    return choosePartySpyAction(state, player, rng);
  }

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
    if (state.mode === 'party') {
      return weightedChoice(candidates.map((candidate) => ({
        value: candidate.id,
        weight: partySabotageTargetWeight(state, candidate),
      })), rng);
    }
    return weightedChoice(candidates.map((candidate) => ({
      value: candidate.id,
      weight: candidate.lastAction === 'charge_attack' ? 3 : 1,
    })), rng);
  }
  return [...candidates].sort((a, b) => b.suspicion - a.suspicion)[0]?.id;
}

function choosePartyGunnerAction(state: GameState, player: Player, rng: RandomSource): ActionType {
  const baseRate = state.baseHp / state.baseMaxHp;
  const bossRate = state.bossHp / state.bossMaxHp;
  const bossAction = state.currentBossAction;
  const recent = state.history.at(-1);
  const recentRepairRate = recent ? recent.repairCount / state.players.length : 0;
  const recentDefenseRate = recent ? recent.defenseCount / state.players.length : 0;
  const options: Array<{ value: ActionType; weight: number }> = [
    { value: 'normal_attack', weight: 62 },
    { value: 'defend', weight: 12 },
    { value: 'repair', weight: baseRate <= 0.55 ? 28 : 7 },
  ];

  if (bossAction.type === 'big_charge') {
    adjust(options, 'defend', baseRate <= 0.45 ? 62 : 48);
    adjust(options, 'normal_attack', baseRate <= 0.45 ? -18 : -10);
    adjust(options, 'repair', baseRate <= 0.35 ? 8 : -6);
  }
  if (bossAction.type === 'target_lock' && bossAction.targetPlayerId === player.id) {
    adjust(options, 'defend', 88);
    adjust(options, 'normal_attack', -24);
    adjust(options, 'repair', -10);
  } else if (bossAction.type === 'target_lock' && baseRate <= 0.45) {
    adjust(options, 'repair', 18);
    adjust(options, 'normal_attack', -6);
  }
  if (bossAction.type === 'armor_regen') {
    adjust(options, 'normal_attack', 44);
    adjust(options, 'defend', -8);
    adjust(options, 'repair', baseRate <= 0.3 ? 0 : -5);
  }
  if (bossAction.type === 'normal_attack' && baseRate <= 0.4) {
    adjust(options, 'repair', 22);
    adjust(options, 'defend', 10);
  }
  if (baseRate <= 0.35) {
    adjust(options, 'repair', 42);
    adjust(options, 'normal_attack', -12);
  }
  if (baseRate <= 0.25) {
    adjust(options, 'repair', 36);
    adjust(options, 'normal_attack', -14);
  }
  if (bossRate <= 0.22) {
    adjust(options, 'normal_attack', 28);
    adjust(options, 'repair', -8);
  }
  if (recentRepairRate >= 0.35 && baseRate >= 0.55) {
    adjust(options, 'repair', -12);
    adjust(options, 'normal_attack', 8);
  }
  if (recentDefenseRate >= 0.45 && bossAction.type !== 'big_charge') {
    adjust(options, 'defend', -10);
    adjust(options, 'normal_attack', 6);
  }

  return weightedChoice(options, rng);
}

function choosePartySpyAction(state: GameState, player: Player, rng: RandomSource): ActionType {
  const bossRate = state.bossHp / state.bossMaxHp;
  const baseRate = state.baseHp / state.baseMaxHp;
  const recent = state.history.at(-1);
  const previousSpyAction = recent?.actions[player.id];
  const recentGuardOrRepairReliance = recent
    ? (recent.defenseCount + recent.repairCount) / state.players.length >= 0.45
    : false;
  const highSuspicion = player.suspicion >= 4;
  const options: Array<{ value: ActionType; weight: number }> = [
    { value: 'normal_attack', weight: state.round <= 2 ? 24 : 16 },
    { value: 'defend', weight: highSuspicion ? 16 : 8 },
    { value: 'repair', weight: baseRate <= 0.55 ? 18 : 6 },
    { value: 'fake_attack', weight: state.round <= 2 ? 28 : 22 },
    { value: 'sabotage', weight: state.round <= 2 ? 18 : 34 },
    { value: 'boss_heal', weight: state.round <= 2 ? 10 : 26 },
  ];

  if (state.currentBossAction.type === 'big_charge') {
    adjust(options, 'defend', 16);
    adjust(options, 'sabotage', highSuspicion ? 6 : 24);
    adjust(options, 'fake_attack', -6);
  }
  if (state.currentBossAction.type === 'target_lock') {
    if (state.currentBossAction.targetPlayerId === player.id) {
      adjust(options, 'defend', 55);
      adjust(options, 'sabotage', -10);
      adjust(options, 'boss_heal', -10);
    } else {
      adjust(options, 'sabotage', highSuspicion ? 8 : 24);
      adjust(options, 'fake_attack', -6);
    }
  }
  if (state.currentBossAction.type === 'armor_regen') {
    adjust(options, 'normal_attack', 12);
    adjust(options, 'fake_attack', 12);
    adjust(options, 'boss_heal', 8);
  }
  if (bossRate <= 0.28) {
    adjust(options, 'boss_heal', 30);
    adjust(options, 'sabotage', 16);
    adjust(options, 'fake_attack', -12);
    adjust(options, 'normal_attack', -10);
  }
  if (baseRate <= 0.35) {
    adjust(options, 'sabotage', 18);
    adjust(options, 'repair', highSuspicion ? 28 : 12);
    adjust(options, 'normal_attack', highSuspicion ? 14 : 6);
    adjust(options, 'fake_attack', 16);
    adjust(options, 'boss_heal', -10);
  }
  if (state.round >= 4 && bossRate <= 0.45) {
    adjust(options, 'sabotage', 12);
    adjust(options, 'boss_heal', 10);
    adjust(options, 'normal_attack', -6);
  }
  if (recentGuardOrRepairReliance) {
    adjust(options, 'sabotage', highSuspicion ? 4 : 14);
    adjust(options, 'boss_heal', 4);
  }
  if (highSuspicion) {
    adjust(options, 'normal_attack', 26);
    adjust(options, 'defend', 18);
    adjust(options, 'repair', baseRate <= 0.55 ? 20 : 8);
    adjust(options, 'sabotage', -24);
    adjust(options, 'boss_heal', -18);
    adjust(options, 'fake_attack', -8);
  }
  if (previousSpyAction === 'sabotage') {
    adjust(options, 'sabotage', -20);
    adjust(options, 'normal_attack', 12);
    adjust(options, 'defend', 8);
  }
  if (previousSpyAction === 'boss_heal') {
    adjust(options, 'boss_heal', -18);
    adjust(options, 'fake_attack', 8);
    adjust(options, 'repair', 8);
  }
  if (previousSpyAction === 'fake_attack' && bossRate <= 0.35) {
    adjust(options, 'normal_attack', 10);
    adjust(options, 'boss_heal', 8);
  }

  return weightedChoice(options, rng);
}

function choosePartyVote(state: GameState, voter: Player, rng: RandomSource): string {
  const candidates = state.players.filter((player) => player.id !== voter.id);
  if (voter.role === 'spy') {
    return weightedChoice(candidates
      .filter((candidate) => candidate.role === 'gunner')
      .map((candidate) => ({ value: candidate.id, weight: 1 })), rng);
  }

  return weightedChoice(candidates.map((candidate) => ({
    value: candidate.id,
    weight: candidate.role === 'spy'
      ? (candidate.lastAction === 'boss_heal' || candidate.lastAction === 'sabotage' ? 1.8 : 1.3)
      : 1,
  })), rng);
}

function partySabotageTargetWeight(state: GameState, candidate: Player): number {
  const bossAction = state.currentBossAction;
  const baseRate = state.baseHp / state.baseMaxHp;
  const bossRate = state.bossHp / state.bossMaxHp;
  if (bossAction.type === 'target_lock' && bossAction.targetPlayerId === candidate.id) return 5;
  if (bossAction.type === 'big_charge') {
    if (candidate.cpuProfile === 'defender') return 4;
    if (candidate.cpuProfile === 'support') return 3;
    return 1.5;
  }
  if (bossAction.type === 'armor_regen') {
    if (candidate.cpuProfile === 'attacker') return 4;
    if (candidate.cpuProfile === 'follower') return 2;
  }
  if (baseRate <= 0.4) {
    if (candidate.cpuProfile === 'support') return 4;
    if (candidate.cpuProfile === 'defender') return 2.5;
  }
  if (bossRate <= 0.3) {
    if (candidate.cpuProfile === 'attacker') return 4;
    if (candidate.cpuProfile === 'follower') return 2.5;
  }
  return 1;
}

function suspicionScore(state: GameState, voter: Player, target: Player): number {
  const evidenceScore = evidenceScoreForPlayer(state, target.id);
  const recentEvidence = [...state.history]
    .slice(-2)
    .flatMap((summary) => summary.evidence)
    .filter((event) => event.playerId === target.id)
    .reduce((sum, event) => sum + event.weight, 0);
  const finalHintBonus = state.inferenceHints.some((hint) => hint.playerId === target.id) ? 0.5 : 0;
  const spyAvoidance = voter.role === 'spy' && target.role === 'spy' ? -100 : 0;
  return target.suspicion * 1.35 + evidenceScore * 0.65 + recentEvidence * 0.7 + finalHintBonus + spyAvoidance;
}

function adjust(options: Array<{ value: ActionType; weight: number }>, value: ActionType, delta: number): void {
  const option = options.find((item) => item.value === value);
  if (option) {
    option.weight = Math.max(0, option.weight + delta);
  }
}
