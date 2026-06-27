import { runCpuGame } from '../cpu/autoplay';
import type { GameMode, GameState } from '../core/types';

export interface SimulationOptions {
  games: number;
  players: number;
  seed: number;
  mode?: GameMode;
}

export interface SimulationGameRecord {
  index: number;
  seed: number;
  winner: 'gunners' | 'spy';
  spyBehindWin: boolean;
  finalVoteHitSpy: boolean;
  topSuspicionWasSpy: boolean;
  rounds: number;
  remainingBossHp: number;
  remainingBaseHp: number;
  bossHealCount: number;
  spyBossHelpCount: number;
  armorRegenAttemptCount: number;
  armorRegenSuccessCount: number;
  sabotageCount: number;
  suspiciousCoinUsed: boolean;
}

export interface SimulationSummary {
  games: number;
  players: number;
  seed: number;
  mode: GameMode;
  gunnerWins: number;
  spyWins: number;
  spyBehindWins: number;
  spyBehindWinRate: number;
  finalVoteHitSpyCount: number;
  topSuspicionSpyRate: number;
  gunnerWinRate: number;
  averageRemainingBossHp: number;
  averageRemainingBaseHp: number;
  averageRounds: number;
  averageBossHealCount: number;
  spyBossHelpCount: number;
  armorRegenAttemptCount: number;
  armorRegenSuccessCount: number;
  averageSpyBossHelpCount: number;
  averageArmorRegenAttemptCount: number;
  averageArmorRegenSuccessCount: number;
  averageSabotageCount: number;
  suspiciousCoinUsageRate: number;
  suspiciousCoinUses: number;
  records: SimulationGameRecord[];
}

export function runSimulation(options: SimulationOptions): SimulationSummary {
  if (!Number.isInteger(options.games) || options.games <= 0) {
    throw new Error('--games must be a positive integer');
  }
  if (!Number.isInteger(options.players) || options.players < 4 || options.players > 6) {
    throw new Error('--players must be an integer between 4 and 6');
  }
  if (!Number.isInteger(options.seed)) {
    throw new Error('--seed must be an integer');
  }

  const records = Array.from({ length: options.games }, (_, index) => {
    const gameSeed = options.seed + index;
    return createGameRecord(index + 1, gameSeed, runCpuGame({
      totalPlayers: options.players,
      humanPlayers: 0,
      seed: gameSeed,
      mode: options.mode ?? 'advanced',
    }));
  });

  const gunnerWins = records.filter((record) => record.winner === 'gunners').length;
  const spyWins = records.filter((record) => record.winner === 'spy').length;
  const spyBehindWins = records.filter((record) => record.spyBehindWin).length;
  const finalVoteHitSpyCount = records.filter((record) => record.finalVoteHitSpy).length;
  const topSuspicionSpyCount = records.filter((record) => record.topSuspicionWasSpy).length;
  const suspiciousCoinUses = records.filter((record) => record.suspiciousCoinUsed).length;
  const spyBossHelpCount = sum(records.map((record) => record.spyBossHelpCount));
  const armorRegenAttemptCount = sum(records.map((record) => record.armorRegenAttemptCount));
  const armorRegenSuccessCount = sum(records.map((record) => record.armorRegenSuccessCount));

  return {
    games: options.games,
    players: options.players,
    seed: options.seed,
    mode: options.mode ?? 'advanced',
    gunnerWins,
    spyWins,
    spyBehindWins,
    spyBehindWinRate: spyBehindWins / options.games,
    finalVoteHitSpyCount,
    topSuspicionSpyRate: topSuspicionSpyCount / options.games,
    gunnerWinRate: gunnerWins / options.games,
    averageRemainingBossHp: average(records.map((record) => record.remainingBossHp)),
    averageRemainingBaseHp: average(records.map((record) => record.remainingBaseHp)),
    averageRounds: average(records.map((record) => record.rounds)),
    averageBossHealCount: average(records.map((record) => record.bossHealCount)),
    spyBossHelpCount,
    armorRegenAttemptCount,
    armorRegenSuccessCount,
    averageSpyBossHelpCount: spyBossHelpCount / options.games,
    averageArmorRegenAttemptCount: armorRegenAttemptCount / options.games,
    averageArmorRegenSuccessCount: armorRegenSuccessCount / options.games,
    averageSabotageCount: average(records.map((record) => record.sabotageCount)),
    suspiciousCoinUsageRate: suspiciousCoinUses / options.games,
    suspiciousCoinUses,
    records,
  };
}

