import type { ActionSubmission, BranchVoteSubmission, GameMode, VoteSubmission } from '../core/types';
import type { HostScreenViewModel, PlayerScreenViewModel } from '../screens/screen_view_models';

export const LOCAL_SYNC_PROTOCOL = 'spy-houdai-local-sync';
export const LOCAL_SYNC_VERSION = 1;
export const LOCAL_SYNC_CHANNEL = 'spy-houdai-local-session';

export type LocalSyncSender = 'host' | 'player' | 'debug';

export interface LocalSyncEnvelope<TType extends string, TPayload = undefined> {
  protocol: typeof LOCAL_SYNC_PROTOCOL;
  version: typeof LOCAL_SYNC_VERSION;
  messageId: string;
  type: TType;
  sender: LocalSyncSender;
  sentAt: number;
  payload: TPayload;
}

export type PlayerToHostMessage =
  | LocalSyncEnvelope<'player_hello', { playerId: string }>
  | LocalSyncEnvelope<'request_snapshot', { playerId?: string }>
  | LocalSyncEnvelope<'submit_action', ActionSubmission>
  | LocalSyncEnvelope<'submit_vote', VoteSubmission>
  | LocalSyncEnvelope<'submit_plea', { playerId: string; plea: string }>
  | LocalSyncEnvelope<'submit_branch_vote', BranchVoteSubmission>;

export type HostToPlayerMessage =
  | LocalSyncEnvelope<'host_hello', { sessionId: string; mode: GameMode; round: number; phase: string }>
  | LocalSyncEnvelope<'state_snapshot', { sessionId: string; hostView: HostScreenViewModel }>
  | LocalSyncEnvelope<'player_view', { sessionId: string; playerId: string; playerView: PlayerScreenViewModel }>
  | LocalSyncEnvelope<'error', { sessionId?: string; targetPlayerId?: string; message: string }>
  | LocalSyncEnvelope<'session_reset', { sessionId: string; reason: string }>
  | LocalSyncEnvelope<'debug_event', { sessionId?: string; message: string }>;

export type LocalSyncMessage = PlayerToHostMessage | HostToPlayerMessage;

export function createLocalSyncMessage<TType extends LocalSyncMessage['type']>(
  type: TType,
  sender: LocalSyncSender,
  payload: Extract<LocalSyncMessage, { type: TType }>['payload'],
): Extract<LocalSyncMessage, { type: TType }> {
  return {
    protocol: LOCAL_SYNC_PROTOCOL,
    version: LOCAL_SYNC_VERSION,
    messageId: createMessageId(),
    type,
    sender,
    sentAt: Date.now(),
    payload,
  } as Extract<LocalSyncMessage, { type: TType }>;
}

export function isLocalSyncMessage(value: unknown): value is LocalSyncMessage {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LocalSyncMessage>;
  return candidate.protocol === LOCAL_SYNC_PROTOCOL
    && candidate.version === LOCAL_SYNC_VERSION
    && typeof candidate.messageId === 'string'
    && typeof candidate.type === 'string'
    && typeof candidate.sender === 'string'
    && typeof candidate.sentAt === 'number'
    && 'payload' in candidate;
}

function createMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
