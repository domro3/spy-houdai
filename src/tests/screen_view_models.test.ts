import { describe, expect, it } from 'vitest';
import { GameEngine } from '../core/game_engine';
import { parseLocalRoute, shouldOpenRouteButtonInNewTab } from '../screens/local_routes';
import { createHostScreenViewModel, createPlayerScreenViewModel } from '../screens/screen_view_models';
import { phaseReadyCount } from '../screens/screen_state';

describe('local screen routes', () => {
  it('parses host, player, debug, and fallback routes without networking state', () => {
    expect(parseLocalRoute('/')).toMatchObject({ view: 'split', path: '/' });
    expect(parseLocalRoute('/board')).toMatchObject({ view: 'board', path: '/board' });
    expect(parseLocalRoute('/host')).toMatchObject({ view: 'board', path: '/host' });
    expect(parseLocalRoute('/debug')).toMatchObject({ view: 'debug', path: '/debug' });
    expect(parseLocalRoute('/player/p2')).toMatchObject({ view: 'player', playerId: 'p2' });
    expect(parseLocalRoute('/player/p9')).toMatchObject({ view: 'player', invalidPlayerId: 'p9' });
    expect(parseLocalRoute('/unknown')).toMatchObject({ view: 'split', invalidPath: '/unknown' });
  });

  it('keeps board and player route buttons from replacing active synced tabs', () => {
    expect(shouldOpenRouteButtonInNewTab('board', false)).toBe(true);
    expect(shouldOpenRouteButtonInNewTab('player', false)).toBe(true);
    expect(shouldOpenRouteButtonInNewTab('board', true)).toBe(false);
    expect(shouldOpenRouteButtonInNewTab('player', true)).toBe(false);
    expect(shouldOpenRouteButtonInNewTab('split', false)).toBe(false);
    expect(shouldOpenRouteButtonInNewTab('debug', false)).toBe(false);
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

  it('shows disconnected local player slots as auto-waiting on the public board', () => {
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
    expect(hostView.players.find((player) => player.id === 'p2')?.inputStatus).toBe('自動待機');
    expect(hostView.players.find((player) => player.id === 'p1')?.inputStatus).toBe('入力済み');
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
});
