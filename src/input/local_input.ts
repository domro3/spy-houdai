import { GameEngine } from '../core/game_engine';
import type { ActionType, BranchPlan } from '../core/types';

export class LocalInput {
  constructor(private readonly engine: GameEngine) {}

  chooseAction(playerId: string, type: ActionType, targetId?: string): void {
    this.engine.submitAction({ playerId, type, targetId });
  }

  choosePlea(playerId: string, plea: string): void {
    this.engine.submitPlea(playerId, plea);
  }

  vote(playerId: string, targetId: string): void {
    this.engine.submitVote({ voterId: playerId, targetId });
  }

  branchVote(playerId: string, plan: BranchPlan): void {
    this.engine.submitBranchVote({ voterId: playerId, plan });
  }

  useSuspiciousCoin(playerId: string): void {
    this.engine.useSuspiciousCoin(playerId);
  }

  disconnect(playerId: string): void {
    this.engine.disconnectPlayer(playerId);
  }

  reconnect(playerId: string): void {
    this.engine.reconnectPlayer(playerId);
  }
}
