import { describe, expect, it } from 'vitest';
import { GameEngine } from '../core/game_engine';
import { runCpuGame } from '../cpu/autoplay';
import { runSimulation } from '../sim/simulation';
import type { RandomSource, RoundSummary } from '../core/types';

describe('GameEngine setup', () => {
  it('assigns exactly one spy', () => {
    const engine = new GameEngine({ totalPlayers: 5, humanPlayers: 1, seed: 10 });
    expect(engine.state.players.filter((player) => player.role === 'spy')).toHaveLength(1);
    expect(engine.state.bossHp).toBe(1000);
    expect(engine.state.baseHp).toBe(100);
  });

  it('fills CPU players for one-person practice', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 1, seed: 11 });
    expect(engine.state.players.filter((player) => player.isCpu)).toHaveLength(3);
  });
});

describe('round resolution', () => {
  it('resolves normal attacks', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 0, seed: 20, spyId: 'p4' });
    for (const player of engine.state.players) {
      engine.submitAction({
        playerId: player.id,
        type: player.role === 'spy' ? 'fake_attack' : 'normal_attack',
      });
    }
    engine.resolveActions();
    expect(engine.state.bossHp).toBe(750 - 60 * 3 - 20);
    expect(engine.state.phase).toBe('plea');
  });

  it('lets the spy heal the boss', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 0, seed: 21, spyId: 'p4' });
    engine.state.bossHp = 500;
    for (const player of engine.state.players) {
      engine.submitAction({
        playerId: player.id,
        type: player.role === 'spy' ? 'boss_heal' : 'normal_attack',
      });
    }
    engine.resolveActions();
    expect(engine.state.bossHp).toBe(500 - 60 * 3 + 80);
    expect(engine.spy().stats.bossHealing).toBe(80);
  });

  it('progresses through round 5 and finishes', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 0, seed: 23, spyId: 'p4' });
    while (engine.state.phase !== 'finished') {
      completeDefenseRound(engine);
    }
    expect(engine.state.history).toHaveLength(5);
    expect(engine.state.result?.winner).toBe('spy');
    expect(engine.state.result?.bossDefeated).toBe(false);
  });
});

describe('win conditions', () => {
  it('gunners win when boss HP reaches 0 and the spy is found', () => {
    const engine = readyVoteEngine();
    engine.state.bossHp = 0;
    voteSpyToTop(engine);
    expect(engine.state.phase).toBe('finished');
    expect(engine.state.result?.winner).toBe('gunners');
    expect(engine.state.result?.bossDefeated).toBe(true);
  });

  it('spy wins when base HP reaches 0', () => {
    const engine = readyVoteEngine();
    engine.state.bossHp = 0;
    engine.state.baseHp = 0;
    voteSpyToTop(engine);
    expect(engine.state.phase).toBe('finished');
    expect(engine.state.result?.winner).toBe('spy');
    expect(engine.state.result?.baseDestroyed).toBe(true);
  });

  it('spy wins when boss HP remains at the end of round 5', () => {
    const engine = readyVoteEngine(5);
    engine.state.bossHp = 120;
    voteSpyToTop(engine);
    expect(engine.state.phase).toBe('finished');
    expect(engine.state.result?.winner).toBe('spy');
    expect(engine.state.result?.bossDefeated).toBe(false);
  });
});

describe('votes and special rules', () => {
  it('applies suspicious coin success as two votes', () => {
    const engine = readyVoteEngine(1, 0.1);
    engine.useSuspiciousCoin('p4');
    expect(engine.spy().coinResult).toBe('success');
    for (const player of engine.state.players) {
      engine.submitVote({
        voterId: player.id,
        targetId: player.id === 'p1' ? 'p2' : 'p1',
      });
    }
    engine.resolveVotes();
    const votes = engine.state.history[engine.state.history.length - 1]?.votes ?? {};
    expect(votes.p1).toBe(4);
  });

  it('raises suspicion when suspicious coin fails', () => {
    const engine = readyVoteEngine(1, 0.9);
    const before = engine.spy().suspicion;
    const event = engine.useSuspiciousCoin('p4');
    expect(event.success).toBe(false);
    expect(engine.spy().coinResult).toBe('failed');
    expect(engine.spy().suspicion).toBeGreaterThan(before);
  });

  it('triggers round 3 branch voting before round 4', () => {
    const engine = readyVoteEngine(3);
    engine.state.bossHp = 520;
    engine.state.baseHp = 100;
    voteSpyToTop(engine);
    expect(engine.state.phase).toBe('branch');
    expect(engine.state.branchState.condition).toBeDefined();
  });

  it('switches disconnected players to CPU control without revealing role', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 1, seed: 22 });
    const human = engine.state.players[0];
    engine.disconnectPlayer(human.id);
    expect(engine.controlledByCpu(human)).toBe(true);
    expect(engine.state.publicLogs.at(-1)).toContain('砲台ロボ');
    expect(engine.state.publicLogs.at(-1)).not.toContain('スパイ');
  });
});

