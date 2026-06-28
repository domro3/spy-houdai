import { describe, expect, it } from 'vitest';
import { GameEngine } from '../core/game_engine';
import { parseLocalRoute } from '../screens/local_routes';
import { createHostScreenViewModel, createPlayerScreenViewModel } from '../screens/screen_view_models';

describe('local screen routes', () => {
  it('parses host, player, debug, and fallback routes without networking state', () => {
    expect(parseLocalRoute('/')).toMatchObject({ view: 'split', path: '/' });
    expect(parseLocalRoute('/host')).toMatchObject({ view: 'host', path: '/host' });
    expect(parseLocalRoute('/debug')).toMatchObject({ view: 'debug', path: '/debug' });
    expect(parseLocalRoute('/player/p2')).toMatchObject({ view: 'player', playerId: 'p2' });
    expect(parseLocalRoute('/player/p9')).toMatchObject({ view: 'player', invalidPlayerId: 'p9' });
    expect(parseLocalRoute('/unknown')).toMatchObject({ view: 'split', invalidPath: '/unknown' });
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
