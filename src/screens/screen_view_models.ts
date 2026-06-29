import { bossActionLabel, bossForecastLabel, requiresTarget, type GameEngine } from '../core/game_engine';
import type { ActionType, BossActionType, BranchPlan, GameMode, GamePhase } from '../core/types';
import { PLEA_CARDS } from '../data/constants';
import { actionHelp, actionLabel, branchHelp, branchPlanLabel, controlLabel, roleLabel, suspicionStars } from '../view/format';
import {
  branchOptions,
  partyBaseWarning,
  partyBossHint,
  phaseInputLabel,
  phaseInstruction,
  phaseLabel,
  phaseReadyCount,
} from './screen_state';

export interface HostPlayerView {
  id: string;
  name: string;
  control: string;
  role: string;
  status: string;
  inputStatus: string;
  inputTone: 'ready' | 'waiting' | 'auto' | 'done';
}

export interface HostVoteView {
  playerId: string;
  name: string;
  count: number;
}

export interface HostBoardView {
  mode: GameMode;
  modeLabel: string;
  phase: GamePhase;
  phaseLabel: string;
  round: number;
  maxRounds: number;
  flowKicker: string;
  flowTitle: string;
  flowBody: string;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossActionType: BossActionType;
  bossActionLabel: string;
  bossActionForecast: string;
  bossTargetName?: string;
  baseHp: number;
  baseMaxHp: number;
  baseWarning?: {
    level: 'warning' | 'critical';
    title: string;
    body: string;
  };
  inputLabel: string;
  ready: number;
  readyTotal: number;
  latestRound?: {
    round: number;
    totalDamage: number;
    bossHealing: number;
    baseDamage: number;
    repairs: number;
    defenseCount: number;
    sabotageCount: number;
    sabotagePressure: boolean;
  };
  monitoredName?: string;
  monitoredSuspicion?: string;
}

export interface HostScreenViewModel {
  board: HostBoardView;
  players: HostPlayerView[];
  publicLogs: string[];
  latestVotes: HostVoteView[];
}

export interface PlayerScreenViewModel {
  id: string;
  name: string;
  control: string;
  role: string;
  phase: GamePhase;
  mode: GameMode;
  phaseInstruction: string;
  isConnected: boolean;
  status: string;
  players: Array<{ id: string; name: string }>;
  targetOptions: Array<{ id: string; name: string }>;
  voteOptions: Array<{ id: string; name: string }>;
  availableActions: Array<{ type: ActionType; label: string; help: string; requiresTarget: boolean }>;
  privateLogs: string[];
  selectedActionLabel: string;
  selectedActionType?: ActionType;
  selectedActionTargetId?: string;
  selectedActionTargetName?: string;
  selectedVoteTargetId?: string;
  selectedVoteTargetName?: string;
  selectedPlea?: string;
  pleaOptions: string[];
  selectedBranchPlan?: BranchPlan;
  branchOptions: Array<{ plan: BranchPlan; label: string; help: string }>;
  inferenceHints: Array<{ playerId: string; playerName: string; suspicion: number; suspicionStars: string; reason: string }>;
  recentActionLabel: string;
  wasSabotaged: boolean;
  result?: {
    winner: string;
    votedTarget: string;
    spyName: string;
    finalVoteOutcome?: string;
    awards: Array<{
      title: string;
      owner: string;
      reason: string;
      isMine: boolean;
    }>;
  };
}

export function createHostScreenViewModel(engine: GameEngine): HostScreenViewModel {
  const state = engine.state;
  const latestVotes = Object.entries(state.history.at(-1)?.votes ?? {}).map(([playerId, count]) => ({
    playerId,
    name: engine.getPlayer(playerId).name,
    count,
  }));

  return {
    board: createHostBoardView(engine),
    players: state.players.map((player) => {
      const input = publicInputStatus(engine, player.id);
      return {
        id: player.id,
        name: player.name,
        control: controlLabel(player),
        role: state.phase === 'finished' ? roleLabel(player) : '非公開',
        status: player.isConnected ? '有人リンク' : 'ロボ待機',
        inputStatus: input.label,
        inputTone: input.inputTone,
      };
    }),
    publicLogs: state.publicLogs,
    latestVotes,
  };
}

