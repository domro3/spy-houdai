import { actionLabel, branchPlanLabel } from '../core/game_engine';
import { suspicionStars } from '../core/suspicion';
import type { ActionType, BranchPlan, GameMode, Player } from '../core/types';

export { actionLabel, branchPlanLabel, suspicionStars };

export function roleLabel(player: Player): string {
  return player.role === 'spy' ? 'スパイ' : '砲台チーム';
}

export function controlLabel(player: Player): string {
  if (!player.isConnected) return '砲台ロボ';
  return player.isCpu ? 'CPU' : '手動';
}

export function actionHelp(type: ActionType, mode: GameMode = 'advanced'): string {
  if (mode === 'party') {
    switch (type) {
      case 'normal_attack':
        return '迷ったらこれ。ボスにダメージ';
      case 'defend':
        return '大技や狙い撃ちの被害を軽減';
      case 'repair':
        return '拠点耐久を回復';
      case 'fake_attack':
        return '撃っているふり。通常より低ダメージ';
      case 'sabotage':
        return '誰か1人の行動を少し弱くする';
      case 'boss_heal':
        return 'ボスを少し回復。強いが目立つ';
      default:
        return '';
    }
  }

  switch (type) {
    case 'normal_attack':
      return '安定して60ダメージ';
    case 'charge_attack':
      return '75%で100ダメージ、失敗時30';
    case 'defend':
      return 'ボス攻撃を軽減';
    case 'repair':
      return '拠点耐久を20回復';
    case 'scan':
      return '対象の曖昧なヒントを得る';
    case 'fake_attack':
      return '20ダメージで攻撃を偽装';
    case 'boss_heal':
      return 'ボスを80回復';
    case 'sabotage':
      return '対象行動を弱体化';
    case 'scramble_log':
      return '公開ログを曖昧化';
    default:
      return '';
  }
}

export function branchHelp(plan: BranchPlan): string {
  if (plan === 'overdrive') return 'ラウンド4以降の危険と評価を上げる';
  if (plan === 'emergency') return '敵を弱体化するが評価は控えめ';
  return '作戦を変更せず継続';
}

export function percent(current: number, max: number): string {
  return `${Math.round((current / max) * 100)}%`;
}
