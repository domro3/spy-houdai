import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bot,
  Cable,
  Play,
  RefreshCcw,
  RotateCcw,
  ScanSearch,
  Shield,
  Swords,
  Vote,
  Wrench,
  Zap,
} from 'lucide-react';
import { GameEngine, requiresTarget } from './core/game_engine';
import { PLEA_CARDS } from './data/constants';
import { fillCpuActions, fillCpuBranchVotes, fillCpuPleas, fillCpuVotes, runCpuGame } from './cpu/autoplay';
import type { ActionType, BranchPlan, Player } from './core/types';
import {
  actionHelp,
  actionLabel,
  branchHelp,
  branchPlanLabel,
  controlLabel,
  percent,
  roleLabel,
  suspicionStars,
} from './view/format';
import './styles.css';

const ACTION_ICONS: Record<ActionType, React.ReactNode> = {
  normal_attack: <Swords size={16} />,
  charge_attack: <Zap size={16} />,
  defend: <Shield size={16} />,
  repair: <Wrench size={16} />,
  scan: <ScanSearch size={16} />,
  fake_attack: <Swords size={16} />,
  boss_heal: <Wrench size={16} />,
  sabotage: <Cable size={16} />,
  scramble_log: <Bot size={16} />,
};

function App() {
  const [totalPlayers, setTotalPlayers] = useState(5);
  const [humanPlayers, setHumanPlayers] = useState(1);
  const [seed, setSeed] = useState(20260627);
  const [engine, setEngine] = useState(() => new GameEngine({ totalPlayers: 5, humanPlayers: 1, seed: 20260627 }));
  const [, forceRender] = useState(0);

  const state = engine.state;
  const humanControlled = state.players.filter((player) => !engine.controlledByCpu(player));
  const canResolveActions = state.phase === 'action' && state.players.every((player) => state.submittedActions[player.id]);
  const canResolvePleas = state.phase === 'plea' && state.players.every((player) => state.pleas[player.id]);
  const canResolveVotes = state.phase === 'vote' && state.players.every((player) => state.votes[player.id]);
  const canResolveBranch = state.phase === 'branch' && state.players.every((player) => state.branchVotes[player.id]);

  const rerender = () => forceRender((value) => value + 1);

  function resetGame() {
    setEngine(new GameEngine({ totalPlayers, humanPlayers, seed }));
  }

  function startCpuOnly() {
    const result = runCpuGame({ totalPlayers, humanPlayers: 0, seed });
    const nextEngine = new GameEngine({ totalPlayers, humanPlayers: 0, seed });
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
    if (state.phase === 'action' && canResolveActions) engine.resolveActions();
    else if (state.phase === 'plea' && canResolvePleas) engine.resolvePleas();
    else if (state.phase === 'vote' && canResolveVotes) engine.resolveVotes();
    else if (state.phase === 'branch' && canResolveBranch) engine.resolveBranch();
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
            人数
            <select
              value={totalPlayers}
              onChange={(event) => {
                const nextTotal = Number(event.target.value);
                setTotalPlayers(nextTotal);
                setHumanPlayers((current) => Math.min(current, nextTotal));
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

      <section className="status-grid">
        <BattleGauge label="ボスHP" value={state.bossHp} max={state.bossMaxHp} tone="boss" />
        <BattleGauge label="拠点耐久" value={state.baseHp} max={state.baseMaxHp} tone="base" />
        <div className="round-panel">
          <span>ROUND</span>
          <strong>{Math.min(state.round, state.maxRounds)} / {state.maxRounds}</strong>
          <em>{phaseLabel(state.phase)}</em>
        </div>
        <div className="round-panel">
          <span>作戦</span>
          <strong>{branchPlanLabel(state.branchState.plan)}</strong>
          <em>{state.branchState.condition ?? '判定前'}</em>
        </div>
      </section>

      <section className="battlefield">
        <div className="boss-visual" aria-label="ボス">
          <svg viewBox="0 0 320 220" role="img">
            <defs>
              <linearGradient id="boss-shell" x1="0" x2="1">
                <stop offset="0%" stopColor="#6f141d" />
                <stop offset="55%" stopColor="#d1495b" />
                <stop offset="100%" stopColor="#f7b267" />
              </linearGradient>
            </defs>
            <path d="M72 144 L104 70 L160 28 L216 70 L248 144 L202 194 H118 Z" fill="url(#boss-shell)" />
            <circle cx="128" cy="104" r="16" fill="#111827" />
            <circle cx="192" cy="104" r="16" fill="#111827" />
            <path d="M120 152 Q160 176 200 152" fill="none" stroke="#111827" strokeWidth="12" strokeLinecap="round" />
            <path d="M54 160 L12 190 M266 160 L308 190" stroke="#345995" strokeWidth="14" strokeLinecap="round" />
          </svg>
          <div>
            <h2>巨大ボス接近中</h2>
            <p>公開ログと疑惑メーターから、砲台に紛れたスパイを見抜いてください。</p>
          </div>
        </div>

        <div className="action-panel">
          <div className="panel-heading">
            <h2>{phaseLabel(state.phase)}</h2>
            <div className="button-row">
              <button type="button" className="icon-button" onClick={autoFillCurrentPhase} disabled={state.phase === 'finished'}>
                <Bot size={18} />
                CPU入力
              </button>
              <button
                type="button"
                className="icon-button primary"
                onClick={resolvePhase}
                disabled={
                  state.phase === 'finished'
                  || (state.phase === 'action' && !canResolveActions)
                  || (state.phase === 'plea' && !canResolvePleas)
                  || (state.phase === 'vote' && !canResolveVotes)
                  || (state.phase === 'branch' && !canResolveBranch)
                }
              >
                <RefreshCcw size={18} />
                解決
              </button>
            </div>
          </div>
          {state.phase === 'finished' && state.result ? (
            <ResultView engine={engine} />
          ) : (
            <div className="manual-stack">
              {humanControlled.length === 0 ? (
                <p className="muted">手動プレイヤーはいません。CPU入力で進行できます。</p>
              ) : (
                humanControlled.map((player) => (
                  <PlayerControl key={player.id} player={player} engine={engine} onChange={rerender} />
                ))
              )}
              <p className="muted">
                未入力のCPU/砲台ロボは「CPU入力」でまとめて進みます。手動プレイヤーの役職だけ、この操作欄で個別確認できます。
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="players-grid">
        {state.players.map((player) => (
          <PlayerCard key={player.id} player={player} engine={engine} onChange={rerender} />
        ))}
      </section>

      <section className="log-layout">
        <LogPanel title="ラウンドログ" logs={state.roundLogs} />
        <LogPanel title="公開ログ" logs={state.publicLogs.slice(-18)} />
      </section>
    </main>
  );
}

function PlayerControl({ player, engine, onChange }: { player: Player; engine: GameEngine; onChange: () => void }) {
  const state = engine.state;
  const availableActions = engine.availableActions(player.id);
  const selectedAction = state.submittedActions[player.id];
  const [targetByPlayer, setTargetByPlayer] = useState<Record<string, string>>({});
  const targetId = targetByPlayer[player.id] ?? state.players.find((candidate) => candidate.id !== player.id)?.id;

  if (state.phase === 'action') {
    return (
      <div className="manual-card">
        <h3>{player.name} 行動選択 / {roleLabel(player)}</h3>
        <div className="choice-grid">
          {availableActions.map((type) => (
            <button
              type="button"
              key={type}
              className={selectedAction?.type === type ? 'choice selected' : 'choice'}
              title={actionHelp(type)}
              onClick={() => {
                engine.submitAction({
                  playerId: player.id,
                  type,
                  targetId: requiresTarget(type) ? targetId : undefined,
                });
                onChange();
              }}
            >
              {ACTION_ICONS[type]}
              <span>{actionLabel(type)}</span>
            </button>
          ))}
        </div>
        <TargetSelect player={player} value={targetId} engine={engine} onChange={(next) => setTargetByPlayer({ ...targetByPlayer, [player.id]: next })} />
      </div>
    );
  }

  if (state.phase === 'plea') {
    return (
      <div className="manual-card">
        <h3>{player.name} 弁明 / {roleLabel(player)}</h3>
        <select
          value={state.pleas[player.id] ?? ''}
          onChange={(event) => {
            engine.submitPlea(player.id, event.target.value);
            onChange();
          }}
        >
          <option value="" disabled>弁明カードを選択</option>
          {PLEA_CARDS.map((card) => <option key={card} value={card}>{card}</option>)}
        </select>
      </div>
    );
  }

  if (state.phase === 'vote') {
    const spyCanCoin = player.role === 'spy' && !player.hasUsedCoin;
    return (
      <div className="manual-card">
        <h3>{player.name} 投票 / {roleLabel(player)}</h3>
        <TargetSelect
          player={player}
          value={state.votes[player.id]?.targetId ?? targetId}
          engine={engine}
          onChange={(next) => {
            engine.submitVote({ voterId: player.id, targetId: next });
            onChange();
          }}
        />
        <button
          type="button"
          className="icon-button"
          disabled={!spyCanCoin}
          onClick={() => {
            engine.useSuspiciousCoin(player.id);
            onChange();
          }}
        >
          <Vote size={18} />
          怪しいコイン
        </button>
      </div>
    );
  }

  if (state.phase === 'branch') {
    const plans = branchOptions(engine.state.branchState.condition);
    return (
      <div className="manual-card">
        <h3>{player.name} 作戦投票 / {roleLabel(player)}</h3>
        <div className="choice-grid">
          {plans.map((plan) => (
            <button
              type="button"
              key={plan}
              className={state.branchVotes[player.id]?.plan === plan ? 'choice selected' : 'choice'}
              title={branchHelp(plan)}
              onClick={() => {
                engine.submitBranchVote({ voterId: player.id, plan });
                onChange();
              }}
            >
              <Shield size={16} />
              <span>{branchPlanLabel(plan)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function TargetSelect({
  player,
  value,
  engine,
  onChange,
}: {
  player: Player;
  value?: string;
  engine: GameEngine;
  onChange: (value: string) => void;
}) {
  return (
    <label className="target-select">
      対象
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {engine.state.players
          .filter((candidate) => candidate.id !== player.id)
          .map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function PlayerCard({ player, engine, onChange }: { player: Player; engine: GameEngine; onChange: () => void }) {
  const submittedAction = engine.state.submittedActions[player.id];
  return (
    <article className="player-card">
      <div className="player-topline">
        <h3>{player.name}</h3>
        <span>{controlLabel(player)}</span>
      </div>
      <div className="turret-avatar">
        <span />
      </div>
      <dl>
        <div>
          <dt>役職</dt>
          <dd>{engine.state.phase === 'finished' ? roleLabel(player) : '非公開'}</dd>
        </div>
        <div>
          <dt>疑惑</dt>
          <dd>{suspicionStars(player.suspicion)}</dd>
        </div>
        <div>
          <dt>状態</dt>
          <dd>{player.status === 'monitored' ? '監視対象' : '通常'}</dd>
        </div>
        <div>
          <dt>行動</dt>
          <dd>{submittedAction ? actionLabel(submittedAction.type) : '未選択'}</dd>
        </div>
      </dl>
      <div className="card-actions">
        <button
          type="button"
          className="tiny-button"
          onClick={() => {
            if (player.isConnected) engine.disconnectPlayer(player.id);
            else engine.reconnectPlayer(player.id);
            onChange();
          }}
        >
          <RotateCcw size={14} />
          {player.isConnected ? '脱出' : '帰還'}
        </button>
      </div>
    </article>
  );
}

function BattleGauge({ label, value, max, tone }: { label: string; value: number; max: number; tone: 'boss' | 'base' }) {
  return (
    <div className="gauge-panel">
      <div>
        <span>{label}</span>
        <strong>{value} / {max}</strong>
      </div>
      <div className="gauge-track">
        <span className={tone} style={{ width: percent(value, max) }} />
      </div>
    </div>
  );
}

function ResultView({ engine }: { engine: GameEngine }) {
  const result = engine.state.result;
  if (!result) return null;
  const spy = engine.getPlayer(result.spyId);
  return (
    <div className="result-view">
      <h3>{result.winner === 'gunners' ? '砲台チーム勝利' : 'スパイ勝利'}</h3>
      <p>{result.bossDefeated ? 'ボス撃破成功' : 'ボス撃破失敗'} / 拠点耐久 {engine.state.baseHp}</p>
      <p>スパイ正体: {spy.name}</p>
      {result.spyBehindWin && <p>スパイ裏勝利: 最終投票でスパイを当てられませんでした。</p>}
      <div className="award-list">
        {result.awards.map((award) => (
          <div key={`${award.title}-${award.playerId}`}>
            <strong>{award.title}</strong>
            <span>{engine.getPlayer(award.playerId).name} - {award.reason}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogPanel({ title, logs }: { title: string; logs: string[] }) {
  return (
    <div className="log-panel">
      <h2>{title}</h2>
      {logs.length === 0 ? (
        <p className="muted">まだログはありません。</p>
      ) : (
        <ol>
          {logs.map((log, index) => <li key={`${log}-${index}`}>{log}</li>)}
        </ol>
      )}
    </div>
  );
}

function branchOptions(condition?: string): BranchPlan[] {
  if (condition === 'smooth') return ['normal', 'overdrive'];
  if (condition === 'hard') return ['normal', 'emergency'];
  return ['normal'];
}

function phaseLabel(phase: string): string {
  if (phase === 'action') return '行動選択';
  if (phase === 'plea') return '弁明タイム';
  if (phase === 'vote') return '疑惑投票';
  if (phase === 'branch') return '中間作戦';
  return '結果発表';
}

createRoot(document.getElementById('root')!).render(<App />);
