import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bot, Play, RefreshCcw } from 'lucide-react';
import {
  BossUnlinkMk01,
  CoreGuardTurret,
  GameBackdrop,
  GameIcon,
  LinkCoreVisual,
} from './components/game/assets/visual/GameVisualAssets';
import { GameEngine } from './core/game_engine';
import type { ActionSubmission, BranchVoteSubmission, GameMode, VoteSubmission } from './core/types';
import { fillCpuActions, fillCpuBranchVotes, fillCpuPleas, fillCpuVotes, runCpuGame } from './cpu/autoplay';
import { useLocalHostSession } from './local_sync/host_session';
import { useLocalPlayerClient, type LocalPlayerClientState } from './local_sync/player_client';
import {
  buildPhoneSyncSearch,
  ensurePhoneSyncRoomInUrl,
  phoneSyncRoomFromSearch,
  playRouteSearchFor,
} from './local_sync/phone_room';
import { DebugPanel } from './screens/DebugPanel';
import { HostScreen } from './screens/HostScreen';
import { INITIAL_ALPHA_SEED, nextAlphaSeed } from './screens/alpha_seed';
import {
  localPathForView,
  parseLocalRoute,
  shouldOpenRouteButtonInNewTab,
  stripRouteBase,
  type LocalScreenView,
  withRouteBase,
} from './screens/local_routes';
import { PlayerScreen } from './screens/PlayerScreen';
import { PublicBoardPreview } from './screens/PublicBoardPreview';
import { PUBLIC_ALPHA_ENTRY } from './screens/public_alpha_content';
import { canResolveCurrentPhase, phaseLabel } from './screens/screen_state';
import { createHostScreenViewModel, createPlayerScreenViewModel } from './screens/screen_view_models';
import { SyncedPlayerScreen } from './screens/SyncedPlayerScreen';
import './styles.css';

const ROUTE_BASE = import.meta.env.BASE_URL;
const INITIAL_LOCAL_ROUTE = parseLocalRoute(stripRouteBase(window.location.pathname, ROUTE_BASE));
const INITIAL_IS_ALPHA = INITIAL_LOCAL_ROUTE.view === 'alpha';

