import {
  isLocalSyncMessage,
  LOCAL_SYNC_CHANNEL,
  type LocalSyncMessage,
} from './messages';

export type LocalSyncHandler = (message: LocalSyncMessage) => void;

export interface LocalSyncTransport {
  readonly available: boolean;
  readonly closed: boolean;
  post(message: LocalSyncMessage): void;
  subscribe(handler: LocalSyncHandler): () => void;
  close(): void;
}

export function createDefaultLocalSyncTransport(channelName = LOCAL_SYNC_CHANNEL): LocalSyncTransport {
  if (shouldUseHttpRelayTransport()) {
    return new HttpRelayTransport();
  }
  return createBroadcastChannelTransport(channelName);
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
  if (params.get('relay') === '1') return true;
  return window.location.protocol === 'http:'
    && !['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
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
