import type { RandomSource } from './types';

export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed = Date.now()) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

export function shuffle<T>(items: T[], rng: RandomSource): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function weightedChoice<T>(
  options: Array<{ value: T; weight: number }>,
  rng: RandomSource,
): T {
  const cleaned = options.filter((option) => option.weight > 0);
  const total = cleaned.reduce((sum, option) => sum + option.weight, 0);
  if (total <= 0 || cleaned.length === 0) {
    throw new Error('weightedChoice requires at least one positive weight');
  }

  let roll = rng.next() * total;
  for (const option of cleaned) {
    roll -= option.weight;
    if (roll <= 0) {
      return option.value;
    }
  }

  return cleaned[cleaned.length - 1].value;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