function App() {
  const [totalPlayers, setTotalPlayers] = useState(5);
  const [humanPlayers, setHumanPlayers] = useState(INITIAL_IS_ALPHA ? 1 : 5);
  const [seed, setSeed] = useState(INITIAL_ALPHA_SEED);
  const [mode, setMode] = useState<GameMode>('party');
  const [localRoute, setLocalRoute] = useState(INITIAL_LOCAL_ROUTE);
  const [phoneSyncRoom, setPhoneSyncRoom] = useState(() => phoneSyncRoomFromSearch(window.location.search));
  const [activePlayerId, setActivePlayerId] = useState(INITIAL_LOCAL_ROUTE.playerId ?? 'p1');
  const [alphaStarted, setAlphaStarted] = useState(false);
  const [alphaErrors, setAlphaErrors] = useState<string[]>([]);
  const [engine, setEngine] = useState(() => new GameEngine({
    totalPlayers: 5,
    humanPlayers: INITIAL_IS_ALPHA ? 1 : 5,
    seed: INITIAL_ALPHA_SEED,
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
  const appShellClass = [
    'app-shell',
    `view-${screenView}`,
    screenView === 'alpha' && alphaStarted ? 'view-player' : '',
  ].filter(Boolean).join(' ');

  useEffect(() => {
    const onPopState = () => {
      setLocalRoute(parseLocalRoute(stripRouteBase(window.location.pathname, ROUTE_BASE)));
      setPhoneSyncRoom(phoneSyncRoomFromSearch(window.location.search));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (screenView !== 'board') return;
    const room = ensurePhoneSyncRoomInUrl('/board');
    if (room) setPhoneSyncRoom(room);
  }, [screenView]);

  const rerender = () => forceRender((value) => value + 1);
  const hostSyncEnabled = screenView === 'board';
  const hostSync = useLocalHostSession({
    enabled: hostSyncEnabled,
    engine,
    onStateChanged: rerender,
  });
  const playerSync = useLocalPlayerClient(safeActivePlayerId, screenView === 'player');
  const alphaClient = createAlphaPlayerClient({
    engine,
    playerId: safeActivePlayerId,
    errors: alphaErrors,
    onCommand: runAlphaCommand,
    onSnapshot: () => {
      setAlphaErrors([]);
      rerender();
    },
  });

  function navigateLocal(path: string) {
    const nextRoute = parseLocalRoute(path);
    const search = playRouteSearchFor(path, window.location.search, window.location);
    window.history.pushState(null, '', `${withRouteBase(path, ROUTE_BASE)}${search}`);
    setLocalRoute(nextRoute);
    setPhoneSyncRoom(phoneSyncRoomFromSearch(search));
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
    const nextEngine = new GameEngine({ totalPlayers, humanPlayers, seed, mode });
    setEngine(nextEngine);
    setAlphaErrors([]);
    if (hostSyncEnabled) {
      hostSync.replaceEngine(nextEngine, 'host reset');
      hostSync.broadcastReset('host reset');
    }
  }

  function startSoloAlpha({ advanceSeed = false }: { advanceSeed?: boolean } = {}) {
    const nextSeed = advanceSeed ? nextAlphaSeed(seed) : seed;
    const nextEngine = new GameEngine({
      totalPlayers: 5,
      humanPlayers: 1,
      seed: nextSeed,
      mode: 'party',
    });
    setTotalPlayers(5);
    setHumanPlayers(1);
    setSeed(nextSeed);
    setMode('party');
    setActivePlayerId('p1');
    setEngine(nextEngine);
    setAlphaErrors([]);
    setAlphaStarted(true);
  }

  function runAlphaCommand(command: () => void) {
    try {
      command();
      advanceLocalAlpha(engine);
      setAlphaErrors([]);
      rerender();
    } catch (error) {
      setAlphaErrors((current) => [
        ...current.slice(-3),
        error instanceof Error ? error.message : 'Alpha command failed',
      ]);
      rerender();
    }
  }

  function startCpuOnly() {
    const result = runCpuGame({ totalPlayers, humanPlayers: 0, seed, mode });
    const nextEngine = new GameEngine({ totalPlayers, humanPlayers: 0, seed, mode });
    nextEngine.state = result;
    setEngine(nextEngine);
    if (hostSyncEnabled) {
      hostSync.replaceEngine(nextEngine, 'host CPU run');
    }
  }

  function autoFillCurrentPhase() {
    if (state.phase === 'action') fillCpuActions(engine);
    if (state.phase === 'plea') fillCpuPleas(engine);
    if (state.phase === 'vote') fillCpuVotes(engine);
    if (state.phase === 'branch') fillCpuBranchVotes(engine);
    if (hostSyncEnabled) hostSync.broadcastSnapshot();
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
    if (hostSyncEnabled) hostSync.broadcastSnapshot();
    rerender();
  }

  return (
    <main className={appShellClass}>
      <section className="command-band">
        <div>
          <p className="eyebrow">全員砲台、1人だけスパイ。</p>
          <h1>スパイ砲台</h1>
        </div>
        {screenView === 'alpha' ? (
          <div className="setup-controls readonly-route-note">
            <strong>Public Alpha v0.1</strong>
            <span>スマホ縦画面で、作戦端末からすぐ試せます。</span>
          </div>
        ) : screenView === 'board' ? (
          <div className="setup-controls readonly-route-note">
            <strong>戦況スクリーン</strong>
            <span>全員の作戦が揃うと自動で戦闘を解決します。</span>
          </div>
        ) : screenView === 'player' ? (
          <div className="setup-controls readonly-route-note">
            <strong>作戦端末</strong>
            <span>中央画面を見ながら、自分の行動・投票だけを送信します。</span>
          </div>
        ) : (
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
                <option value="alpha">Public Alpha</option>
                <option value="split">Host + Player</option>
                <option value="board">Board only</option>
                <option value="player">Player only</option>
                <option value="debug">Debug only</option>
              </select>
            </label>
            <button type="button" className="icon-button primary" onClick={resetGame} title="新規ゲーム">
              <Play size={18} />
              開始
            </button>
            {screenView === 'debug' && (
              <>
                <button type="button" className="icon-button" onClick={autoFillCurrentPhase} disabled={state.phase === 'finished'}>
                  <Bot size={18} />
                  CPU入力
                </button>
                <button
                  type="button"
                  className="icon-button primary"
                  onClick={resolvePhase}
                  disabled={!canResolveCurrentPhase(engine)}
                >
                  <RefreshCcw size={18} />
                  解決
                </button>
              </>
            )}
            <button type="button" className="icon-button" onClick={startCpuOnly} title="CPUだけで最後まで実行">
              <Bot size={18} />
              CPU完走
            </button>
          </div>
        )}
      </section>

      {screenView !== 'alpha' && (
        <LocalRouteBar
          players={state.players.map((player) => ({ id: player.id, name: player.name }))}
          activeView={screenView}
          activePlayerId={safeActivePlayerId}
          routeBase={ROUTE_BASE}
          playRouteSearch={phoneSyncRoom ? buildPhoneSyncSearch(phoneSyncRoom) : playRouteSearchFor('/board', window.location.search, window.location)}
          phoneSyncRoom={phoneSyncRoom}
          onNavigate={navigateLocal}
        />
      )}

      {(localRoute.invalidPath || localRoute.invalidPlayerId || (localRoute.view === 'player' && !routePlayerExists)) && (
        <RouteNotice
          invalidPath={localRoute.invalidPath}
          invalidPlayerId={localRoute.invalidPlayerId ?? (localRoute.view === 'player' ? requestedPlayerId : undefined)}
          fallbackPlayerId={safeActivePlayerId}
        />
      )}

      <section className={`screen-shell ${screenView}`}>
        {screenView === 'alpha' && (
          alphaStarted ? (
            <div className="alpha-play-stack">
              <AlphaPlayHeader
                engine={engine}
                onRestart={() => startSoloAlpha({ advanceSeed: true })}
                onBack={() => setAlphaStarted(false)}
                onOpenBoard={() => navigateLocal('/board')}
              />
              <SyncedPlayerScreen
                playerId={safeActivePlayerId}
                client={alphaClient}
                resultActions={engine.state.phase === 'finished' ? (
                  <AlphaResultActions
                    onRestart={() => startSoloAlpha({ advanceSeed: true })}
                    onBack={() => setAlphaStarted(false)}
                    onOpenBoard={() => navigateLocal('/board')}
                  />
                ) : undefined}
              />
            </div>
          ) : (
            <PublicAlphaEntry
              seed={seed}
              onStartSolo={() => startSoloAlpha()}
              onOpenBoard={() => navigateLocal('/board')}
              onOpenPlayer={() => navigateLocal('/player/p1')}
              onOpenDev={() => navigateLocal('/dev')}
            />
          )
        )}
        {screenView === 'split' && <HostScreen engine={engine} />}
        {screenView === 'board' && <BoardOnlyScreen engine={engine} />}
        {screenView === 'debug' && <HostScreen engine={engine} />}
        {screenView === 'split' && (
          <PlayerScreen
            engine={engine}
            activePlayerId={safeActivePlayerId}
            onActivePlayerChange={setPlayerView}
            onAutoFillCurrentPhase={autoFillCurrentPhase}
            onResolvePhase={resolvePhase}
            onChange={rerender}
          />
        )}
        {screenView === 'player' && (
          <SyncedPlayerScreen playerId={safeActivePlayerId} client={playerSync} />
        )}
      </section>

  {(screenView === 'split' || screenView === 'debug') && <DebugPanel engine={engine} />}
    </main>
  );
}

function BoardOnlyScreen({ engine }: { engine: GameEngine }) {
  return (
    <section className="board-preview-route" aria-label="共有Board">
      <PublicBoardPreview hostView={createHostScreenViewModel(engine)} />
    </section>
  );
}

type AlphaPlayerClient = LocalPlayerClientState & {
  submitAction: (submission: ActionSubmission) => void;
  submitVote: (submission: VoteSubmission) => void;
  submitPlea: (plea: string) => void;
  submitBranchVote: (submission: BranchVoteSubmission) => void;
  requestSnapshot: () => void;
};

function createAlphaPlayerClient({
  engine,
  playerId,
  errors,
  onCommand,
  onSnapshot,
}: {
  engine: GameEngine;
  playerId: string;
  errors: string[];
  onCommand: (command: () => void) => void;
  onSnapshot: () => void;
}): AlphaPlayerClient {
  return {
    status: 'connected',
    sessionId: 'solo-alpha',
    hostView: createHostScreenViewModel(engine),
    playerView: createPlayerScreenViewModel(engine, playerId),
    errors,
    lastEvent: 'この端末で進行中',
    submitAction: (submission) => onCommand(() => engine.submitAction(submission)),
    submitVote: (submission) => onCommand(() => engine.submitVote(submission)),
    submitPlea: (plea) => onCommand(() => engine.submitPlea(playerId, plea)),
    submitBranchVote: (submission) => onCommand(() => engine.submitBranchVote(submission)),
    requestSnapshot: onSnapshot,
  };
}

function advanceLocalAlpha(engine: GameEngine): void {
  if (engine.state.phase === 'finished') return;

  if (engine.state.phase === 'action') {
    fillCpuActions(engine);
    if (allActionsReady(engine)) engine.resolveActions();
    return;
  }

  if (engine.state.phase === 'plea') {
    fillCpuPleas(engine);
    if (engine.state.players.every((player) => engine.state.pleas[player.id])) {
      engine.resolvePleas();
    }
    return;
  }

  if (engine.state.phase === 'vote') {
    fillCpuVotes(engine);
    if (engine.state.players.every((player) => engine.state.votes[player.id])) {
      engine.resolveVotes();
    }
    return;
  }

  if (engine.state.phase === 'branch') {
    fillCpuBranchVotes(engine);
    if (engine.state.players.every((player) => engine.state.branchVotes[player.id])) {
      engine.resolveBranch();
    }
  }
}

function allActionsReady(engine: GameEngine): boolean {
  return engine.state.players.every((player) => engine.state.submittedActions[player.id]);
}

function LocalRouteBar({
  players,
  activeView,
  activePlayerId,
  routeBase,
  playRouteSearch,
  phoneSyncRoom,
  onNavigate,
}: {
  players: Array<{ id: string; name: string }>;
  activeView: LocalScreenView;
  activePlayerId: string;
  routeBase: string;
  playRouteSearch: string;
  phoneSyncRoom?: string;
  onNavigate: (path: string) => void;
}) {
  const normalPlayView = activeView === 'board' || activeView === 'player';
  const playLinks = [
    { path: '/board', label: 'Board', active: activeView === 'board' },
    ...players.map((player, index) => ({
      path: `/player/${player.id}`,
      label: `P${index + 1}`,
      active: activeView === 'player' && activePlayerId === player.id,
    })),
  ];
  const routeLinks = normalPlayView ? playLinks : [
    { path: '/', label: 'Alpha', active: activeView === 'alpha' },
    { path: '/dev', label: 'Dev Shell', active: activeView === 'split' },
    ...playLinks,
    { path: '/debug', label: 'Debug', active: activeView === 'debug' },
  ];

  return (
    <nav className={[
      'local-route-bar',
      normalPlayView ? 'play-routes' : '',
      phoneSyncRoom ? 'phone-sync-routes' : '',
    ].filter(Boolean).join(' ')} aria-label="ローカル画面切替">
      <div>
        <strong>{phoneSyncRoom ? `スマホ同期ルーム ${phoneSyncRoom}` : normalPlayView ? '画面リンク' : 'ローカル画面プロトタイプ'}</strong>
        <span>
          {phoneSyncRoom
            ? 'P1-P6のroom付きリンクを各スマホで開きます。'
            : normalPlayView
              ? 'Boardと各プレイヤー端末を別タブで開きます。'
            : 'Board/Player画面では他画面を別タブで開きます。LAN/オンライン通信はまだありません。'}
        </span>
      </div>
      <div className="local-route-links">
        {routeLinks.map((link) => {
          const opensInNewTab = shouldOpenRouteButtonInNewTab(activeView, link.active);
          const externalPath = `${withRouteBase(link.path, routeBase)}${isPlayRoutePath(link.path) ? playRouteSearch : ''}`;
          return (
            <span key={link.path} className={link.active ? 'route-link active' : 'route-link'}>
              <button
                type="button"
                disabled={link.active}
                onClick={() => {
                  if (opensInNewTab) {
                    window.open(externalPath, '_blank', 'noopener,noreferrer');
                    return;
                  }
                  onNavigate(link.path);
                }}
                title={link.active
                  ? `${link.label}を表示中`
                  : opensInNewTab
                    ? `${link.label}を別タブで開く`
                    : `${link.label}へ切替`}
              >
                {link.label}
              </button>
              <a href={externalPath} target="_blank" rel="noreferrer" title={`${link.label}を別タブで開く`}>
                ↗
              </a>
            </span>
          );
        })}
      </div>
    </nav>
  );
}

function isPlayRoutePath(path: string): boolean {
  return path === '/board' || path.startsWith('/player/');
}

function PublicAlphaEntry({
  seed,
  onStartSolo,
  onOpenBoard,
  onOpenPlayer,
  onOpenDev,
}: {
  seed: number;
  onStartSolo: () => void;
  onOpenBoard: () => void;
  onOpenPlayer: () => void;
  onOpenDev: () => void;
}) {
  return (
    <section className="alpha-entry panel-status" aria-label="Public Alpha入口">
      <GameBackdrop variant="operation-terminal" />
      <div className="alpha-entry-copy">
        <span className="section-kicker">{PUBLIC_ALPHA_ENTRY.kicker}</span>
        <h2>
          {PUBLIC_ALPHA_ENTRY.headlineLines[0]}
          <br />
          {PUBLIC_ALPHA_ENTRY.headlineLines[1]}
        </h2>
        <p>{PUBLIC_ALPHA_ENTRY.body}</p>
        <div className="alpha-highlight-strip" aria-label="Alpha版の確認ポイント">
          {PUBLIC_ALPHA_ENTRY.highlights.map((item) => (
            <div key={item.label}>
              <GameIcon name={item.icon} size={24} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className="alpha-cta-row">
          <button type="button" className="icon-button primary alpha-primary-action" onClick={onStartSolo}>
            <GameIcon name="sync" size={32} />
            {PUBLIC_ALPHA_ENTRY.primaryCta}
          </button>
          <button type="button" className="icon-button" onClick={onOpenBoard}>
            <GameIcon name="core" size={32} />
            {PUBLIC_ALPHA_ENTRY.boardCta}
          </button>
        </div>
      </div>

      <div className="alpha-visual" aria-hidden="true">
        <BossUnlinkMk01 state="charge" compact />
        <LinkCoreVisual state="idle" compact />
        <CoreGuardTurret playerId="p1" state="idle" compact />
      </div>

      <div className="alpha-route-panel">
        <div>
          <strong>起動設定</strong>
          <span>Party / 5基 / p1手動 + CPU4基 / Seed {seed}</span>
        </div>
        <div className="alpha-route-actions">
          <button type="button" className="tiny-button" onClick={onOpenPlayer}>{PUBLIC_ALPHA_ENTRY.routeActions[0]}</button>
          <button type="button" className="tiny-button" onClick={onOpenBoard}>{PUBLIC_ALPHA_ENTRY.routeActions[1]}</button>
          <button type="button" className="tiny-button" onClick={onOpenDev}>{PUBLIC_ALPHA_ENTRY.routeActions[2]}</button>
        </div>
      </div>
    </section>
  );
}

function AlphaPlayHeader({
  engine,
  onRestart,
  onBack,
  onOpenBoard,
}: {
  engine: GameEngine;
  onRestart: () => void;
  onBack: () => void;
  onOpenBoard: () => void;
}) {
  return (
    <section className="alpha-play-header">
      <div>
        <span className="section-kicker">Solo Alpha</span>
        <strong>{phaseLabel(engine.state.phase, engine.state.mode)} / ROUND {Math.min(engine.state.round, engine.state.maxRounds)}</strong>
        <em>p1を操作。CPUが残りの砲台を自動同期します。</em>
      </div>
      <div className="alpha-play-actions">
        <button type="button" className="tiny-button" onClick={onBack}>入口</button>
        <button type="button" className="tiny-button" onClick={onOpenBoard}>Board</button>
        <button type="button" className="tiny-button" onClick={onRestart}>新規</button>
      </div>
    </section>
  );
}

function AlphaResultActions({
  onRestart,
  onBack,
  onOpenBoard,
}: {
  onRestart: () => void;
  onBack: () => void;
  onOpenBoard: () => void;
}) {
  return (
    <section className="alpha-result-actions" aria-label="Alpha結果後の操作">
      <div>
        <span className="section-kicker">Public Alpha loop</span>
        <strong>この端末でもう一戦できます</strong>
        <em>結果を確認したら、同じ設定ですぐ次のゲームへ進めます。</em>
      </div>
      <div className="alpha-result-action-row">
        <button type="button" className="icon-button primary alpha-rematch-button" onClick={onRestart}>
          <GameIcon name="sync" size={28} />
          もう一戦
        </button>
        <button type="button" className="tiny-button" onClick={onBack}>入口へ戻る</button>
        <button type="button" className="tiny-button" onClick={onOpenBoard}>Boardで確認</button>
      </div>
    </section>
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
