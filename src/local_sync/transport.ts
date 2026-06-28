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

export function createBroadcastChannelTransport(channelName = LOCAL_SYNC_CHANNEL): LocalSyncTransport {
  if (typeof BroadcastChannel === 'undefined') {
    return new NoopLocalSyncTransport();
  }
  return new BroadcastChannelTransport(channelName);
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
