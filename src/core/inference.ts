import type { EvidenceEvent, GameState, InferenceHint } from './types';

export function createInferenceHints(state: GameState, limit = 3): InferenceHint[] {
  return [...state.players]
    .map((player) => {
      const evidence = evidenceForPlayer(state, player.id);
      return {
        playerId: player.id,
        suspicion: player.suspicion,
        score: evidenceScoreForPlayer(state, player.id),
        reason: buildReason(player.suspicion, evidence),
      };
    })
    .sort((a, b) => b.score - a.score || b.suspicion - a.suspicion)
    .slice(0, limit);
}

export function evidenceScoreForPlayer(state: GameState, playerId: string): number {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) return 0;
  const evidenceScore = evidenceForPlayer(state, playerId).reduce((sum, event) => sum + event.weight, 0);
  return player.suspicion * 1.8 + evidenceScore;
}

export function evidenceForPlayer(state: GameState, playerId: string): EvidenceEvent[] {
  return state.history
    .flatMap((round) => round.evidence)
    .filter((event) => event.playerId === playerId)
    .sort((a, b) => b.round - a.round || Math.abs(b.weight) - Math.abs(a.weight));
}

function buildReason(suspicion: number, evidence: EvidenceEvent[]): string {
  const strong = evidence.find((event) => event.weight >= 3);
  if (strong) return strong.reason;
  const weak = evidence.find((event) => event.weight > 0);
  if (weak) return weak.reason;
  const clear = evidence.find((event) => event.weight < 0);
  if (clear && suspicion <= 2) return clear.reason;
  if (suspicion >= 7) return '疑惑メーターが高く、複数ラウンドで投票を集めています';
  if (suspicion >= 4) return '疑惑メーターが中程度まで上昇しています';
  return '決定的な異常は少なく、疑惑メーター中心の候補です';
}
