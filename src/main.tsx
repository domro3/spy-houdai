import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Play } from 'lucide-react';
import { GameEngine } from './core/game_engine';
import type { GameMode } from './core/types';
import { fillCpuActions, fillCpuBranchVotes, fillCpuPleas, fillCpuVotes, runCpuGame } from './cpu/autoplay';
import { DebugPanel } from './screens/DebugPanel';
import { HostScreen } from './screens/HostScreen';
import { localPathForView, parseLocalRoute, type LocalScreenView } from './screens/local_routes';
import { PlayerScreen } from './screens/PlayerScreen';
import './styles.css';

const INITIAL_LOCAL_ROUTE = parseLocalRoute(window.location.pathname);

function App() {
  const [totalPlayers, setTotalPlayers] = useState(5);
  const [humanPlayers, setHumanPlayers] = useState(1);
  const [seed, setSeed] = useState(20260627);
  const [mode, setMode] = useState<GameMode>('party');
  const [localRoute, setLocalRoute] = useState(INITIAL_LOCAL_ROUTE);
  const [activePlayerId, setActivePlayerId] = useState(INITIAL_LOCAL_ROUTE.playerId ?? 'p1');
  const [engine, setEngine] = useState(() => new GameEngine({
    totalPlayers: 5,
    humanPlayers: 1,
    seed: 20260627,
    mode: 'party',
  }));
  const [, forceRender] = useState(0);

  const state = engine.state;
  const routedPlayerId = localRoute.view === 'player' ? localRoute.playerId : undefined;
  const requestedPlayerId = routedPlayerId ?? activePlayerId;
  const routePlayerExists = requestedPlayerId
    ? state.players.some((player) => player.id === requestedPlayerId)
    : false;
  const safeActivePlayerId = routePlayerExists
    ? requestedPlayerId
    : state.players[0]?.id ?? 'p1';
  const screenView = localRoute.view;

  useEffect(() => {
    const onPopState = () => setLocalRoute(parseLocalRoute(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const rerender = () => forceRender((value) => value + 1);

  function navigateLocal(path: string) {
    const nextRoute = parseLocalRoute(path);
    window.history.pushState(null, '', path);
    setLocalRoute(nextRoute);
    if (nextRoute.playerId) {
      setActivePlayerId(nextRoute.playerId);
    }
  }

  function setLocalView(view: LocalScreenView) {
    navigateLocal(localPathForView(view, safeActivePlayerId));
  }

  function setPlayerView(playerId: string) {
    setActivePlayerId(playerId);
    if (screenView === 'player') {
      navigateLocal(localPathForView('player', playerId));
    }
  }

  function resetGame() {
    setEngine(new GameEngine({ totalPlayers, humanPlayers, seed, mode }));
  }

  function startCpuOnly() {
    const result = runCpuGame({ totalPlayers, humanPlayers: 0, seed, mode });
    const nextEngine = new GameEngine({ totalPlayers, humanPlayers: 0, seed, mode });
    nextEngine.state = result;
    setEngine(nextEngine);
  }

  function autoFillCurrentPhase() {
    if (state.phase === 'action') fillCpuActions(engine);
    if (state.phase === 'plea') fillCpuPleas(engine);
    if (state.phase === 'vote') fillCpuVotes(engine);
    if (state.phase === 'branch') fillCpuBranchVotes(engine);
    rerender();
  }

  function resolvePhase() {
    if (state.phase === 'action' && state.players.every((player) => state.submittedActions[player.id])) {
      engine.resolveActions();
    } else if (state.phase === 'plea' && state.players.every((player) => state.pleas[player.id])) {
      engine.resolvePleas();
    } else if (state.phase === 'vote' && state.players.every((player) => state.votes[player.id])) {
      engine.resolveVotes();
    } else if (state.phase === 'branch' && state.players.every((player) => state.branchVotes[player.id])) {
      engine.resolveBranch();
    }
    rerender();
  }

  return (
    <main className="app-shell">
      <section className="command-band">
        <div>
          <p className="eyebrow">全員砲台、1人だけスパイ。</p>
          <h1>スパイ砲台</h1>
        </div>
        <div className="setup-controls">
          <label>
            モード
            <select value={mode} onChange={(event) => setMode(event.target.value as GameMode)}>
              <option value="party">Party</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label>
            人数
            <select
              value={totalPlayers}
              onChange={(event) => {
                const nextTotal = Number(event.target.value);
                setTotalPlayers(nextTotal);
                setHumanPlayers((current) => Math.min(current, nextTotal));
                if (Number(activePlayerId.slice(1)) > nextTotal) {
                  setActivePlayerId('p1');
                }
              }}
            >
              <option value={4}>4</option>
              <option value={5}>5</option>
              <option value={6}>6</option>
            </select>
          </label>
          <label>
            手動
            <select value={humanPlayers} onChange={(event) => setHumanPlayers(Number(event.target.value))}>
              {Array.from({ length: totalPlayers + 1 }, (_, index) => (
                <option key={index} value={index}>
                  {index}
                </option>
              ))}
            </select>
          </label>
          <label>
            Seed
            <input value={seed} type="number" onChange={(event) => setSeed(Number(event.target.value))} />
          </label>
          <label>
            画面
            <select value={screenView} onChange={(event) => setLocalView(event.target.value as LocalScreenView)}>
              <option value="split">Host + Player</option>
              <option value="host">Host only</option>
              <option value="player">Player only</option>
              <option value="debug">Debug only</option>
            </select>
          </label>
          <button type="button" className="icon-button primary" onClick={resetGame} title="新規ゲーム">
            <Play size={18} />
            開始
          </button>
          <button type="button" className="icon-button" onClick={startCpuOnly} title="CPUだけで最後まで実行">
            <Bot size={18} />
            CPU完走
          </button>
        </div>
      </section>

      {(localRoute.invalidPath || localRoute.invalidPlayerId || (localRoute.view === 'player' && !routePlayerExists)) && (
        <RouteNotice
          invalidPath={localRoute.invalidPath}
          invalidPlayerId={localRoute.invalidPlayerId ?? (localRoute.view === 'player' ? requestedPlayerId : undefined)}
          fallbackPlayerId={safeActivePlayerId}
        />
      )}

      <section className={`screen-shell ${screenView}`}>
        {(screenView === 'split' || screenView === 'host') && <HostScreen engine={engine} />}
        {(screenView === 'split' || screenView === 'player') && (
          <PlayerScreen
            engine={engine}
            activePlayerId={safeActivePlayerId}
            onActivePlayerChange={setPlayerView}
            onAutoFillCurrentPhase={autoFillCurrentPhase}
            onResolvePhase={resolvePhase}
            onChange={rerender}
          />
        )}
      </section>

      {(screenView === 'split' || screenView === 'debug') && <DebugPanel engine={engine} />}
    </main>
  );
}

function RouteNotice({
  invalidPath,
  invalidPlayerId,
  fallbackPlayerId,
}: {
  invalidPath?: string;
  invalidPlayerId?: string;
  fallbackPlayerId: string;
}) {
  return (
    <section className="route-notice">
      <strong>ローカル表示ルートを確認してください</strong>
      {invalidPath ? (
        <span>{invalidPath} は未定義です。開発シェルを表示しています。</span>
      ) : (
        <span>{invalidPlayerId} は現在のプレイヤーとして使えません。{fallbackPlayerId} を表示しています。</span>
      )}
    </section>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
