import type { BossActionType, BranchPlan, GameMode, GamePhase } from '../core/types';
import type { GameEngine } from '../core/game_engine';
import { PARTY_ACTION_BALANCE } from '../data/constants';

export function phaseLabel(phase: GamePhase, mode: GameMode): string {
  if (phase === 'action') return '行動選択';
  if (mode === 'party' && phase === 'vote') return 'スパイ予想';
  if (phase === 'plea') return '弁明タイム';
  if (phase === 'vote') return '疑惑投票';
  if (phase === 'branch') return '中間作戦';
  return '結果発表';
}

export function phaseInstruction(phase: GamePhase, mode: GameMode): string {
  if (phase === 'action') return '行動を選んでください';
  if (mode === 'party' && phase === 'vote') return 'おまけでスパイを予想してください';
  if (phase === 'plea') return '弁明カードを選んでください';
  if (phase === 'vote') return '怪しい砲台に投票してください';
  if (phase === 'branch') return '作戦を投票してください';
  return '結果を確認してください';
}

export function phaseInputLabel(phase: GamePhase, mode: GameMode): string {
  if (phase === 'action') return '行動入力';
  if (mode === 'party' && phase === 'vote') return '予想入力';
  if (phase === 'plea') return '弁明入力';
  if (phase === 'vote') return '投票入力';
  if (phase === 'branch') return '作戦投票';
  return '完了';
}

export function phaseReadyCount(engine: GameEngine): { ready: number; total: number } {
  const state = engine.state;
  const total = state.players.length;
  if (state.phase === 'action') return { ready: Object.keys(state.submittedActions).length, total };
  if (state.phase === 'plea') return { ready: Object.keys(state.pleas).length, total };
  if (state.phase === 'vote') return { ready: Object.keys(state.votes).length, total };
  if (state.phase === 'branch') return { ready: Object.keys(state.branchVotes).length, total };
  return { ready: total, total };
}

export function canResolveCurrentPhase(engine: GameEngine): boolean {
  const state = engine.state;
  if (state.phase === 'finished') return false;
  if (state.phase === 'action') {
    return state.players.every((player) => state.submittedActions[player.id]);
  }
  if (state.phase === 'plea') {
    return state.players.every((player) => state.pleas[player.id]);
  }
  if (state.phase === 'vote') {
    return state.players.every((player) => state.votes[player.id]);
  }
  if (state.phase === 'branch') {
    return state.players.every((player) => state.branchVotes[player.id]);
  }
  return false;
}

export function branchOptions(condition?: string): BranchPlan[] {
  if (condition === 'smooth') return ['normal', 'overdrive'];
  if (condition === 'hard') return ['normal', 'emergency'];
  return ['normal'];
}

export function partyBossHint(type: BossActionType): string {
  if (type === 'big_charge') return '守る人がいると安心';
  if (type === 'armor_regen') return '集中して撃つチャンス';
  if (type === 'target_lock') return '狙われた砲台は守る';
  return '撃つ優先、守るも少し有効';
}

export function partyBaseWarning(baseHp: number): { level: 'warning' | 'critical'; title: string; body: string } | undefined {
  if (baseHp <= PARTY_ACTION_BALANCE.repairCriticalThreshold) {
    return {
      level: 'critical',
      title: '拠点が陥落寸前です',
      body: '次の攻撃で陥落するかもしれません。',
    };
  }
  if (baseHp <= PARTY_ACTION_BALANCE.repairWarningThreshold) {
    return {
      level: 'warning',
      title: '拠点が危険です',
      body: '守るか直すを選ぶ理由が強くなっています。',
    };
  }
  return undefined;
}

export function formatDelta(delta: number): string {
  if (delta > 0) return `(+${delta})`;
  if (delta < 0) return `(${delta})`;
  return '(±0)';
}

export function deltaTone(delta: number): 'positive' | 'negative' | 'neutral' {
  if (delta > 0) return 'positive';
  if (delta < 0) return 'negative';
  return 'neutral';
}