describe('CPU simulation', () => {
  it('runs a full CPU game to a result', () => {
    const state = runCpuGame({ totalPlayers: 5, humanPlayers: 0, seed: 33 });
    expect(state.phase).toBe('finished');
    expect(state.result).toBeDefined();
    expect(state.history.length).toBeGreaterThan(0);
    expect(state.history.length).toBeLessThanOrEqual(5);
    expect(state.result?.spyId).toMatch(/^p/);
    expect(state.result?.awards.length).toBeGreaterThan(0);
  });

  it('aggregates multiple CPU games for balance checks', () => {
    const summary = runSimulation({ games: 10, players: 5, seed: 20260627 });
    expect(summary.records).toHaveLength(10);
    expect(summary.gunnerWins + summary.spyWins).toBe(10);
    expect(summary.gunnerWinRate).toBeGreaterThanOrEqual(0);
    expect(summary.gunnerWinRate).toBeLessThanOrEqual(1);
    expect(summary.averageRounds).toBeGreaterThan(0);
    expect(summary.averageRounds).toBeLessThanOrEqual(5);
  });
});

describe('log separation', () => {
  it('keeps round public logs to 3-5 lines', () => {
    const state = runCpuGame({ totalPlayers: 5, humanPlayers: 0, seed: 45 });
    for (const round of state.history) {
      expect(round.publicLogs.length).toBeGreaterThanOrEqual(3);
      expect(round.publicLogs.length).toBeLessThanOrEqual(5);
    }
  });

  it('does not mix debug logs into public or private logs', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 0, seed: 46, spyId: 'p4' });
    submitOneActionRound(engine, 'scan');
    engine.resolveActions();

    expect(engine.state.debugLogs.some((log) => log.includes('[debug]'))).toBe(true);
    expect(engine.state.publicLogs.join('\n')).not.toContain('[debug]');
    expect(Object.values(engine.state.privateLogs).flat().join('\n')).not.toContain('[debug]');
  });

  it('keeps private scan results separated by player', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 0, seed: 47, spyId: 'p4' });
    submitOneActionRound(engine, 'scan');
    engine.resolveActions();

    expect(engine.state.privateLogs.p1.join('\n')).toContain('スキャン結果');
    expect(engine.state.privateLogs.p2.join('\n')).not.toContain('スキャン結果');
    expect(engine.state.privateLogs.p3.join('\n')).not.toContain('スキャン結果');
    expect(engine.state.privateLogs.p4.join('\n')).not.toContain('スキャン結果');
    expect(engine.state.publicLogs.join('\n')).not.toContain('スキャン結果');
  });
});

function readyVoteEngine(round = 1, fixedRoll = 0.1): GameEngine {
  const engine = new GameEngine(
    { totalPlayers: 4, humanPlayers: 0, seed: 1, spyId: 'p4' },
    fixedRandom(fixedRoll),
  );
  engine.state.round = round;
  engine.state.phase = 'vote';
  engine.state.history.push(emptySummary(round));
  return engine;
}

function voteSpyToTop(engine: GameEngine): void {
  for (const player of engine.state.players) {
    engine.submitVote({
      voterId: player.id,
      targetId: player.id === 'p4' ? 'p1' : 'p4',
    });
  }
  engine.resolveVotes();
}

function completeDefenseRound(engine: GameEngine): void {
  for (const player of engine.state.players) {
    engine.submitAction({ playerId: player.id, type: 'defend' });
  }
  engine.resolveActions();
  for (const player of engine.state.players) {
    engine.submitPlea(player.id, '防御しました');
  }
  engine.resolvePleas();
  voteSpyToTop(engine);
  if (engine.state.phase === 'branch') {
    for (const player of engine.state.players) {
      engine.submitBranchVote({ voterId: player.id, plan: 'normal' });
    }
    engine.resolveBranch();
  }
}

function submitOneActionRound(engine: GameEngine, p1Action: 'scan'): void {
  for (const player of engine.state.players) {
    engine.submitAction({
      playerId: player.id,
      type: player.id === 'p1' ? p1Action : 'defend',
      targetId: player.id === 'p1' ? 'p4' : undefined,
    });
  }
}

function emptySummary(round: number): RoundSummary {
  return {
    round,
    totalDamage: 0,
    bossHealing: 0,
    baseDamage: 0,
    repairs: 0,
    defenseCount: 0,
    sabotageCount: 0,
    scrambleLog: false,
    scans: [],
    votes: {},
    publicLogs: [],
  };
}

function fixedRandom(value: number): RandomSource {
  return {
    next: () => value,
  };
}
