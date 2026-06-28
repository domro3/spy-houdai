import type { ActionType, BossDefinition, BranchPlan, CpuProfile } from '../core/types';

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

export const PARTY_RULES = {
  baseHp: 100,
  rounds: 5,
  expectedSecondsPerRound: 75,
};

export const PARTY_ACTION_BALANCE = {
  attackDamage: 72,
  spyDisguisedAttackDamage: 68,
  weakAttackDamage: 34,
  repairAmount: 18,
  spyDisguisedRepairPenalty: 2,
  repairWarningThreshold: 40,
  repairWarningAmount: 24,
  repairCriticalThreshold: 25,
  repairCriticalAmount: 30,
  sabotagedRepairAmount: 10,
  sabotagedRepairClutchAmount: 7,
  spyBossHealAmount: 36,
  sabotageMultiplier: 0.75,
  sabotageClutchMultiplier: 0.65,
  sabotageClutchGuardDamageBonus: 6,
};

export const PARTY_BOSS_ACTION_BALANCE = {
  normalAttackDamage: 14,
  normalAttackGuardedDamage: 7,
  normalAttackNoisyGuardDamage: 10,
  bigChargeDamage: 80,
  bigChargeGuardedDamage: 18,
  bigChargeNoisyGuardDamage: 35,
  targetLockDamage: 56,
  targetLockGuardedDamage: 10,
  targetLockNoisyGuardDamage: 28,
  armorRegenHeal: 36,
  armorRegenBlockThresholdByPlayerCount: {
    4: 150,
    5: 205,
    6: 260,
  },
};

export const DEFAULT_BOSS_ID = 'prototype_gigant';

export const BOSS_DEFINITIONS: Record<string, BossDefinition> = {
  prototype_gigant: {
    id: 'prototype_gigant',
    name: 'プロトタイプ・ギガント',
    description: '基本的な攻撃、装甲再生、狙い撃ちを使う標準ボス',
    maxHpByPlayerCount: {
      4: 620,
      5: 880,
      6: 1110,
    },
    actionWeights: {
      normal_attack: 32,
      big_charge: 33,
      armor_regen: 12,
      target_lock: 23,
    },
    specialRules: [
      '大技チャージは防御で軽減できる',
      '装甲再生は集中砲火で阻止できる',
      '狙い撃ちは対象者の防御が有効',
    ],
  },
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

export const PARTY_GUNNER_ACTIONS: ActionType[] = [
  'normal_attack',
  'defend',
  'repair',
];

export const PARTY_SPY_ACTIONS: ActionType[] = [
  'normal_attack',
  'defend',
  'repair',
  'fake_attack',
  'sabotage',
  'boss_heal',
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

export const PARTY_ACTION_LABELS: Partial<Record<ActionType, string>> = {
  normal_attack: '撃つ',
  defend: '守る',
  repair: '直す',
  fake_attack: '弱く撃つ',
  sabotage: '邪魔する',
  boss_heal: 'ボスを助ける',
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
