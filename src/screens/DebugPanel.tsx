import type { GameEngine } from '../core/game_engine';

export function DebugPanel({ engine }: { engine: GameEngine }) {
  const { debugLogs } = engine.state;
  return (
    <details className="debug-panel">
      <summary>開発者用 debugLog ({debugLogs.length})</summary>
      {debugLogs.length === 0 ? (
        <p className="muted">debugLogはまだありません。</p>
      ) : (
        <ol>
          {debugLogs.slice(-40).map((log, index) => <li key={`${log}-${index}`}>{log}</li>)}
        </ol>
      )}
    </details>
  );
}