function createHostBoardView(engine: GameEngine): HostBoardView {
  const state = engine.state;
  const readyCount = phaseReadyCount(engine);
  const bossTarget = state.currentBossAction.targetPlayerId
    ? engine.getPlayer(state.currentBossAction.targetPlayerId)
    : undefined;
  const monitored = state.monitoredPlayerId ? engine.getPlayer(state.monitoredPlayerId) : undefined;
  const latestRound = state.history.at(-1);

  return {
    mode: state.mode,
    modeLabel: state.mode === 'party' ? 'Party Mode' : 'Advanced Mode',
    phase: state.phase,
    phaseLabel: phaseLabel(state.phase, state.mode),
    round: Math.min(state.round, state.maxRounds),
    maxRounds: state.maxRounds,
    flowKicker: boardFlowKicker(state.phase),
    flowTitle: boardFlowTitle(engine, readyCount),
    flowBody: boardFlowBody(engine, readyCount),
    bossName: state.boss.name,
    bossHp: state.bossHp,
    bossMaxHp: state.bossMaxHp,
    bossActionType: state.currentBossAction.type,
    bossActionLabel: bossActionLabel(state.currentBossAction.type),
    bossActionForecast: bossForecastLabel(state.currentBossAction.type),
    bossTargetName: bossTarget?.name,
    baseHp: state.baseHp,
    baseMaxHp: state.baseMaxHp,
    baseWarning: partyBaseWarning(state.baseHp),
    inputLabel: phaseInputLabel(state.phase, state.mode),
    ready: readyCount.ready,
    readyTotal: readyCount.total,
    latestRound: latestRound
      ? {
        round: latestRound.round,
        totalDamage: latestRound.totalDamage,
        bossHealing: latestRound.bossHealing,
        baseDamage: latestRound.baseDamage,
        repairs: latestRound.repairs,
        defenseCount: latestRound.defenseCount,
        sabotageCount: latestRound.sabotageCount,
        sabotagePressure: latestRound.sabotagePressure,
      }
      : undefined,
    monitoredName: monitored?.name,
    monitoredSuspicion: monitored ? suspicionStars(monitored.suspicion) : undefined,
  };
}

function boardFlowKicker(phase: GamePhase): string {
  if (phase === 'finished') return 'ゲーム終了';
  if (phase === 'action') return '次にすること';
  if (phase === 'vote') return '入力待ち';
  if (phase === 'plea') return '入力待ち';
  if (phase === 'branch') return '作戦選択';
  return '進行中';
}

function boardFlowTitle(engine: GameEngine, readyCount: { ready: number; total: number }): string {
  const state = engine.state;
  const remaining = Math.max(0, readyCount.total - readyCount.ready);
  if (state.phase === 'finished') return '結果を確認してください';
  if (readyCount.total > 0 && remaining === 0) return '作戦同期完了 - 解決中...';
  if (state.phase === 'action') return `${remaining}基の作戦待ち`;
  if (state.mode === 'party' && state.phase === 'vote') return `${remaining}基のスパイ予想待ち`;
  if (state.phase === 'vote') return `${remaining}基の投票待ち`;
  if (state.phase === 'plea') return `${remaining}基の弁明待ち`;
  if (state.phase === 'branch') return `${remaining}基の作戦投票待ち`;
  return '進行待ち';
}

function boardFlowBody(engine: GameEngine, readyCount: { ready: number; total: number }): string {
  const state = engine.state;
  if (state.phase === 'finished') return 'スパイ正体と称号を公開しています。';
  if (readyCount.total > 0 && Math.max(0, readyCount.total - readyCount.ready) === 0) {
    return '未接続砲台を自動同期し、戦闘結果を処理します。';
  }
  if (state.phase === 'action' && state.mode === 'party') return partyBossHint(state.currentBossAction.type);
  if (state.phase === 'action') return '各プレイヤーは自分の画面で行動を選びます。';
  if (state.mode === 'party' && state.phase === 'vote') return '勝敗後のおまけ投票です。怪しい砲台を1人選びます。';
  return `${phaseInputLabel(state.phase, state.mode)}を各プレイヤー画面で送信します。`;
}

