import { describe, expect, it } from 'vitest';
import { evaluatePrivacyProjection, runAlphaPreflight } from '../playtest/alpha_preflight';

describe('AI alpha preflight', () => {
  it('passes the deterministic M4 Party Mode gate', () => {
    const report = runAlphaPreflight({
      games: 100,
      players: 5,
      seed: 20260627,
    });

    expect(report.status).toBe('pass');
    expect(report.blockers).toEqual([]);
    expect(report.estimatedAverageMinutes).toBeGreaterThanOrEqual(5);
    expect(report.estimatedAverageMinutes).toBeLessThanOrEqual(8);
    expect(report.summary.gunnerWinRate).toBeGreaterThanOrEqual(0.55);
    expect(report.summary.gunnerWinRate).toBeLessThanOrEqual(0.7);
    expect(report.summary.shortPublicLogRoundRate).toBe(1);
    expect(report.summary.awardGameRate).toBe(1);
    expect(report.summary.finalBonusAwardGameRate).toBe(1);
    expect(report.summary.averageAwardCount).toBeGreaterThanOrEqual(4);
    expect(report.summary.spyBehindWins).toBe(0);
    expect(report.summary.suspiciousCoinUses).toBe(0);
  });

  it('keeps the projection privacy check isolated from simulation balance', () => {
    const privacy = evaluatePrivacyProjection(5, 20260627);

    expect(privacy.passed).toBe(true);
    expect(privacy.findings).toEqual([]);
  });
});
