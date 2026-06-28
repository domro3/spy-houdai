import { describe, expect, it } from 'vitest';
import { GameEngine } from '../core/game_engine';
import { runCpuGame } from '../cpu/autoplay';
import { runSimulation } from '../sim/simulation';
import { BOSS_DEFINITIONS } from '../data/constants';
import type { RandomSource, RoundSummary } from '../core/types';

describe('GameEngine setup', () => {
  it('assigns exactly one spy', () => {
    const engine = new GameEngine({ totalPlayers: 5, humanPlayers: 1, seed: 10 });
    expect(engine.state.players.filter((player) => player.role === 'spy')).toHaveLength(1);
    expect(engine.state.bossHp).toBe(560);
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
    expect(engine.state.bossHp).toBe(430 - 60 * 3 - 30);
    expect(engine.state.phase).toBe('plea');
  });

  it('lets the spy heal the boss', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 0, seed: 21, spyId: 'p4' });
    engine.state.bossHp = 300;
    for (const player of engine.state.players) {
      engine.submitAction({
        playerId: player.id,
        type: player.role === 'spy' ? 'boss_heal' : 'normal_attack',
      });
    }
    engine.resolveActions();
    expect(engine.state.bossHp).toBe(300 - 60 * 3 + 50);
    expect(engine.spy().stats.bossHealing).toBe(50);
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
    const engine = readyVoteEngine(3, 0.1);
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
    const engine = readyVoteEngine(3, 0.9);
    const before = engine.spy().suspicion;
    const event = engine.useSuspiciousCoin('p4');
    expect(event.success).toBe(false);
    expect(engine.spy().coinResult).toBe('failed');
    expect(engine.spy().suspicion).toBeGreaterThan(before);
  });

  it('does not allow suspicious coin before round 3', () => {
    const engine = readyVoteEngine(2, 0.1);
    expect(() => engine.useSuspiciousCoin('p4')).toThrow(/round 3/);
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

  it('counts Advanced sabotage once per sabotage action', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 0, seed: 24, spyId: 'p4' });
    engine.submitAction({ playerId: 'p1', type: 'normal_attack' });
    engine.submitAction({ playerId: 'p2', type: 'repair' });
    engine.submitAction({ playerId: 'p3', type: 'defend' });
    engine.submitAction({ playerId: 'p4', type: 'sabotage', targetId: 'p1' });
    const summary = engine.resolveActions();

    expect(summary.sabotageCount).toBe(1);
    expect(engine.spy().stats.sabotage).toBe(1);
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
    expect(summary.finalVoteHitSpyCount).toBeGreaterThanOrEqual(0);
    expect(summary.spyBehindWinRate).toBeGreaterThanOrEqual(0);
    expect(summary.spyBehindWinRate).toBeLessThanOrEqual(1);
    expect(summary.topSuspicionSpyRate).toBeGreaterThanOrEqual(0);
    expect(summary.topSuspicionSpyRate).toBeLessThanOrEqual(1);
    expect(summary.averageRounds).toBeGreaterThan(0);
    expect(summary.averageRounds).toBeLessThanOrEqual(5);
  });
});

