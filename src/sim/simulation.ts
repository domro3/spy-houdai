import { runCpuGame } from '../cpu/autoplay';
import type { GameState } from '../core/types';

export interface SimulationOptions {
  games: number;
  players: number;
  seed: number;
}

export interface SimulationGameRecord {
  index: number;
  seed: number;
  winner: 'gunners' | 'spy';
  spyBehindWin: boolean;
  rounds: number;
  remainingBossHp: number;
  remainingBaseHp: number;
  bossHealCount: number;
  sabotageCount: number;
  suspiciousCoinUsed: boolean;
}

export interface SimulationSummary {
  games: number;
  players: number;
  seed: number;
  gunnerWins: number;
  spyWins: number;
  spyBehindWins: number;
  gunnerWinRate: number;
  averageRemainingBossHp: number;
  averageRemainingBaseHp: number;
  averageRounds: number;
  averageBossHealCount: number;
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
    }));
  });

  const gunnerWins = records.filter((record) => record.winner === 'gunners').length;
  const spyWins = records.filter((record) => record.winner === 'spy').length;
  const spyBehindWins = records.filter((record) => record.spyBehindWin).length;
  const suspiciousCoinUses = records.filter((record) => record.suspiciousCoinUsed).length;

  return {
    games: options.games,
    players: options.players,
    seed: options.seed,
    gunnerWins,
    spyWins,
    spyBehindWins,
    gunnerWinRate: gunnerWins / options.games,
    averageRemainingBossHp: average(records.map((record) => record.remainingBossHp)),
    averageRemainingBaseHp: average(records.map((record) => record.remainingBaseHp)),
    averageRounds: average(records.map((record) => record.rounds)),
    averageBossHealCount: average(records.map((record) => record.bossHealCount)),
    averageSabotageCount: average(records.map((record) => record.sabotageCount)),
    suspiciousCoinUsageRate: suspiciousCoinUses / options.games,
    suspiciousCoinUses,
    records,
  };
}

export function formatSimulationSummary(summary: SimulationSummary): string {
  return [
    'スパイ砲台 CPU Simulation',
    `試行回数: ${summary.games}`,
    `プレイヤー数: ${summary.players}`,
    `Seed: ${summary.seed}`,
    `砲台チーム勝利数: ${summary.gunnerWins}`,
    `スパイ勝利数: ${summary.spyWins}`,
    `スパイ裏勝利数: ${summary.spyBehindWins}`,
    `砲台チーム勝率: ${formatRate(summary.gunnerWinRate)}`,
    `平均残りボスHP: ${formatNumber(summary.averageRemainingBossHp)}`,
    `平均残り拠点耐久: ${formatNumber(summary.averageRemainingBaseHp)}`,
    `平均ラウンド数: ${formatNumber(summary.averageRounds)}`,
    `ボス回復平均回数: ${formatNumber(summary.averageBossHealCount)}`,
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
    rounds: state.history.length,
    remainingBossHp: state.bossHp,
    remainingBaseHp: state.baseHp,
    bossHealCount: state.result.bossHealingCount,
    sabotageCount: state.result.sabotageCount,
    suspiciousCoinUsed: state.history.some((round) => Boolean(round.suspiciousCoin)),
  };
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}
