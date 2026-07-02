import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from '../core/game_engine';
import { LocalHostSession } from '../local_sync/host_session';
import { createLocalSyncMessage, isLocalSyncMessage } from '../local_sync/messages';
import {
  normalizePhoneSyncRoom,
  phoneSyncRoomFromSearch,
  playRouteSearchFor,
  wantsPhoneSync,
} from '../local_sync/phone_room';
import {
  createBroadcastChannelTransport,
  createDefaultLocalSyncTransport,
  type LocalSyncHandler,
  type LocalSyncTransport,
} from '../local_sync/transport';
import type { LocalSyncMessage } from '../local_sync/messages';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('local sync messages', () => {
  it('creates serializable protocol messages', () => {
    const message = createLocalSyncMessage('player_hello', 'player', { playerId: 'p1' });

    expect(isLocalSyncMessage(message)).toBe(true);
    expect(message).toMatchObject({
      protocol: 'spy-houdai-local-sync',
      version: 1,
      type: 'player_hello',
      sender: 'player',
      payload: { playerId: 'p1' },
    });
    expect(JSON.parse(JSON.stringify(message))).toMatchObject({
      type: 'player_hello',
      payload: { playerId: 'p1' },
    });
  });

  it('rejects unrelated objects', () => {
    expect(isLocalSyncMessage({ type: 'submit_action' })).toBe(false);
    expect(isLocalSyncMessage(null)).toBe(false);
  });
});

describe('phone sync rooms', () => {
  it('normalizes room codes and detects phone sync URLs', () => {
    expect(normalizePhoneSyncRoom(' ab-cd! ')).toBe('ABCD');
    expect(normalizePhoneSyncRoom('abc')).toBeUndefined();
    expect(phoneSyncRoomFromSearch('?sync=phone&room=abc123')).toBe('ABC123');
    expect(wantsPhoneSync('?room=ABC123')).toBe(true);
    expect(wantsPhoneSync('?sync=local&room=ABC123')).toBe(false);
  });

  it('builds room search only for play routes', () => {
    const publicLocation = {
      protocol: 'https:',
      hostname: 'domro3.github.io',
      search: '',
    } as Location;

    expect(playRouteSearchFor('/board', '', publicLocation)).toMatch(/^\?sync=phone&room=[A-Z0-9]{6}$/);
    expect(playRouteSearchFor('/player/p1', '?sync=phone', publicLocation)).toBe('');
    expect(playRouteSearchFor('/player/p1', '?sync=phone&room=abc123', publicLocation)).toBe('?sync=phone&room=ABC123');
    expect(playRouteSearchFor('/debug', '?sync=phone&room=ABC123', publicLocation)).toBe('');
  });
});

describe('local sync transport', () => {
  it('falls back without crashing when BroadcastChannel is unavailable', () => {
    const original = globalThis.BroadcastChannel;
    Reflect.deleteProperty(globalThis, 'BroadcastChannel');

    const transport = createBroadcastChannelTransport();
    const unsubscribe = transport.subscribe(vi.fn());
    transport.post(createLocalSyncMessage('request_snapshot', 'player', { playerId: 'p1' }));
    unsubscribe();
    transport.close();

    expect(transport.available).toBe(false);
    expect(transport.closed).toBe(true);
    globalThis.BroadcastChannel = original;
  });

  it('uses the HTTP relay transport when relay mode is requested', () => {
    const eventSourceUrls: string[] = [];
    const fetchCalls: Array<[string, RequestInit]> = [];
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      fetchCalls.push([url, init]);
      return Promise.resolve({ ok: true });
    });
    class FakeEventSource {
      onmessage: ((event: MessageEvent<string>) => void) | null = null;

      constructor(url: string) {
        eventSourceUrls.push(url);
      }

      close(): void {
        // The fake only records wiring; stream behavior is covered by the LAN server check.
      }
    }

    vi.stubGlobal('window', {
      location: { search: '?relay=1', protocol: 'http:', hostname: '127.0.0.1' },
    });
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('BroadcastChannel should not be used in relay mode');
      }
    });

    const transport = createDefaultLocalSyncTransport();
    transport.post(createLocalSyncMessage('request_snapshot', 'player', { playerId: 'p1' }));
    transport.close();

    expect(transport.available).toBe(true);
    expect(eventSourceUrls[0]).toMatch(/^\/sync\/events\?clientId=/);
    expect(fetchMock).toHaveBeenCalledWith('/sync/message', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }));
    const postedRequest = fetchCalls[0];
    expect(postedRequest).toBeDefined();
    const body = JSON.parse(postedRequest?.[1].body as string) as { message: LocalSyncMessage };
    expect(body.message.type).toBe('request_snapshot');
  });

  it('auto-enables the HTTP relay for LAN host URLs', () => {
    const eventSourceUrls: string[] = [];
    class FakeEventSource {
      onmessage: ((event: MessageEvent<string>) => void) | null = null;

      constructor(url: string) {
        eventSourceUrls.push(url);
      }

      close(): void {
        // The fake only records transport selection.
      }
    }

    vi.stubGlobal('window', {
      location: { search: '', protocol: 'http:', hostname: '192.168.1.30' },
    });
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('BroadcastChannel should not be used for LAN host URLs');
      }
    });

    const transport = createDefaultLocalSyncTransport();
    transport.close();

    expect(transport.available).toBe(true);
    expect(eventSourceUrls).toHaveLength(1);
  });

  it('marks requested HTTP relay unavailable when browser APIs are missing', () => {
    vi.stubGlobal('window', {
      location: { search: '?relay=1', protocol: 'http:', hostname: '127.0.0.1' },
    });
    vi.stubGlobal('EventSource', undefined);
    vi.stubGlobal('fetch', undefined);
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('BroadcastChannel should not be used in relay mode');
      }
    });

    const transport = createDefaultLocalSyncTransport();
    transport.post(createLocalSyncMessage('request_snapshot', 'player', { playerId: 'p1' }));
    transport.close();

    expect(transport.available).toBe(false);
    expect(transport.closed).toBe(true);
  });

  it('uses phone room transport for room URLs instead of BroadcastChannel', () => {
    vi.stubGlobal('window', {
      location: {
        search: '?sync=phone&room=ABC123',
        protocol: 'https:',
        hostname: 'domro3.github.io',
        pathname: '/spy-houdai/board',
      },
    });
    vi.stubGlobal('RTCPeerConnection', undefined);
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('BroadcastChannel should not be used for phone room URLs');
      }
    });

    const transport = createDefaultLocalSyncTransport({ role: 'host' });
    transport.close();

    expect(transport.available).toBe(false);
    expect(transport.closed).toBe(true);
  });

  it('auto-creates a phone room on the public board route', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: {
        search: '',
        protocol: 'https:',
        hostname: 'domro3.github.io',
        pathname: '/spy-houdai/board',
        hash: '',
      },
      history: { replaceState },
    });
    vi.stubGlobal('RTCPeerConnection', undefined);
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('BroadcastChannel should not be used after auto phone room creation');
      }
    });

    const transport = createDefaultLocalSyncTransport({ role: 'host' });
    transport.close();

    expect(replaceState).toHaveBeenCalledWith(null, '', expect.stringMatching(/^\/spy-houdai\/board\?sync=phone&room=[A-Z0-9]{6}$/));
    expect(transport.available).toBe(false);
  });
});