export function createPlayerScreenViewModel(engine: GameEngine, playerId: string): PlayerScreenViewModel {
  const state = engine.state;
  const player = engine.getPlayer(playerId);
  const selectedAction = state.submittedActions[player.id];
  const recentRound = state.history.at(-1);
  const recentAction = recentRound?.actions[player.id];
  const selectedVoteTargetId = state.votes[player.id]?.targetId;
  const selectedBranchPlan = state.branchVotes[player.id]?.plan;

  return {
    id: player.id,
    name: player.name,
    control: controlLabel(player),
    role: roleLabel(player),
    phase: state.phase,
    mode: state.mode,
    phaseInstruction: phaseInstruction(state.phase, state.mode),
    isConnected: player.isConnected,
    status: player.isConnected ? '手動操縦' : '砲台ロボ制御',
    players: state.players.map((candidate) => ({ id: candidate.id, name: candidate.name })),
    targetOptions: state.players
      .filter((candidate) => candidate.id !== player.id)
      .map((candidate) => ({ id: candidate.id, name: candidate.name })),
    voteOptions: state.players
      .filter((candidate) => candidate.id !== player.id)
      .map((candidate) => ({ id: candidate.id, name: candidate.name })),
    availableActions: engine.availableActions(player.id).map((type) => ({
      type,
      label: actionLabel(type, state.mode),
      help: actionHelp(type, state.mode),
      requiresTarget: requiresTarget(type),
    })),
    privateLogs: state.privateLogs[player.id] ?? [],
    selectedActionLabel: selectedAction ? actionLabel(selectedAction.type, state.mode) : '未選択',
    selectedActionType: selectedAction?.type,
    selectedActionTargetId: selectedAction?.targetId,
    selectedActionTargetName: selectedAction?.targetId ? engine.getPlayer(selectedAction.targetId).name : undefined,
    selectedVoteTargetId,
    selectedVoteTargetName: selectedVoteTargetId ? engine.getPlayer(selectedVoteTargetId).name : undefined,
    selectedPlea: state.pleas[player.id],
    pleaOptions: PLEA_CARDS,
    selectedBranchPlan,
    branchOptions: branchOptions(state.branchState.condition).map((plan) => ({
      plan,
      label: branchPlanLabel(plan),
      help: branchHelp(plan),
    })),
    inferenceHints: state.inferenceHints.map((hint) => {
      const candidate = engine.getPlayer(hint.playerId);
      return {
        playerId: hint.playerId,
        playerName: candidate.name,
        suspicion: hint.suspicion,
        suspicionStars: suspicionStars(hint.suspicion),
        reason: hint.reason,
      };
    }),
    recentActionLabel: recentAction ? actionLabel(recentAction, state.mode) : '未解決',
    wasSabotaged: Boolean(recentRound?.sabotagedPlayerIds.includes(player.id)),
    result: state.result
      ? {
        winner: state.result.winner === 'gunners' ? '砲台チーム' : 'スパイ',
        votedTarget: selectedVoteTargetId ? engine.getPlayer(selectedVoteTargetId).name : '未投票',
        spyName: engine.getPlayer(state.result.spyId).name,
        finalVoteOutcome: state.mode === 'party'
          ? state.result.finalVoteTargetId === state.result.spyId
            ? 'おまけ投票成功'
            : 'おまけ投票失敗'
          : undefined,
        awards: state.result.awards.map((award) => ({
          title: award.title,
          owner: award.playerId ? engine.getPlayer(award.playerId).name : 'チーム',
          reason: award.reason,
          isMine: award.playerId === player.id,
        })),
      }
      : undefined,
  };
}

function publicInputStatus(engine: GameEngine, playerId: string): {
  label: string;
  inputTone: HostPlayerView['inputTone'];
} {
  const state = engine.state;
  const player = engine.getPlayer(playerId);
  if (state.phase !== 'finished' && engine.controlledByCpu(player)) {
    if (state.phase === 'action' && !state.submittedActions[playerId]) return { label: '自動同期中', inputTone: 'auto' };
    if (state.phase === 'plea' && !state.pleas[playerId]) return { label: '自動同期中', inputTone: 'auto' };
    if (state.phase === 'vote' && !state.votes[playerId]) return { label: '自動同期中', inputTone: 'auto' };
    if (state.phase === 'branch' && !state.branchVotes[playerId]) return { label: '自動同期中', inputTone: 'auto' };
  }
  if (state.phase === 'action') {
    return state.submittedActions[playerId]
      ? { label: '作戦送信済み', inputTone: 'ready' }
      : { label: '同期待機中', inputTone: 'waiting' };
  }
  if (state.phase === 'plea') {
    return state.pleas[playerId]
      ? { label: '弁明送信済み', inputTone: 'ready' }
      : { label: '通信待機中', inputTone: 'waiting' };
  }
  if (state.phase === 'vote') {
    return state.votes[playerId]
      ? { label: state.mode === 'party' ? '予想送信済み' : '投票送信済み', inputTone: 'ready' }
      : { label: '投票待機中', inputTone: 'waiting' };
  }
  if (state.phase === 'branch') {
    return state.branchVotes[playerId]
      ? { label: '作戦投票済み', inputTone: 'ready' }
      : { label: '集計待機中', inputTone: 'waiting' };
  }
  return { label: '戦闘終了', inputTone: 'done' };
}
