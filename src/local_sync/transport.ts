import { Peer, type DataConnection } from 'peerjs';
import {
  isLocalSyncMessage,
  LOCAL_SYNC_CHANNEL,
  type LocalSyncMessage,
} from './messages';
import {
  ensurePhoneSyncRoomInUrl,
  phoneSyncRoomFromSearch,
  wantsPhoneSync,
} from './phone_room';

export type LocalSyncHandler = (message: LocalSyncMessage) => void;
export type LocalSyncRole = 'host' | 'player';

export interface LocalSyncTransportOptions {
  channelName?: string;
  role?: LocalSyncRole;
  playerId?: string;
}

export interface LocalSyncTransport {
  readonly available: boolean;
  readonly closed: boolean;
  post(message: LocalSyncMessage): void;
  subscribe(handler: LocalSyncHandler): () => void;
  close(): void;
}

export function createDefaultLocalSyncTransport(options: LocalSyncTransportOptions | string = {}): LocalSyncTransport {
  const transportOptions = typeof options === 'string' ? { channelName: options } : options;
  if (shouldUsePeerRoomTransport()) {
    return createPeerRoomTransport(transportOptions);
  }
  if (shouldUseHttpRelayTransport()) {
    return new HttpRelayTransport();
  }
  return createBroadcastChannelTransport(transportOptions.channelName ?? LOCAL_SYNC_CHANNEL);
}

export function createBroadcastChannelTransport(channelName = LOCAL_SYNC_CHANNEL): LocalSyncTransport {
  if (typeof BroadcastChannel === 'undefined') {
    return new NoopLocalSyncTransport();
  }
  return new BroadcastChannelTransport(channelName);
}

function shouldUseHttpRelayTransport(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('relay') === '0') return false;
  if (wantsPhoneSync(window.location.search)) return false;
  if (params.get('relay') === '1') return true;
  return window.location.protocol === 'http:'
    && !['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
}

function shouldUsePeerRoomTransport(): boolean {
  if (typeof window === 'undefined') return false;
  if (wantsPhoneSync(window.location.search)) return true;
  return Boolean(inferRoleFromPath() === 'host' && ensurePhoneSyncRoomInUrl('/board'));
}

function createPeerRoomTransport(options: LocalSyncTransportOptions): LocalSyncTransport {
  const role = options.role ?? inferRoleFromPath();
  const room = phoneSyncRoomFromSearch(window.location.search) ?? (role === 'host' ? ensurePhoneSyncRoomInUrl('/board') : undefined);
  if (!role || !room) return new NoopLocalSyncTransport();
  return new PeerRoomTransport({ role, room, playerId: options.playerId });
}

function inferRoleFromPath(): LocalSyncRole | undefined {
  if (typeof window === 'undefined') return undefined;
  const path = (window.location.pathname ?? '').replace(/\/+$/, '');
  if (/\/(?:board|host)$/.test(path)) return 'host';
  if (/\/player\/p[1-6]$/.test(path)) return 'player';
  return undefined;
}

class BroadcastChannelTransport implements LocalSyncTransport {
  readonly available = true;
  private readonly channel: BroadcastChannel;
  private readonly handlers = new Set<LocalSyncHandler>();
  private isClosed = false;

  constructor(channelName: string) {
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (event) => {
      if (!isLocalSyncMessage(event.data)) return;
      for (const handler of this.handlers) {
        handler(event.data);
      }
    };
  }

  get closed(): boolean {
    return this.isClosed;
  }

  post(message: LocalSyncMessage): void {
    if (this.isClosed) return;
    this.channel.postMessage(message);
  }

  subscribe(handler: LocalSyncHandler): () => void {
    if (this.isClosed) return () => undefined;
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  close(): void {
    if (this.isClosed) return;
    this.handlers.clear();
    this.channel.close();
    this.isClosed = true;
  }
}

class HttpRelayTransport implements LocalSyncTransport {
  readonly available: boolean;
  private readonly handlers = new Set<LocalSyncHandler>();
  private readonly clientId = createClientId();
  private readonly endpointBase: string;
  private eventSource?: EventSource;
  private isClosed = false;

  constructor(endpointBase = '/sync') {
    this.endpointBase = endpointBase;
    this.available = typeof EventSource !== 'undefined' && typeof fetch !== 'undefined';
    if (this.available) this.connect();
  }

  get closed(): boolean {
    return this.isClosed;
  }

