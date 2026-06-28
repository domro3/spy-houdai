export const prototypeAssets = {
  boss: '/assets/prototype/boss_alpha_01.png',
  baseCore: '/assets/prototype/base_core_alpha_01.png',
  noiseEffect: '/assets/prototype/noise_effect_alpha_01.png',
  turrets: {
    p1: '/assets/prototype/turret_p1_alpha_01.png',
    p2: '/assets/prototype/turret_p2_alpha_01.png',
    p3: '/assets/prototype/turret_p3_alpha_01.png',
    p4: '/assets/prototype/turret_p4_alpha_01.png',
    p5: '/assets/prototype/turret_p5_alpha_01.png',
    p6: '/assets/prototype/turret_p6_alpha_01.png',
  },
} as const;

export function turretPrototypeAsset(playerId: string): string | undefined {
  return prototypeAssets.turrets[playerId as keyof typeof prototypeAssets.turrets];
}
