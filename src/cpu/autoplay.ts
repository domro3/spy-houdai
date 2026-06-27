import { GameEngine } from '../core/game_engine';
import type { GameSetupOptions, GameState } from '../core/types';
import {
  chooseCpuAction,
  chooseCpuBranchPlan,
  chooseCpuPlea,
  chooseCpuVote,
  shouldUseSuspiciousCoin,
} from './cpu_player';

export function fillCpuActions(engine: GameEngine): void {
  for (const player of engine.state.players) {
    if (engine.controlledByCpu(player) && !engine.state.submittedActions[player.id]) {
      engine.submitAction(chooseCpuAction(engine.state, player, engine.rng));
    }
  }
}

export function fillCpuPleas(engine: GameEngine): void {
  for (const player of engine.state.players) {
    if (engine.controlledByCpu(player) && !engine.state.pleas[player.id]) {
      engine.submitPlea(player.id, chooseCpuPlea(engine.state, player, engine.rng));
    }
  }
}

export function fillCpuVotes(engine: GameEngine): void {
  const spy = engine.spy();
  if (engine.controlledByCpu(spy) && shouldUseSuspiciousCoin(engine.state, spy, engine.rng)) {
    engine.useSuspiciousCoin(spy.id);
  }
  for (const player of engine.state.players) {
    if (engine.controlledByCpu(player) && !engine.state.votes[player.id]) {
      engine.submitVote({
        voterId: player.id,
        targetId: chooseCpuVote(engine.state, player, engine.rng),
      });
    }
  }
}

export function fillCpuBranchVotes(engine: GameEngine): void {
  for (const player of engine.state.players) {
    if (engine.controlledByCpu(player) && !engine.state.branchVotes[player.id]) {
      engine.submitBranchVote({
        voterId: player.id,
        plan: chooseCpuBranchPlan(engine.state, player, engine.rng),
      });
    }
  }
}

export function runCpuGame(options: GameSetupOptions): GameState {
  const engine = new GameEngine(options);
  let guard = 0;

  while (engine.state.phase !== 'finished') {
    guard += 1;
    if (guard > 50) {
      throw new Error('CPU simulation exceeded guard limit');
    }
    if (engine.state.phase === 'action') {
      fillCpuActions(engine);
      engine.resolveActions();
    }
    if (engine.state.phase === 'plea') {
      fillCpuPleas(engine);
      engine.resolvePleas();
    }
    if (engine.state.phase === 'vote') {
      fillCpuVotes(engine);
      engine.resolveVotes();
    }
    if (engine.state.phase === 'branch') {
      fillCpuBranchVotes(engine);
      engine.resolveBranch();
    }
  }

  return engine.state;
}