  post(message: LocalSyncMessage): void {
    if (this.isClosed || !this.available) return;
    void fetch(`${this.endpointBase}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: this.clientId, message }),
    }).catch(() => undefined);
  }

  subscribe(handler: LocalSyncHandler): () => void {
    if (this.isClosed) return () => undefined;
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  close(): void {
    if (this.isClosed) return;
    this.handlers.clear();
    this.eventSource?.close();
    this.isClosed = true;
  }

  private connect(): void {
    if (typeof EventSource === 'undefined') return;
    const url = `${this.endpointBase}/events?clientId=${encodeURIComponent(this.clientId)}`;
    this.eventSource = new EventSource(url);
    this.eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as unknown;
        if (!isLocalSyncMessage(message)) return;
        for (const handler of this.handlers) {
          handler(message);
        }
      } catch {
        // Ignore malformed relay events; GameEngine validation still guards commands.
      }
    };
  }
}

class PeerRoomTransport implements LocalSyncTransport {
  readonly available: boolean;
  private readonly role: LocalSyncRole;
  private readonly room: string;
  private readonly playerId?: string;
  private readonly handlers = new Set<LocalSyncHandler>();
  private readonly connections = new Map<string, DataConnection>();
  private readonly pendingMessages: LocalSyncMessage[] = [];
  private peer?: Peer;
  private hostConnection?: DataConnection;
  private isClosed = false;

  constructor({
    role,
    room,
    playerId,
  }: {
    role: LocalSyncRole;
    room: string;
    playerId?: string;
  }) {
    this.role = role;
    this.room = room;
    this.playerId = playerId;
    this.available = supportsPeerRoomTransport();
    if (this.available) this.connect();
  }

  get closed(): boolean {
    return this.isClosed;
  }

  post(message: LocalSyncMessage): void {
    if (this.isClosed || !this.available) return;
    if (this.role === 'host') {
      let sent = false;
      for (const connection of this.connections.values()) {
        if (!connection.open) continue;
        connection.send(message);
        sent = true;
      }
      if (!sent) this.queuePending(message);
      return;
    }

    if (this.hostConnection?.open) {
      this.hostConnection.send(message);
      return;
    }
    this.queuePending(message);
  }

  subscribe(handler: LocalSyncHandler): () => void {
    if (this.isClosed) return () => undefined;
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  close(): void {
    if (this.isClosed) return;
    this.handlers.clear();
    this.pendingMessages.length = 0;
    for (const connection of this.connections.values()) {
      connection.close();
    }
    this.connections.clear();
    this.peer?.destroy();
    this.isClosed = true;
  }

  private connect(): void {
    if (this.role === 'host') {
      this.peer = new Peer(peerHostId(this.room), peerOptions());
      this.peer.on('connection', (connection) => this.wireConnection(connection));
      this.peer.on('error', () => undefined);
      return;
    }

    this.peer = new Peer(peerOptions());
    this.peer.on('open', () => {
      const connection = this.peer?.connect(peerHostId(this.room), {
        label: `player-${this.playerId ?? 'unknown'}`,
        metadata: { playerId: this.playerId, room: this.room },
        reliable: true,
        serialization: 'json',
      });
      if (connection) {
        this.hostConnection = connection;
        this.wireConnection(connection);
      }
    });
    this.peer.on('error', () => undefined);
  }

  private wireConnection(connection: DataConnection): void {
    const connectionKey = connection.connectionId || connection.peer;
    this.connections.set(connectionKey, connection);
    connection.on('open', () => {
      this.connections.set(connectionKey, connection);
      this.flushPending(connection);
    });
    connection.on('data', (data) => {
      if (!isLocalSyncMessage(data)) return;
      for (const handler of this.handlers) {
        handler(data);
      }
    });
    connection.on('close', () => {
      this.connections.delete(connectionKey);
      if (this.hostConnection === connection) this.hostConnection = undefined;
    });
    connection.on('error', () => {
      this.connections.delete(connectionKey);
      if (this.hostConnection === connection) this.hostConnection = undefined;
    });
    if (connection.open) this.flushPending(connection);
  }

  private flushPending(connection: DataConnection): void {
    if (!connection.open || this.pendingMessages.length === 0) return;
    const messages = this.pendingMessages.splice(0);
    for (const message of messages) {
      if (this.role === 'host') {
        for (const target of this.connections.values()) {
          if (target.open) target.send(message);
        }
        continue;
      }
      connection.send(message);
    }
  }

  private queuePending(message: LocalSyncMessage): void {
    this.pendingMessages.push(message);
    if (this.pendingMessages.length > 24) {
      this.pendingMessages.splice(0, this.pendingMessages.length - 24);
    }
  }
}

class NoopLocalSyncTransport implements LocalSyncTransport {
  readonly available = false;
  private isClosed = false;

  get closed(): boolean {
    return this.isClosed;
  }

  post(): void {
    // BroadcastChannel is unavailable in this runtime; local sync is simply disabled.
  }

  subscribe(): () => void {
    return () => undefined;
  }

  close(): void {
    this.isClosed = true;
  }
}

function createClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function supportsPeerRoomTransport(): boolean {
  return typeof window !== 'undefined'
    && typeof RTCPeerConnection !== 'undefined'
    && typeof WebSocket !== 'undefined';
}

function peerHostId(room: string): string {
  return `spy-houdai-${room.toLowerCase()}-host`;
}

function peerOptions() {
  return {
    debug: 0,
  };
}
