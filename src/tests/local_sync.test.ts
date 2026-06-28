import { describe, expect, it, vi } from 'vitest';
import { createLocalSyncMessage, isLocalSyncMessage } from '../local_sync/messages';
import { createBroadcastChannelTransport } from '../local_sync/transport';

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
});