export function formatSimulationSummary(summary: SimulationSummary): string {
  return [
    'スパイ砲台 CPU Simulation',
    `モード: ${summary.mode === 'party' ? 'Party Mode' : 'Advanced Mode'}`,
    `試行回数: ${summary.games}`,
    `プレイヤー数: ${summary.players}`,
    `Seed: ${summary.seed}`,
    `砲台チーム勝利数: ${summary.gunnerWins}`,
    `スパイ勝利数: ${summary.spyWins}`,
    `最終投票でスパイを当てた回数: ${summary.finalVoteHitSpyCount}`,
    `スパイ裏勝利数: ${summary.spyBehindWins}`,
    `スパイ裏勝利率: ${formatRate(summary.spyBehindWinRate)}`,
    `砲台チーム勝率: ${formatRate(summary.gunnerWinRate)}`,
    `平均疑惑メーター上位者がスパイだった割合: ${formatRate(summary.topSuspicionSpyRate)}`,
    `平均残りボスHP: ${formatNumber(summary.averageRemainingBossHp)}`,
    `平均残り拠点耐久: ${formatNumber(summary.averageRemainingBaseHp)}`,
    `平均ラウンド数: ${formatNumber(summary.averageRounds)}`,
    `ボス回復平均回数: ${formatNumber(summary.averageBossHealCount)}`,
    `スパイ支援平均回数: ${formatNumber(summary.averageSpyBossHelpCount)} (${summary.spyBossHelpCount}/${summary.games})`,
    `装甲再生試行平均回数: ${formatNumber(summary.averageArmorRegenAttemptCount)} (${summary.armorRegenAttemptCount}/${summary.games})`,
    `装甲再生成功平均回数: ${formatNumber(summary.averageArmorRegenSuccessCount)} (${summary.armorRegenSuccessCount}/${summary.games})`,
    `妨害平均回数: ${formatNumber(summary.averageSabotageCount)}`,
    `怪しいコイン使用率: ${formatRate(summary.suspiciousCoinUsageRate)} (${summary.suspiciousCoinUses}/${summary.games})`,
  ].join('\n');
}

function createGameRecord(index: number, seed: number, state: GameState): SimulationGameRecord {
  if (!state.result) {
    throw new Error(`Simulation game ${index} did not finish`);
  }

  return {
    index,
    seed,
    winner: state.result.winner,
    spyBehindWin: state.result.spyBehindWin,
    finalVoteHitSpy: state.result.finalVoteTargetId === state.result.spyId,
    topSuspicionWasSpy: topSuspicionPlayerId(state) === state.result.spyId,
    rounds: state.history.length,
    remainingBossHp: state.bossHp,
    remainingBaseHp: state.baseHp,
    bossHealCount: state.result.bossHealingCount,
    spyBossHelpCount: state.result.spyBossHelpCount,
    armorRegenAttemptCount: state.result.armorRegenAttemptCount,
    armorRegenSuccessCount: state.result.armorRegenSuccessCount,
    sabotageCount: state.result.sabotageCount,
    suspiciousCoinUsed: state.history.some((round) => Boolean(round.suspiciousCoin)),
  };
}

function topSuspicionPlayerId(state: GameState): string | undefined {
  return [...state.players].sort((a, b) => b.suspicion - a.suspicion)[0]?.id;
}

function average(values: number[]): number {
  return sum(values) / values.length;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}
