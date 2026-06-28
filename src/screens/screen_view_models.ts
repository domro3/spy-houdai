import type { GameEngine } from '../core/game_engine';
import type { ActionType } from '../core/types';
import { actionLabel, controlLabel, roleLabel } from '../view/format';

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
  availableActions: Array<{ type: ActionType; label: string }>;
  privateLogs: string[];
  selectedActionLabel: string;
  recentActionLabel: string;
  wasSabotaged: boolean;
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

  return {
    id: player.id,
    name: player.name,
    control: controlLabel(player),
    role: roleLabel(player),
    availableActions: engine.availableActions(player.id).map((type) => ({
      type,
      label: actionLabel(type, state.mode),
    })),
    privateLogs: state.privateLogs[player.id] ?? [],
    selectedActionLabel: selectedAction ? actionLabel(selectedAction.type, state.mode) : '未選択',
    recentActionLabel: recentAction ? actionLabel(recentAction, state.mode) : '未解決',
    wasSabotaged: Boolean(recentRound?.sabotagedPlayerIds.includes(player.id)),
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