describe('local host session', () => {
  it('broadcasts snapshots and accepts player commands through transport', () => {
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 1,
      seed: 91,
      spyId: 'p4',
      mode: 'party',
    });
    const transport = new MemoryTransport();
    const session = new LocalHostSession({
      engine,
      transport,
      sessionId: 'test-session',
    });

    session.start();
    expect(transport.sent.map((message) => message.type)).toContain('host_hello');
    expect(transport.sent.map((message) => message.type)).toContain('state_snapshot');
    expect(transport.sent.filter((message) => message.type === 'player_view')).toHaveLength(4);
    const snapshot = transport.sent.find((message): message is Extract<LocalSyncMessage, { type: 'state_snapshot' }> => (
      message.type === 'state_snapshot'
    ));
    expect(snapshot?.payload.hostView.board).toMatchObject({
      phaseLabel: '行動選択',
      round: 1,
      ready: 0,
      readyTotal: 1,
    });

    transport.sent = [];
    transport.emit(createLocalSyncMessage('player_hello', 'player', { playerId: 'p1' }));
    expect(session.status.connectedPlayers).toEqual(['p1']);
    expect(transport.sent.map((message) => message.type)).toContain('state_snapshot');

    transport.sent = [];
    transport.emit(createLocalSyncMessage('submit_action', 'player', {
      playerId: 'p1',
      type: 'normal_attack',
    }));
    expect(engine.state.submittedActions.p1?.type).toBe('normal_attack');
    expect(transport.sent.map((message) => message.type)).toContain('state_snapshot');

    transport.sent = [];
    transport.emit(createLocalSyncMessage('submit_action', 'player', {
      playerId: 'p9',
      type: 'normal_attack',
    }));
    expect(transport.sent.find((message) => message.type === 'error')?.payload.message).toContain('Unknown player');

    session.dispose();
    expect(transport.closed).toBe(true);
  });

  it('auto-fills CPU actions and resolves after required human actions are submitted', async () => {
    vi.useFakeTimers();
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 1,
      seed: 42,
      spyId: 'p4',
      mode: 'party',
    });
    const transport = new MemoryTransport();
    const session = new LocalHostSession({
      engine,
      transport,
      sessionId: 'auto-action',
      autoAdvanceDelayMs: 1,
    });

    session.start();
    transport.emit(createLocalSyncMessage('submit_action', 'player', {
      playerId: 'p1',
      type: 'normal_attack',
    }));

    expect(engine.state.phase).toBe('action');
    await vi.advanceTimersByTimeAsync(1);

    expect(engine.state.history).toHaveLength(1);
    expect(engine.state.phase).toBe('action');
    expect(engine.state.round).toBe(2);
    expect(engine.state.submittedActions).toEqual({});

    session.dispose();
    vi.useRealTimers();
  });

  it('auto-resolves after the connected local players submit and fills unopened human slots as CPU', async () => {
    vi.useFakeTimers();
    const engine = new GameEngine({
      totalPlayers: 5,
      humanPlayers: 5,
      seed: 20260627,
      spyId: 'p5',
      mode: 'party',
    });
    const transport = new MemoryTransport();
    const session = new LocalHostSession({
      engine,
      transport,
      sessionId: 'connected-only-action',
      autoAdvanceDelayMs: 1,
    });

    session.start();
    transport.emit(createLocalSyncMessage('player_hello', 'player', { playerId: 'p1' }));
    expect(engine.getPlayer('p2').isConnected).toBe(false);

    transport.emit(createLocalSyncMessage('submit_action', 'player', {
      playerId: 'p1',
      type: 'normal_attack',
    }));
    await vi.advanceTimersByTimeAsync(1);

    expect(engine.state.history).toHaveLength(1);
    expect(engine.state.round).toBe(2);
    expect(engine.state.bossHp).toBeLessThan(engine.state.bossMaxHp);
    expect(engine.state.history[0]?.totalDamage).toBeGreaterThan(0);

    session.dispose();
    vi.useRealTimers();
  });

  it('waits for every connected local player before resolving the board round', async () => {
    vi.useFakeTimers();
    const engine = new GameEngine({
      totalPlayers: 5,
      humanPlayers: 5,
      seed: 20260628,
      spyId: 'p5',
      mode: 'party',
    });
    const transport = new MemoryTransport();
    const session = new LocalHostSession({
      engine,
      transport,
      sessionId: 'connected-wait',
      autoAdvanceDelayMs: 1,
    });

    session.start();
    transport.emit(createLocalSyncMessage('player_hello', 'player', { playerId: 'p1' }));
    transport.emit(createLocalSyncMessage('player_hello', 'player', { playerId: 'p2' }));

    transport.emit(createLocalSyncMessage('submit_action', 'player', {
      playerId: 'p1',
      type: 'normal_attack',
    }));
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.state.history).toHaveLength(0);
    expect(engine.state.bossHp).toBe(engine.state.bossMaxHp);

    transport.emit(createLocalSyncMessage('submit_action', 'player', {
      playerId: 'p2',
      type: 'normal_attack',
    }));
    await vi.advanceTimersByTimeAsync(1);

    expect(engine.state.history).toHaveLength(1);
    expect(engine.state.bossHp).toBeLessThan(engine.state.bossMaxHp);

    session.dispose();
    vi.useRealTimers();
  });

  it('auto-resolves the final spy vote without a facilitator button', async () => {
    vi.useFakeTimers();
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 1,
      seed: 43,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.bossHp = 10;
    const transport = new MemoryTransport();
    const session = new LocalHostSession({
      engine,
      transport,
      sessionId: 'auto-vote',
      autoAdvanceDelayMs: 1,
    });

    session.start();
    transport.emit(createLocalSyncMessage('submit_action', 'player', {
      playerId: 'p1',
      type: 'normal_attack',
    }));
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.state.phase).toBe('vote');

    transport.emit(createLocalSyncMessage('submit_vote', 'player', {
      voterId: 'p1',
      targetId: 'p4',
    }));
    await vi.advanceTimersByTimeAsync(1);

    expect(engine.state.phase).toBe('finished');
    expect(engine.state.result?.bossDefeated).toBe(true);
    expect(engine.state.votes.p1?.targetId).toBe('p4');

    session.dispose();
    vi.useRealTimers();
  });

  it('rejects stale player commands after auto progression changes phase', async () => {
    vi.useFakeTimers();
    const engine = new GameEngine({
      totalPlayers: 4,
      humanPlayers: 1,
      seed: 44,
      spyId: 'p4',
      mode: 'party',
    });
    engine.state.bossHp = 10;
    const transport = new MemoryTransport();
    const session = new LocalHostSession({
      engine,
      transport,
      sessionId: 'late-command',
      autoAdvanceDelayMs: 1,
    });

    session.start();
    transport.emit(createLocalSyncMessage('submit_action', 'player', {
      playerId: 'p1',
      type: 'normal_attack',
    }));
    await vi.advanceTimersByTimeAsync(1);
    expect(engine.state.phase).toBe('vote');

    transport.sent = [];
    transport.emit(createLocalSyncMessage('submit_action', 'player', {
      playerId: 'p1',
      type: 'normal_attack',
    }));

    expect(transport.sent.find((message) => message.type === 'error')?.payload.message).toContain('Expected phase action');

    session.dispose();
    vi.useRealTimers();
  });
});

class MemoryTransport implements LocalSyncTransport {
  readonly available = true;
  sent: LocalSyncMessage[] = [];
  private handlers = new Set<LocalSyncHandler>();
  private isClosed = false;

  get closed(): boolean {
    return this.isClosed;
  }

  post(message: LocalSyncMessage): void {
    this.sent.push(message);
  }

  subscribe(handler: LocalSyncHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emit(message: LocalSyncMessage): void {
    for (const handler of this.handlers) {
      handler(message);
    }
  }

  close(): void {
    this.isClosed = true;
  }
}
