import { clamp } from './random';
import type { Player } from './types';

export function changeSuspicion(player: Player, delta: number): void {
  player.suspicion = clamp(player.suspicion + delta, 0, 10);
}

export function suspicionStars(value: number): string {
  if (value <= 0) return 'なし';
  if (value <= 2) return '★';
  if (value <= 4) return '★★';
  if (value <= 6) return '★★★';
  if (value <= 8) return '★★★★';
  return '★★★★★';
}
