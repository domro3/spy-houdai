import type { ActionType, BranchPlan, CpuProfile } from '../core/types';

export const PLAYER_LIMITS = {
  min: 4,
  max: 6,
};

export const BALANCE_BY_PLAYER_COUNT: Record<number, { bossHp: number; baseHp: number; rounds: number }> = {
  4: { bossHp: 430, baseHp: 100, rounds: 5 },
  5: { bossHp: 560, baseHp: 100, rounds: 5 },
  6: { bossHp: 710, baseHp: 100, rounds: 5 },
};

export const ACTION_BALANCE = {
  normalAttackDamage: 60,
  chargeAttackSuccessDamage: 100,
  chargeAttackFailureDamage: 30,
  chargeAttackSuccessRate: 0.75,
  chargeBackfireRate: 0.1,
  chargeBackfireBaseDamage: 5,
  defendReduction: 0.5,
  sabotagedDefendReduction: 0.3,
  repairAmount: 20,
  sabotagedRepairAmount: 10,
  fakeAttackDamage: 30,
  bossHealAmount: 50,
  sabotageAttackMultiplier: 0.7,
  sabotageChargePenalty: 0.2,
  suspiciousCoinMinRound: 3,
  suspiciousCoinSuccessRate: 0.4,
  suspiciousCoinFailureSuspicion: 2,
  fakeAttackSuspicion: 1,
  bossHealSuspicion: 5,
  sabotageSuspicion: 4,
  scrambleLogSuspicion: 3,
};

export const BOSS_BALANCE = {
  normalAttack: 10,
  strongAttack: 18,
  weakAttack: 10,
  specialRate: 0.2,
};

export const BRANCH_EFFECTS: Record<BranchPlan, { damageMultiplier: number; bossAttackDelta: number }> = {
  normal: { damageMultiplier: 1, bossAttackDelta: 0 },
  overdrive: { damageMultiplier: 0.9, bossAttackDelta: 10 },
  emergency: { damageMultiplier: 1.1, bossAttackDelta: -5 },
};

export const PLAYER_NAMES = ['赤砲台', '青砲台', '緑砲台', '黄砲台', '紫砲台', '白砲台'];

export const CPU_PROFILES: CpuProfile[] = [
  'attacker',
  'support',
  'defender',
  'suspicious',
  'follower',
];

export const GUNNER_ACTIONS: ActionType[] = [
  'normal_attack',
  'charge_attack',
  'defend',
  'repair',
  'scan',
];

export const SPY_ACTIONS: ActionType[] = [
  ...GUNNER_ACTIONS,
  'fake_attack',
  'boss_heal',
  'sabotage',
  'scramble_log',
];

export const ACTION_LABELS: Record<ActionType, string> = {
  normal_attack: '通常攻撃',
  charge_attack: 'チャージ攻撃',
  defend: '防御',
  repair: '修理',
  scan: 'スキャン',
  fake_attack: '偽装攻撃',
  boss_heal: 'ボス回復',
  sabotage: '妨害',
  scramble_log: 'ログ撹乱',
};

export const PLEA_CARDS = [
  '攻撃しました',
  '回復しました',
  '防御しました',
  'スキャンしました',
  '妨害されました',
  '出力が不安定でした',
  '相手が怪しいです',
  '相手は怪しくないと思います',
  '次は防御が必要です',
  'スキャン希望です',
];
