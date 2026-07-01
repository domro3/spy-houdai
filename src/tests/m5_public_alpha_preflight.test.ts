import { describe, expect, it } from 'vitest';
import { nextAlphaSeed } from '../screens/alpha_seed';
import { PUBLIC_ALPHA_ENTRY } from '../screens/public_alpha_content';
import { runM5PublicAlphaPreflight } from '../playtest/m5_public_alpha_preflight';

describe('M5 public alpha preflight', () => {
  it('passes the AI replacement gates for the public alpha solo route', () => {
    const report = runM5PublicAlphaPreflight({ games: 100, seed: 20260627 });

    expect(report.status).toBe('pass');
    expect(report.blockers).toEqual([]);
    expect(report.checks.map((check) => check.id)).toEqual([
      'entry_content',
      'route_contract',
      'initial_guidance',
      'privacy_contract',
      'solo_completion',
      'result_rematch',
      'm4_regression_gates',
    ]);
    expect(report.soloTrace.some((step) => step.phase === 'vote')).toBe(true);
  });

  it('keeps the public alpha entry copy aligned with the M5 route contract', () => {
    const copy = [
      PUBLIC_ALPHA_ENTRY.kicker,
      ...PUBLIC_ALPHA_ENTRY.headlineLines,
      PUBLIC_ALPHA_ENTRY.body,
      PUBLIC_ALPHA_ENTRY.primaryCta,
      PUBLIC_ALPHA_ENTRY.boardCta,
      ...PUBLIC_ALPHA_ENTRY.routeActions,
      ...PUBLIC_ALPHA_ENTRY.highlights.flatMap((highlight) => [highlight.label, highlight.value]),
    ].join(' ');

    expect(copy).toContain('Public Alpha v0.1');
    expect(copy).toContain('スマホ');
    expect(copy).toContain('5分');
    expect(copy).toContain('CPU4基同期');
    expect(PUBLIC_ALPHA_ENTRY.primaryCta).toBe('この端末で開始');
    expect(nextAlphaSeed(20260627)).not.toBe(20260627);
  });
});
