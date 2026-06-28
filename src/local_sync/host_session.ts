import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../core/game_engine';
import { createHostScreenViewModel, createPlayerScreenViewModel } from '../screens/screen_view_models';
import {
  createLocalSyncMessage,
  type HostToPlayerMessage,
  type LocalSyncMessage,
} from './messages';
import { createBroadcastChannelTransport, type LocalSyncTransport } from './transport';

export interface LocalHostSessionStatus {
  role: 'host';
  available: boolean;
  sessionId: string;
  connectedPlayers: string[];
  messagesReceived: number;
  snapshotsSent: number;
  lastEvent: string;
}

export interface LocalHostSessionOptions {
  engine: GameEngine;
  transport?: LocalSyncTransport;
  sessionId?: string;
  onStateChanged?: () => void;
  onStatusChanged?: (status: LocalHostSessionStatus) => void;
}

export class LocalHostSession {
  private engine: GameEngine;
  private readonly transport: LocalSyncTransport;
  private readonly sessionId: string;
  private readonly onStateChanged?: () => void;
  private readonly onStatusChanged?: (status: LocalHostSessionStatus) => void;
  private readonly connectedPlayers = new Set<string>();
  private unsubscribe?: () => void;
  private heartbeatId?: number;
  private messagesReceived = 0;
  private snapshotsSent = 0;
  private lastEvent = 'host session created';

  constructor(options: LocalHostSessionOptions) {
    this.engine = options.engine;
    this.transport = options.transport ?? createBroadcastChannelTransport();
    this.sessionId = options.sessionId ?? createSessionId();
    this.onStateChanged = options.onStateChanged;
    this.onStatusChanged = options.onStatusChanged;
  }

  get status(): LocalHostSessionStatus {
    return {
      role: 'host',
      available: this.transport.available,
      sessionId: this.sessionId,
      connectedPlayers: [...this.connectedPlayers].sort(),
      messagesReceived: this.messagesReceived,
      snapshotsSent: this.snapshotsSent,
      lastEvent: this.lastEvent,
    };
  }

  start(): void {
    this.unsubscribe = this.transport.subscribe((message) => this.handleMessage(message));
    this.broadcastHello();
    this.broadcastSnapshot();
    if (typeof window !== 'undefined') {
      this.heartbeatId = window.setInterval(() => this.broadcastHello(), 2000);
    }
    this.emitStatus();
  }

  setEngine(engine: GameEngine, reason = 'host state updated'): void {
    this.engine = engine;
    this.lastEvent = reason;
    this.broadcastSnapshot();
    this.emitStatus();
  }

  broadcastSnapshot(): void {
    this.post(createLocalSyncMessage('state_snapshot', 'host', {
      sessionId: this.sessionId,
      hostView: createHostScreenViewModel(this.engine),
    }));
    for (const player of this.engine.state.players) {
      this.post(createLocalSyncMessage('player_view', 'host', {
        sessionId: this.sessionId,
        playerId: player.id,
        playerView: createPlayerScreenViewModel(this.engine, player.id),
      }));
    }
    this.snapshotsSent += 1;
    this.lastEvent = `snapshot broadcast r${this.engine.state.round}`;
    this.emitStatus();
  }

  broadcastReset(reason: string): void {
    this.post(createLocalSyncMessage('session_reset', 'host', {
      sessionId: this.sessionId,
      reason,
    }));
    this.broadcastSnapshot();
  }

  dispose(): void {
    if (this.unsubscribe) this.unsubscribe();
    if (this.heartbeatId !== undefined && typeof window !== 'undefined') {
      window.clearInterval(this.heartbeatId);
    }
    this.transport.close();
  }