describe('Party Mode', () => {
  it('lets Party spies choose basic actions and spy-only actions', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 0,
      seed: 60,
      spyId: 'p4',
      mode: 'party',
    });

    expect(engine.availableActions('p1')).toEqual(['normal_attack', 'defend', 'repair']);
    expect(engine.availableActions('p4')).toEqual([
      'normal_attack',
      'defend',
      'repair',
      'fake_attack',
      'sabotage',
      'boss_heal',
    ]);
    expect(() => engine.submitAction({ playerId: 'p1', type: 'scan', targetId: 'p4' })).toThrow();
  });

  it('treats Party spy basic actions as normal-looking team actions', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 0,
      seed: 66,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.currentBossAction = { type: 'normal_attack' };
    engine.state.baseHp = 70;

    engine.submitAction({ playerId: 'p1', type: 'defend' });
    engine.submitAction({ playerId: 'p2', type: 'repair' });
    engine.submitAction({ playerId: 'p3', type: 'normal_attack' });
    engine.submitAction({ playerId: 'p4', type: 'normal_attack' });
    const summary = engine.resolveActions();

    expect(summary.totalDamage).toBe(140);
    expect(engine.spy().stats.damage).toBe(68);
    expect(engine.state.privateLogs.p4.join('\n')).toContain('ボスに68ダメージ');
    expect(engine.state.baseHp).toBe(81);
  });

  it('defines prototype_gigant as data-driven boss content', () => {
    const boss = BOSS_DEFINITIONS.prototype_gigant;
    expect(boss.id).toBe('prototype_gigant');
    expect(boss.name).toBe('プロトタイプ・ギガント');
    expect(boss.actionWeights).toMatchObject({
      normal_attack: 32,
      big_charge: 33,
      armor_regen: 12,
      target_lock: 23,
    });
  });

  it('treats final spy guessing as a bonus, not spy-behind victory', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 0,
      seed: 61,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.bossHp = 1;
    completePartyRound(engine, 'normal_attack');
    expect(engine.state.phase).toBe('vote');
    for (const player of engine.state.players) {
      engine.submitVote({
        voterId: player.id,
        targetId: player.id === 'p1' ? 'p2' : 'p1',
      });
    }
    engine.resolveVotes();

    expect(engine.state.result?.bossDefeated).toBe(true);
    expect(engine.state.result?.winner).toBe('gunners');
    expect(engine.state.result?.spyBehindWin).toBe(false);
  });

  it('grants the Party detective award as a team bonus for actual correct voters', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 0,
      seed: 67,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.bossHp = 1;
    completePartyRound(engine, 'normal_attack');
    engine.submitVote({ voterId: 'p1', targetId: 'p4' });
    engine.submitVote({ voterId: 'p2', targetId: 'p4' });
    engine.submitVote({ voterId: 'p3', targetId: 'p1' });
    engine.submitVote({ voterId: 'p4', targetId: 'p1' });
    engine.resolveVotes();

    const detectiveAward = engine.state.result?.awards.find((award) => award.title === '名探偵砲台チーム');
    expect(detectiveAward).toBeDefined();
    expect(detectiveAward?.playerId).toBeUndefined();
    expect(detectiveAward?.reason).toContain('赤砲台');
    expect(detectiveAward?.reason).toContain('青砲台');
    expect(detectiveAward?.reason).not.toContain('緑砲台');
  });

  it('keeps Party Mode round logs short and skips advanced special systems', () => {
    const state = runCpuGame({
      totalPlayers: 5,
      humanPlayers: 0,
      seed: 62,
      mode: 'party',
    });

    expect(state.phase).toBe('finished');
    expect(state.history.length).toBeGreaterThan(0);
    expect(state.history.every((round) => round.publicLogs.length >= 3 && round.publicLogs.length <= 4)).toBe(true);
    expect(state.history.some((round) => round.branchPlan)).toBe(false);
    expect(state.history.some((round) => round.suspiciousCoin)).toBe(false);
    expect(state.result?.spyBehindWin).toBe(false);
  });

  it('aggregates Party Mode CPU simulations separately', () => {
    const summary = runSimulation({ games: 10, players: 5, seed: 20260627, mode: 'party' });
    expect(summary.mode).toBe('party');
    expect(summary.records).toHaveLength(10);
    expect(summary.gunnerWins + summary.spyWins).toBe(10);
    expect(summary.spyBehindWins).toBe(0);
    expect(summary.suspiciousCoinUses).toBe(0);
    expect(summary.spyBossHelpCount).toBeGreaterThanOrEqual(0);
    expect(summary.armorRegenAttemptCount).toBeGreaterThanOrEqual(0);
    expect(summary.armorRegenSuccessCount).toBeGreaterThanOrEqual(0);
    expect(summary.baseDestroyedRate).toBeGreaterThanOrEqual(0);
    expect(summary.baseDanger40Rate).toBeGreaterThanOrEqual(0);
    expect(summary.baseDanger25Rate).toBeGreaterThanOrEqual(0);
    expect(summary.averageDefenseCount).toBeGreaterThanOrEqual(0);
    expect(summary.averageRepairCount).toBeGreaterThanOrEqual(0);
    expect(summary.records.every((record) => typeof record.baseDestroyed === 'boolean')).toBe(true);
  });

  it('shows sabotage feedback privately while keeping public Party logs short', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 0,
      seed: 63,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.currentBossAction = { type: 'big_charge' };
    engine.state.bossHp = 1;

    engine.submitAction({ playerId: 'p1', type: 'defend' });
    engine.submitAction({ playerId: 'p2', type: 'normal_attack' });
    engine.submitAction({ playerId: 'p3', type: 'repair' });
    engine.submitAction({ playerId: 'p4', type: 'sabotage', targetId: 'p1' });
    const summary = engine.resolveActions();

    expect(summary.publicLogs).toHaveLength(4);
    expect(summary.publicLogs[0]).toContain('強い通信ノイズ');
    expect(summary.sabotagePressure).toBe(true);
    expect(engine.state.privateLogs.p1.join('\n')).toContain('あなたが邪魔されました');
    expect(engine.state.privateLogs.p1.join('\n')).toContain('バリア');
    expect(engine.state.privateLogs.p4.join('\n')).toContain('妨害成功');
    expect(engine.state.privateLogs.p4.join('\n')).toContain('大技チャージ');
    expect(engine.spy().stats.sabotageDefense).toBe(1);
    expect(engine.spy().stats.bossSyncedSabotage).toBe(1);

    for (const player of engine.state.players) {
      engine.submitVote({
        voterId: player.id,
        targetId: player.id === 'p1' ? 'p2' : 'p1',
      });
    }
    engine.resolveVotes();
    const awardTitles = engine.state.result?.awards.map((award) => award.title) ?? [];
    expect(awardTitles).toContain('妨害職人');
    expect(awardTitles).toContain('バリアクラッシャー');
  });

  it('writes personal damage, guard, and repair amounts to private logs', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 0,
      seed: 64,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.currentBossAction = { type: 'big_charge' };
    engine.state.baseHp = 50;

    engine.submitAction({ playerId: 'p1', type: 'defend' });
    engine.submitAction({ playerId: 'p2', type: 'normal_attack' });
    engine.submitAction({ playerId: 'p3', type: 'repair' });
    engine.submitAction({ playerId: 'p4', type: 'fake_attack' });
    engine.resolveActions();

    expect(engine.state.privateLogs.p1.join('\n')).toContain('62ダメージ守った');
    expect(engine.state.privateLogs.p2.join('\n')).toContain('ボスに72ダメージ');
    expect(engine.state.privateLogs.p3.join('\n')).toContain('拠点を18修理');
    expect(engine.state.privateLogs.p4.join('\n')).toContain('ボスに34ダメージ');
  });

  it('lets defend lightly reduce Party normal attacks', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 0,
      seed: 65,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.currentBossAction = { type: 'normal_attack' };

    engine.submitAction({ playerId: 'p1', type: 'defend' });
    engine.submitAction({ playerId: 'p2', type: 'normal_attack' });
    engine.submitAction({ playerId: 'p3', type: 'normal_attack' });
    engine.submitAction({ playerId: 'p4', type: 'fake_attack' });
    const summary = engine.resolveActions();

    expect(summary.baseDamage).toBe(7);
    expect(engine.state.baseHp).toBe(93);
    expect(summary.publicLogs.join('\n')).toContain('通常攻撃をガード');
    expect(engine.state.privateLogs.p1.join('\n')).toContain('7ダメージ守った');
  });

  it('weakens a big-charge barrier when any defender is sabotaged', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 0,
      seed: 68,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.currentBossAction = { type: 'big_charge' };

    engine.submitAction({ playerId: 'p1', type: 'defend' });
    engine.submitAction({ playerId: 'p2', type: 'defend' });
    engine.submitAction({ playerId: 'p3', type: 'defend' });
    engine.submitAction({ playerId: 'p4', type: 'sabotage', targetId: 'p1' });
    const summary = engine.resolveActions();

    expect(summary.baseDamage).toBe(41);
    expect(summary.publicLogs.join('\n')).toContain('バリアにノイズ');
    expect(engine.state.privateLogs.p1.join('\n')).toContain('あなたが邪魔されました');
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

describe('inference support', () => {
  it('uses clearer three-step scan labels', () => {
    const engine = new GameEngine(
      { totalPlayers: 4, humanPlayers: 0, seed: 48, spyId: 'p4' },
      fixedRandom(0.1),
    );
    submitOneActionRound(engine, 'scan');
    const summary = engine.resolveActions();

    expect(summary.scans[0].result).toBe('strong_signal');
    expect(engine.state.privateLogs.p1.join('\n')).toContain('強い異常反応');
  });

  it('adds a public monitored hint without exceeding round log size', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 0, seed: 49, spyId: 'p4' });
    engine.state.monitoredPlayerId = 'p4';
    engine.state.bossHp = 300;
    for (const player of engine.state.players) {
      engine.submitAction({
        playerId: player.id,
        type: player.id === 'p4' ? 'boss_heal' : 'defend',
      });
    }

    const summary = engine.resolveActions();
    expect(summary.publicLogs).toHaveLength(5);
    expect(summary.publicLogs.join('\n')).toContain('監視対象ログ');
    expect(summary.publicLogs.join('\n')).not.toContain('スパイ');
    expect(summary.evidence.some((event) => event.playerId === 'p4' && event.kind === 'monitored_noise')).toBe(true);
  });

  it('prepares final inference hints before the final vote', () => {
    const engine = new GameEngine({ totalPlayers: 4, humanPlayers: 0, seed: 50, spyId: 'p4' });
    engine.state.bossHp = 0;
    for (const player of engine.state.players) {
      engine.submitAction({ playerId: player.id, type: 'defend' });
    }
    engine.resolveActions();
    for (const player of engine.state.players) {
      engine.submitPlea(player.id, '防御しました');
    }
    engine.resolvePleas();

    expect(engine.state.phase).toBe('vote');
    expect(engine.state.inferenceHints).toHaveLength(3);
    expect(engine.state.publicLogs.join('\n')).toContain('最終推理ヒント');
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

function completePartyRound(engine: GameEngine, gunnerAction: 'normal_attack' | 'defend' | 'repair'): void {
  for (const player of engine.state.players) {
    engine.submitAction({
      playerId: player.id,
      type: player.role === 'spy' ? 'fake_attack' : gunnerAction,
    });
  }
  engine.resolveActions();
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
    spyBossHelpCount: 0,
    armorRegenAttemptCount: 0,
    armorRegenSuccessCount: 0,
    baseDamage: 0,
    repairs: 0,
    repairCount: 0,
    defenseCount: 0,
    sabotageCount: 0,
    sabotagePressure: false,
    actions: {},
    sabotagedPlayerIds: [],
    remainingBossHp: 0,
    remainingBaseHp: 100,
    scrambleLog: false,
    scans: [],
    votes: {},
    publicLogs: [],
    evidence: [],
  };
}

function fixedRandom(value: number): RandomSource {
  return {
    next: () => value,
  };
}
