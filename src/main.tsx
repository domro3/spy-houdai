import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Play } from 'lucide-react';
import { GameEngine } from './core/game_engine';
import type { GameMode } from './core/types';
import { fillCpuActions, fillCpuBranchVotes, fillCpuPleas, fillCpuVotes, runCpuGame } from './cpu/autoplay';
import { DebugPanel } from './screens/DebugPanel';
import { HostScreen } from './screens/HostScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import './styles.css';

type LocalScreenView = 'split' | 'host' | 'player';

const INITIAL_LOCAL_ROUTE = readInitialLocalRoute();

function App() {
  const [totalPlayers, setTotalPlayers] = useState(5);
  const [humanPlayers, setHumanPlayers] = useState(1);
  const [seed, setSeed] = useState(20260627);
  const [mode, setMode] = useState<GameMode>('party');
  const [screenView, setScreenView] = useState<LocalScreenView>(INITIAL_LOCAL_ROUTE.view);
  const [activePlayerId, setActivePlayerId] = useState(INITIAL_LOCAL_ROUTE.playerId ?? 'p1');
  const [engine, setEngine] = useState(() => new GameEngine({
    totalPlayers: 5,
    humanPlayers: 1,
    seed: 20260627,
    mode: 'party',
  }));
  const [, forceRender] = useState(0);

  const state = engine.state;
  const safeActivePlayerId = state.players.some((player) => player.id === activePlayerId)
    ? activePlayerId
    : state.players[0]?.id ?? 'p1';

  const rerender = () => forceRender((value) => value + 1);

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
            <select value={screenView} onChange={(event) => setScreenView(event.target.value as LocalScreenView)}>
              <option value="split">Host + Player</option>
              <option value="host">Host only</option>
              <option value="player">Player only</option>
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

      <section className={`screen-shell ${screenView}`}>
        {screenView !== 'player' && <HostScreen engine={engine} />}
        {screenView !== 'host' && (
          <PlayerScreen
            engine={engine}
            activePlayerId={safeActivePlayerId}
            onActivePlayerChange={setActivePlayerId}
            onAutoFillCurrentPhase={autoFillCurrentPhase}
            onResolvePhase={resolvePhase}
            onChange={rerender}
          />
        )}
      </section>

      <DebugPanel engine={engine} />
    </main>
  );
}

function readInitialLocalRoute(): { view: LocalScreenView; playerId?: string } {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/host') return { view: 'host' };
  const playerMatch = path.match(/^\/player\/(p[1-6])$/);
  if (playerMatch) return { view: 'player', playerId: playerMatch[1] };
  return { view: 'split' };
}

createRoot(document.getElementById('root')!).render(<App />);