  private handleMessage(message: LocalSyncMessage): void {
    if (message.sender === 'host') return;
    this.messagesReceived += 1;
    try {
      switch (message.type) {
        case 'player_hello':
          this.connectedPlayers.add(message.payload.playerId);
          this.lastEvent = `${message.payload.playerId} connected`;
          this.broadcastHello();
          this.broadcastSnapshot();
          break;
        case 'request_snapshot':
          if (message.payload.playerId) this.connectedPlayers.add(message.payload.playerId);
          this.lastEvent = 'snapshot requested';
          this.broadcastSnapshot();
          break;
        case 'submit_action':
          this.assertKnownPlayer(message.payload.playerId);
          this.engine.submitAction(message.payload);
          this.acceptCommand(`action from ${message.payload.playerId}`);
          break;
        case 'submit_vote':
          this.assertKnownPlayer(message.payload.voterId);
          this.assertKnownPlayer(message.payload.targetId);
          this.engine.submitVote(message.payload);
          this.acceptCommand(`vote from ${message.payload.voterId}`);
          break;
        case 'submit_plea':
          this.assertKnownPlayer(message.payload.playerId);
          this.engine.submitPlea(message.payload.playerId, message.payload.plea);
          this.acceptCommand(`plea from ${message.payload.playerId}`);
          break;
        case 'submit_branch_vote':
          this.assertKnownPlayer(message.payload.voterId);
          this.engine.submitBranchVote(message.payload);
          this.acceptCommand(`branch vote from ${message.payload.voterId}`);
          break;
        default:
          break;
      }
    } catch (error) {
      const targetPlayerId = 'payload' in message && message.payload && typeof message.payload === 'object'
        ? extractTargetPlayerId(message.payload)
        : undefined;
      this.sendError(error instanceof Error ? error.message : 'Local sync command failed', targetPlayerId);
    } finally {
      this.emitStatus();
    }
  }

  private acceptCommand(event: string): void {
    this.lastEvent = event;
    this.onStateChanged?.();
    this.broadcastSnapshot();
  }

  private broadcastHello(): void {
    this.post(createLocalSyncMessage('host_hello', 'host', {
      sessionId: this.sessionId,
      mode: this.engine.state.mode,
      round: this.engine.state.round,
      phase: this.engine.state.phase,
    }));
  }

  private sendError(message: string, targetPlayerId?: string): void {
    this.lastEvent = `error: ${message}`;
    this.post(createLocalSyncMessage('error', 'host', {
      sessionId: this.sessionId,
      targetPlayerId,
      message,
    }));
  }

  private post(message: HostToPlayerMessage): void {
    this.transport.post(message);
  }

  private assertKnownPlayer(playerId: string): void {
    this.engine.getPlayer(playerId);
  }

  private emitStatus(): void {
    this.onStatusChanged?.(this.status);
  }
}

export function useLocalHostSession({
  enabled,
  engine,
  onStateChanged,
}: {
  enabled: boolean;
  engine: GameEngine;
  onStateChanged: () => void;
}): {
  status?: LocalHostSessionStatus;
  broadcastSnapshot: () => void;
  replaceEngine: (engine: GameEngine, reason?: string) => void;
  broadcastReset: (reason: string) => void;
} {
  const sessionRef = useRef<LocalHostSession | undefined>(undefined);
  const [status, setStatus] = useState<LocalHostSessionStatus | undefined>();

  useEffect(() => {
    if (!enabled) {
      sessionRef.current?.dispose();
      sessionRef.current = undefined;
      setStatus(undefined);
      return undefined;
    }

    const session = new LocalHostSession({
      engine,
      onStateChanged,
      onStatusChanged: setStatus,
    });
    session.start();
    sessionRef.current = session;
    return () => {
      session.dispose();
      if (sessionRef.current === session) {
        sessionRef.current = undefined;
      }
    };
  }, [enabled]);

  useEffect(() => {
    sessionRef.current?.setEngine(engine);
  }, [engine]);

  return {
    status,
    broadcastSnapshot: () => sessionRef.current?.broadcastSnapshot(),
    replaceEngine: (nextEngine, reason) => sessionRef.current?.setEngine(nextEngine, reason),
    broadcastReset: (reason) => sessionRef.current?.broadcastReset(reason),
  };
}

function extractTargetPlayerId(payload: object): string | undefined {
  const candidate = payload as Partial<{ playerId: string; voterId: string }>;
  return candidate.playerId ?? candidate.voterId;
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
