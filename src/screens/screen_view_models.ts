import { requiresTarget, type GameEngine } from '../core/game_engine';
import type { ActionType, BranchPlan, GameMode, GamePhase } from '../core/types';
import { PLEA_CARDS } from '../data/constants';
import { actionHelp, actionLabel, branchHelp, branchPlanLabel, controlLabel, roleLabel, suspicionStars } from '../view/format';
import { branchOptions, phaseInstruction } from './screen_state';

export interface HostPlayerView {
  id: string;
  name: string;
  control: string;
  role: string;
  status: string;
  inputStatus: string;
}

export interface HostVoteView {
  playerId: string;
  name: string;
  count: number;
}

export interface HostScreenViewModel {
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
    players: state.players.map((player) => ({
      id: player.id,
      name: player.name,
      control: controlLabel(player),
      role: state.phase === 'finished' ? roleLabel(player) : '非公開',
      status: player.isConnected ? '接続中' : '砲台ロボ',
      inputStatus: publicInputStatus(engine, player.id),
    })),
    publicLogs: state.publicLogs,
    latestVotes,
  };
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
      }
      : undefined,
  };
}

function publicInputStatus(engine: GameEngine, playerId: string): string {
  const state = engine.state;
  if (state.phase === 'action') return state.submittedActions[playerId] ? '入力済み' : '未入力';
  if (state.phase === 'plea') return state.pleas[playerId] ? '入力済み' : '未入力';
  if (state.phase === 'vote') return state.votes[playerId] ? '入力済み' : '未入力';
  if (state.phase === 'branch') return state.branchVotes[playerId] ? '入力済み' : '未入力';
  return '完了';
}
