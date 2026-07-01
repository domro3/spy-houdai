import { describe, expect, it } from 'vitest';
import { GameEngine } from '../core/game_engine';
import {
  parseLocalRoute,
  shouldOpenRouteButtonInNewTab,
  stripRouteBase,
  withRouteBase,
} from '../screens/local_routes';
import { createHostScreenViewModel, createPlayerScreenViewModel } from '../screens/screen_view_models';
import { phaseReadyCount } from '../screens/screen_state';

describe('local screen routes', () => {
  it('parses host, player, debug, and fallback routes without networking state', () => {
    expect(parseLocalRoute('/')).toMatchObject({ view: 'alpha', path: '/' });
    expect(parseLocalRoute('/dev')).toMatchObject({ view: 'split', path: '/dev' });
    expect(parseLocalRoute('/board')).toMatchObject({ view: 'board', path: '/board' });
    expect(parseLocalRoute('/host')).toMatchObject({ view: 'board', path: '/host' });
    expect(parseLocalRoute('/debug')).toMatchObject({ view: 'debug', path: '/debug' });
    expect(parseLocalRoute('/player/p2')).toMatchObject({ view: 'player', playerId: 'p2' });
    expect(parseLocalRoute('/player/p9')).toMatchObject({ view: 'player', invalidPlayerId: 'p9' });
    expect(parseLocalRoute('/unknown')).toMatchObject({ view: 'alpha', invalidPath: '/unknown' });
  });

  it('keeps board and player route buttons from replacing active synced tabs', () => {
    expect(shouldOpenRouteButtonInNewTab('board', false)).toBe(true);
    expect(shouldOpenRouteButtonInNewTab('player', false)).toBe(true);
    expect(shouldOpenRouteButtonInNewTab('board', true)).toBe(false);
    expect(shouldOpenRouteButtonInNewTab('player', true)).toBe(false);
    expect(shouldOpenRouteButtonInNewTab('split', false)).toBe(false);
    expect(shouldOpenRouteButtonInNewTab('debug', false)).toBe(false);
  });

  it('keeps local routes usable under a static hosting base path', () => {
    expect(stripRouteBase('/spy-houdai/', '/spy-houdai/')).toBe('/');
    expect(stripRouteBase('/spy-houdai/board', '/spy-houdai/')).toBe('/board');
    expect(stripRouteBase('/spy-houdai/player/p1', '/spy-houdai/')).toBe('/player/p1');
    expect(stripRouteBase('/board', './')).toBe('/board');

    expect(withRouteBase('/', '/spy-houdai/')).toBe('/spy-houdai/');
    expect(withRouteBase('/board', '/spy-houdai/')).toBe('/spy-houdai/board');
    expect(withRouteBase('/player/p1', '/spy-houdai/')).toBe('/spy-houdai/player/p1');
    expect(withRouteBase('/board', './')).toBe('/board');
  });
});

