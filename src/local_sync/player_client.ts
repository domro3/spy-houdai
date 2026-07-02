import { useEffect, useRef, useState } from 'react';
import type { ActionSubmission, BranchVoteSubmission, VoteSubmission } from '../core/types';
import type { HostScreenViewModel, PlayerScreenViewModel } from '../screens/screen_view_models';
import { createLocalSyncMessage, type LocalSyncMessage } from './messages';
import { createDefaultLocalSyncTransport, type LocalSyncTransport } from './transport';

export type LocalPlayerConnectionStatus = 'connecting' | 'connected' | 'waiting' | 'unavailable';

export interface LocalPlayerClientState {
  status: LocalPlayerConnectionStatus;
  sessionId?: string;
  hostView?: HostScreenViewModel;
  playerView?: PlayerScreenViewModel;
  errors: string[];
  lastEvent: string;
}

export function useLocalPlayerClient(playerId: string, enabled = true): LocalPlayerClientState & {
  submitAction: (submission: ActionSubmission) => void;
  submitVote: (submission: VoteSubmission) => void;
  submitPlea: (plea: string) => void;
  submitBranchVote: (submission: BranchVoteSubmission) => void;
  requestSnapshot: () => void;
} {
  const transportRef = useRef<LocalSyncTransport | undefined>(undefined);
  const lastHostSeenRef = useRef(0);
  const [state, setState] = useState<LocalPlayerClientState>({
    status: 'connecting',
    errors: [],
    lastEvent: 'connecting to local host',
  });

  useEffect(() => {
    if (!enabled) {
      setState({
        status: 'waiting',
        errors: [],
        lastEvent: 'local player sync disabled',
      });
      return undefined;
    }

    const transport = createDefaultLocalSyncTransport({ role: 'player', playerId });
    transportRef.current = transport;

    if (!transport.available) {
      setState((current) => ({
        ...current,
        status: 'unavailable',
        lastEvent: 'BroadcastChannel unavailable',
      }));
      return () => transport.close();
    }

    const unsubscribe = transport.subscribe((message) => {
      handleHostMessage(message, playerId, lastHostSeenRef, setState);
    });
    postPlayerMessage(transport, createLocalSyncMessage('player_hello', 'player', { playerId }));
    postPlayerMessage(transport, createLocalSyncMessage('request_snapshot', 'player', { playerId }));

    const intervalId = window.setInterval(() => {
      postPlayerMessage(transport, createLocalSyncMessage('request_snapshot', 'player', { playerId }));
      const lastSeen = lastHostSeenRef.current;
      if (lastSeen > 0 && Date.now() - lastSeen > 4500) {
        setState((current) => ({
          ...current,
          status: 'waiting',
          lastEvent: 'waiting for host tab',
        }));
      }
      if (lastSeen === 0) {
        setState((current) => current.status === 'connecting'
          ? { ...current, status: 'waiting', lastEvent: 'waiting for host tab' }
          : current);
      }
    }, 1800);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
      transport.close();
      if (transportRef.current === transport) {
        transportRef.current = undefined;
      }
    };
  }, [enabled, playerId]);

  const post = (message: LocalSyncMessage) => {
    const transport = transportRef.current;
    if (!transport || transport.closed || !transport.available) {
      setState((current) => ({
        ...current,
        status: transport?.available === false ? 'unavailable' : 'waiting',
        errors: [...current.errors.slice(-3), 'ホスト画面に接続できません。'],
        lastEvent: 'send failed',
      }));
      return;
    }
    postPlayerMessage(transport, message);
  };

  return {
    ...state,
    submitAction: (submission) => post(createLocalSyncMessage('submit_action', 'player', submission)),
    submitVote: (submission) => post(createLocalSyncMessage('submit_vote', 'player', submission)),
    submitPlea: (plea) => post(createLocalSyncMessage('submit_plea', 'player', { playerId, plea })),
    submitBranchVote: (submission) => post(createLocalSyncMessage('submit_branch_vote', 'player', submission)),
    requestSnapshot: () => post(createLocalSyncMessage('request_snapshot', 'player', { playerId })),
  };
}

function handleHostMessage(
  message: LocalSyncMessage,
  playerId: string,
  lastHostSeenRef: { current: number },
  setState: (updater: (state: LocalPlayerClientState) => LocalPlayerClientState) => void,
): void {
  if (message.sender !== 'host') return;
  if (message.type === 'host_hello') {
    lastHostSeenRef.current = Date.now();
    setState((current) => ({
      ...current,
      status: 'connected',
      sessionId: message.payload.sessionId,
      lastEvent: `host r${message.payload.round} ${message.payload.phase}`,
    }));
    return;
  }
  if (message.type === 'state_snapshot') {
    lastHostSeenRef.current = Date.now();
    setState((current) => ({
      ...current,
      status: 'connected',
      sessionId: message.payload.sessionId,
      hostView: message.payload.hostView,
      lastEvent: 'host snapshot received',
    }));
    return;
  }
  if (message.type === 'player_view' && message.payload.playerId === playerId) {
    lastHostSeenRef.current = Date.now();
    setState((current) => ({
      ...current,
      status: 'connected',
      sessionId: message.payload.sessionId,
      playerView: message.payload.playerView,
      lastEvent: 'player view updated',
    }));
    return;
  }
  if (message.type === 'session_reset') {
    lastHostSeenRef.current = Date.now();
    setState((current) => ({
      ...current,
      status: 'connected',
      sessionId: message.payload.sessionId,
      errors: [],
      lastEvent: `session reset: ${message.payload.reason}`,
    }));
    return;
  }
  if (message.type === 'error' && (!message.payload.targetPlayerId || message.payload.targetPlayerId === playerId)) {
    lastHostSeenRef.current = Date.now();
    setState((current) => ({
      ...current,
      status: 'connected',
      sessionId: message.payload.sessionId ?? current.sessionId,
      errors: [...current.errors.slice(-3), message.payload.message],
      lastEvent: 'host returned an error',
    }));
  }
}

function postPlayerMessage(transport: LocalSyncTransport, message: LocalSyncMessage): void {
  transport.post(message);
}
