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
  baseDestroyed: boolean;
  baseReachedDanger40: boolean;
  baseReachedDanger25: boolean;
  bossHealCount: number;
  spyBossHelpCount: number;
  armorRegenAttemptCount: number;
  armorRegenSuccessCount: number;
  sabotageCount: number;
  defenseCount: number;
  repairCount: number;
  suspiciousCoinUsed: boolean;
  publicLogRoundCount: number;
  shortPublicLogRoundCount: number;
  publicLogLineMin: number;
  publicLogLineMax: number;
  averagePublicLogLines: number;
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
  baseDestroyedCount: number;
  baseDestroyedRate: number;
  baseDanger40Count: number;
  baseDanger40Rate: number;
  baseDanger25Count: number;
  baseDanger25Rate: number;
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
  averageDefenseCount: number;
  averageRepairCount: number;
  suspiciousCoinUsageRate: number;
  suspiciousCoinUses: number;
  publicLogRoundCount: number;
  shortPublicLogRoundRate: number;
  averagePublicLogLinesPerRound: number;
  minPublicLogLinesPerRound: number;
  maxPublicLogLinesPerRound: number;
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
  const baseDestroyedCount = records.filter((record) => record.baseDestroyed).length;
  const baseDanger40Count = records.filter((record) => record.baseReachedDanger40).length;
  const baseDanger25Count = records.filter((record) => record.baseReachedDanger25).length;
  const finalVoteHitSpyCount = records.filter((record) => record.finalVoteHitSpy).length;
  const topSuspicionSpyCount = records.filter((record) => record.topSuspicionWasSpy).length;
  const suspiciousCoinUses = records.filter((record) => record.suspiciousCoinUsed).length;
  const spyBossHelpCount = sum(records.map((record) => record.spyBossHelpCount));
  const armorRegenAttemptCount = sum(records.map((record) => record.armorRegenAttemptCount));
  const armorRegenSuccessCount = sum(records.map((record) => record.armorRegenSuccessCount));
  const publicLogRoundCount = sum(records.map((record) => record.publicLogRoundCount));

  return {
    games: options.games,
    players: options.players,
    seed: options.seed,
    mode: options.mode ?? 'advanced',
    gunnerWins,
    spyWins,
    spyBehindWins,
    spyBehindWinRate: spyBehindWins / options.games,
    baseDestroyedCount,
    baseDestroyedRate: baseDestroyedCount / options.games,
    baseDanger40Count,
    baseDanger40Rate: baseDanger40Count / options.games,
    baseDanger25Count,
    baseDanger25Rate: baseDanger25Count / options.games,
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
    averageDefenseCount: average(records.map((record) => record.defenseCount)),
    averageRepairCount: average(records.map((record) => record.repairCount)),
    suspiciousCoinUsageRate: suspiciousCoinUses / options.games,
    suspiciousCoinUses,
    publicLogRoundCount,
    shortPublicLogRoundRate: sum(records.map((record) => record.shortPublicLogRoundCount)) / Math.max(1, publicLogRoundCount),
    averagePublicLogLinesPerRound: publicLogRoundCount === 0
      ? 0
      : sum(records.map((record) => record.averagePublicLogLines * record.publicLogRoundCount)) / publicLogRoundCount,
    minPublicLogLinesPerRound: publicLogRoundCount > 0
      ? Math.min(...records.map((record) => record.publicLogLineMin))
      : 0,
    maxPublicLogLinesPerRound: publicLogRoundCount > 0
      ? Math.max(...records.map((record) => record.publicLogLineMax))
      : 0,
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
    `拠点耐久0敗北率: ${formatRate(summary.baseDestroyedRate)} (${summary.baseDestroyedCount}/${summary.games})`,
    `拠点耐久40以下到達率: ${formatRate(summary.baseDanger40Rate)} (${summary.baseDanger40Count}/${summary.games})`,
    `拠点耐久25以下到達率: ${formatRate(summary.baseDanger25Rate)} (${summary.baseDanger25Count}/${summary.games})`,
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
    `守る平均回数: ${formatNumber(summary.averageDefenseCount)}`,
    `直す平均回数: ${formatNumber(summary.averageRepairCount)}`,
    `怪しいコイン使用率: ${formatRate(summary.suspiciousCoinUsageRate)} (${summary.suspiciousCoinUses}/${summary.games})`,
    `短い公開ログ率: ${formatRate(summary.shortPublicLogRoundRate)} (${summary.publicLogRoundCount}ラウンド)`,
    `平均公開ログ行数: ${formatNumber(summary.averagePublicLogLinesPerRound)}行`,
  ].join('\n');
}

function createGameRecord(index: number, seed: number, state: GameState): SimulationGameRecord {
  if (!state.result) {
    throw new Error(`Simulation game ${index} did not finish`);
  }
  const publicLogLineCounts = state.history.map((round) => round.publicLogs.length);
  const shortPublicLogRoundCount = state.history.filter((round) => {
    const maxLines = state.mode === 'party' ? 4 : 5;
    return round.publicLogs.length >= 3 && round.publicLogs.length <= maxLines;
  }).length;

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
    baseDestroyed: state.result.baseDestroyed,
    baseReachedDanger40: state.history.some((round) => round.remainingBaseHp <= 40),
    baseReachedDanger25: state.history.some((round) => round.remainingBaseHp <= 25),
    bossHealCount: state.result.bossHealingCount,
    spyBossHelpCount: state.result.spyBossHelpCount,
    armorRegenAttemptCount: state.result.armorRegenAttemptCount,
    armorRegenSuccessCount: state.result.armorRegenSuccessCount,
    sabotageCount: state.result.sabotageCount,
    defenseCount: sum(state.history.map((round) => round.defenseCount)),
    repairCount: sum(state.history.map((round) => round.repairCount)),
    suspiciousCoinUsed: state.history.some((round) => Boolean(round.suspiciousCoin)),
    publicLogRoundCount: state.history.length,
    shortPublicLogRoundCount,
    publicLogLineMin: publicLogLineCounts.length > 0 ? Math.min(...publicLogLineCounts) : 0,
    publicLogLineMax: publicLogLineCounts.length > 0 ? Math.max(...publicLogLineCounts) : 0,
    averagePublicLogLines: publicLogLineCounts.length > 0 ? average(publicLogLineCounts) : 0,
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