describe('screen privacy guardrails', () => {
  it('keeps active HostScreen projection free of role, private log, and debug secrets', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 1,
      seed: 80,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.privateLogs.p4.push('秘密ログ: ボスを助ける準備。');
    engine.state.debugLogs.push('[debug] spy=p4 secret action=boss_heal');

    const hostView = createHostScreenViewModel(engine);
    const spyPublicRow = hostView.players.find((player) => player.id === 'p4');
    const serialized = JSON.stringify(hostView);

    expect(hostView.board).toMatchObject({
      modeLabel: 'Party Mode',
      phaseLabel: '行動選択',
      round: 1,
      ready: 0,
      readyTotal: 1,
      bossHp: engine.state.bossHp,
      baseHp: engine.state.baseHp,
    });
    expect(spyPublicRow?.role).toBe('非公開');
    expect(serialized).not.toContain('スパイ');
    expect(serialized).not.toContain('ボスを助ける');
    expect(serialized).not.toContain('秘密ログ');
    expect(serialized).not.toContain('[debug]');
    expect(serialized).not.toContain('boss_heal');
    expect(serialized).not.toContain('CPU入力');
    expect(serialized).not.toContain('CPU完走');
    expect(serialized).not.toContain('解決');
  });

  it('shows disconnected local player slots as auto-syncing on the public board', () => {
    const engine = new GameEngine({
      totalPlayers: 5,
      humanPlayers: 5,
      seed: 82,
      spyId: 'p5',
      mode: 'party',
    });
    engine.getPlayer('p2').isConnected = false;
    engine.getPlayer('p3').isConnected = false;
    engine.submitAction({ playerId: 'p1', type: 'normal_attack' });

    const hostView = createHostScreenViewModel(engine);
    expect(phaseReadyCount(engine)).toEqual({ ready: 1, total: 3 });
    expect(hostView.players.find((player) => player.id === 'p2')).toMatchObject({
      inputStatus: '自動同期中',
      inputTone: 'auto',
    });
    expect(hostView.players.find((player) => player.id === 'p1')).toMatchObject({
      inputStatus: '作戦送信済み',
      inputTone: 'ready',
    });
    expect(hostView.board.flowTitle).toBe('2基の作戦待ち');
    expect(hostView.board.flowBody).toBeTruthy();
  });

  it('projects public battle results for player-side board previews without private actions', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 0,
      seed: 84,
      spyId: 'p4',
      mode: 'party',
    });

    for (const player of engine.state.players) {
      engine.submitAction({
        playerId: player.id,
        type: player.id === 'p4' ? 'sabotage' : 'normal_attack',
        targetId: player.id === 'p4' ? 'p1' : undefined,
      });
    }
    engine.resolveActions();

    const hostView = createHostScreenViewModel(engine);
    const serialized = JSON.stringify(hostView.board);

    expect(hostView.board.latestRound).toMatchObject({
      round: 1,
      sabotageCount: 1,
    });
    expect(hostView.publicLogs.join('\n')).toContain('ノイズ');
    expect(serialized).toContain('sabotageCount');
    expect(serialized).not.toContain('スパイ');
    expect(serialized).not.toContain('邪魔する');
    expect(serialized).not.toContain('p4:sabotage');
  });

  it('lets PlayerScreen projection show only the selected player private surface', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 1,
      seed: 81,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.privateLogs.p1.push('赤砲台だけの個別ログ。');
    engine.state.privateLogs.p4.push('スパイだけの個別ログ。');

    const gunnerView = createPlayerScreenViewModel(engine, 'p1');
    const spyView = createPlayerScreenViewModel(engine, 'p4');

    expect(gunnerView.role).toBe('砲台チーム');
    expect(gunnerView.privateLogs).toEqual(['赤砲台だけの個別ログ。']);
    expect(gunnerView.privateLogs.join('\n')).not.toContain('スパイだけ');
    expect(spyView.role).toBe('スパイ');
    expect(spyView.privateLogs).toEqual(['スパイだけの個別ログ。']);
    expect(spyView.availableActions.map((action) => action.label)).toEqual([
      '撃つ',
      '守る',
      '直す',
      '弱く撃つ',
      '邪魔する',
      'ボスを助ける',
    ]);
  });

  it('projects finished awards to player terminals after the reveal', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 0,
      seed: 83,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.bossHp = 1;

    for (const player of engine.state.players) {
      engine.submitAction({ playerId: player.id, type: 'normal_attack' });
    }
    engine.resolveActions();
    engine.submitVote({ voterId: 'p1', targetId: 'p4' });
    engine.submitVote({ voterId: 'p2', targetId: 'p4' });
    engine.submitVote({ voterId: 'p3', targetId: 'p1' });
    engine.submitVote({ voterId: 'p4', targetId: 'p1' });
    engine.resolveVotes();

    const gunnerView = createPlayerScreenViewModel(engine, 'p1');

    expect(gunnerView.result?.spyName).toBe('黄砲台');
    expect(gunnerView.result?.finalVoteOutcome).toBe('おまけ投票成功');
    expect(gunnerView.result?.awards.length).toBeGreaterThanOrEqual(4);
    expect(gunnerView.result?.awards.some((award) => award.title === '名探偵砲台チーム')).toBe(true);
    expect(gunnerView.result?.awards.some((award) => award.isMine)).toBe(true);
  });
});
