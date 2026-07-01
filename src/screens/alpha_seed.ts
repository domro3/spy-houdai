export const INITIAL_ALPHA_SEED = 20260627;

export function nextAlphaSeed(currentSeed: number): number {
  const normalized = Number.isFinite(currentSeed) ? Math.trunc(currentSeed) : INITIAL_ALPHA_SEED;
  const mixed = (Math.imul(normalized, 1664525) + 1013904223) >>> 0;
  return 100000 + (mixed % 900000000);
}
