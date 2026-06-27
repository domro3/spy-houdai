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
import { bossActionLabel, bossForecastLabel, GameEngine, requiresTarget } from './core/game_engine';
import { PLEA_CARDS } from './data/constants';
import { fillCpuActions, fillCpuBranchVotes, fillCpuPleas, fillCpuVotes, runCpuGame } from './cpu/autoplay';
import type { ActionType, BossActionType, BranchPlan, GameMode, Player } from './core/types';
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
  const [mode, setMode] = useState<GameMode>('party');
  const [engine, setEngine] = useState(() => new GameEngine({
    totalPlayers: 5,
    humanPlayers: 1,
    seed: 20260627,
    mode: 'party',
  }));
  const [, forceRender] = useState(0);

  const state = engine.state;
  const humanControlled = state.players.filter((player) => !engine.controlledByCpu(player));
  const canResolveActions = state.phase === 'action' && state.players.every((player) => state.submittedActions[player.id]);
  const canResolvePleas = state.phase === 'plea' && state.players.every((player) => state.pleas[player.id]);
  const canResolveVotes = state.phase === 'vote' && state.players.every((player) => state.votes[player.id]);
  const canResolveBranch = state.phase === 'branch' && state.players.every((player) => state.branchVotes[player.id]);
  const activePhaseReady = phaseReadyCount(engine);

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

      <section className="battlefield">
        <CentralStatusPanel engine={engine} readyCount={activePhaseReady.ready} totalCount={activePhaseReady.total} />

        <div className="action-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">現在の操作</span>
              <h2>{phaseInstruction(state.phase, state.mode)}</h2>
            </div>
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
              {state.phase === 'vote' && state.inferenceHints.length > 0 && (
                <InferenceHintsPanel engine={engine} />
              )}
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
        <RoundLogTimeline engine={engine} />
        <LogPanel title="公開ログ履歴" logs={state.publicLogs.slice(-18)} />
      </section>

      <DebugLogPanel logs={state.debugLogs} />
    </main>
  );
}

function CentralStatusPanel({
  engine,
  readyCount,
  totalCount,
}: {
  engine: GameEngine;
  readyCount: number;
  totalCount: number;
}) {
  const state = engine.state;
  const monitored = state.monitoredPlayerId ? engine.getPlayer(state.monitoredPlayerId) : undefined;
  const bossTarget = state.currentBossAction.targetPlayerId
    ? engine.getPlayer(state.currentBossAction.targetPlayerId)
    : undefined;
  return (
    <section className="central-panel" aria-label="中央状況">
      <div className="central-header">
        <div>
          <span className="section-kicker">中央画面</span>
          <h2>ROUND {Math.min(state.round, state.maxRounds)} / {state.maxRounds}</h2>
        </div>
        <div className="phase-pill">{phaseLabel(state.phase, state.mode)}</div>
      </div>

      <div className="status-grid">
        <BattleGauge label="ボスHP" value={state.bossHp} max={state.bossMaxHp} tone="boss" />
        <BattleGauge label="拠点耐久" value={state.baseHp} max={state.baseMaxHp} tone="base" />
      </div>

      <div className="central-facts">
        <div>
          <span>モード</span>
          <strong>{state.mode === 'party' ? 'Party Mode' : 'Advanced Mode'}</strong>
          <em>{state.boss.name}</em>
        </div>
        <div>
          <span>{state.mode === 'party' ? 'ボス予告' : '監視対象'}</span>
          {state.mode === 'party' ? (
            <>
              <strong>{bossActionLabel(state.currentBossAction.type)}</strong>
              <em>{bossTarget ? `${bossTarget.name}を狙っています` : bossForecastLabel(state.currentBossAction.type)}</em>
            </>
          ) : (
            <>
              <strong>{monitored?.name ?? 'なし'}</strong>
              <em>{monitored ? suspicionStars(monitored.suspicion) : '次回投票で決定'}</em>
            </>
          )}
        </div>
        <div>
          <span>入力状況</span>
          <strong>{readyCount} / {totalCount}</strong>
          <em>{phaseInputLabel(state.phase, state.mode)}</em>
        </div>
      </div>

      {state.mode === 'party' ? <PartyStatusBoard engine={engine} /> : <SuspicionBoard engine={engine} />}
    </section>
  );
}

function PartyStatusBoard({ engine }: { engine: GameEngine }) {
  const state = engine.state;
  const recentRound = state.history.at(-1);
  return (
    <div className="suspicion-board">
      <div className="board-heading">
        <h3>ボス戦メモ</h3>
        <span>短いログとボス予告を優先</span>
      </div>
      <div className="party-status-list">
        <div>
          <span>次の判断</span>
          <strong>{partyBossHint(state.currentBossAction.type)}</strong>
        </div>
        <div>
          <span>直近火力</span>
          <strong>{recentRound ? `${recentRound.totalDamage}ダメージ` : '未計測'}</strong>
        </div>
        <div>
          <span>拠点修理</span>
          <strong>{recentRound?.repairs ? `${recentRound.repairs}回復` : 'なし'}</strong>
        </div>
      </div>
    </div>
  );
}

function SuspicionBoard({ engine }: { engine: GameEngine }) {
  const players = [...engine.state.players].sort((a, b) => b.suspicion - a.suspicion);
  return (
    <div className="suspicion-board">
      <div className="board-heading">
        <h3>疑惑メーター</h3>
        <span>監視・投票・スキャンの目安</span>
      </div>
      <div className="suspicion-list">
        {players.map((player) => (
          <div key={player.id} className={player.status === 'monitored' ? 'suspicion-row monitored' : 'suspicion-row'}>
            <span>{player.name}</span>
            <strong>{suspicionStars(player.suspicion)}</strong>
            <em>{player.suspicion}</em>
          </div>
        ))}
      </div>
    </div>
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
        <ControlHeader player={player} title="行動選択" engine={engine} />
        <SelectionStatus label="選択済み" value={selectedAction ? actionLabel(selectedAction.type, state.mode) : '未選択'} />
        {selectedAction && requiresTarget(selectedAction.type) && selectedAction.targetId && (
          <SelectionStatus label="対象" value={engine.getPlayer(selectedAction.targetId).name} />
        )}
        <div className="choice-grid">
          {availableActions.map((type) => (
            <button
              type="button"
              key={type}
              className={selectedAction?.type === type ? 'choice selected' : 'choice'}
              title={actionHelp(type, state.mode)}
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
              <span>{actionLabel(type, state.mode)}</span>
            </button>
          ))}
        </div>
        {availableActions.some(requiresTarget) && (
          <TargetSelect
            player={player}
            value={targetId}
            engine={engine}
            onChange={(next) => setTargetByPlayer({ ...targetByPlayer, [player.id]: next })}
          />
        )}
      </div>
    );
  }

  if (state.phase === 'plea') {
    return (
      <div className="manual-card">
        <ControlHeader player={player} title="弁明カード" engine={engine} />
        <SelectionStatus label="選択済み" value={state.pleas[player.id] ?? '未選択'} />
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
    const spyCanCoin = state.mode === 'advanced' && player.role === 'spy' && !player.hasUsedCoin;
    return (
      <div className="manual-card">
        <ControlHeader player={player} title={state.mode === 'party' ? 'スパイ予想' : '疑惑投票'} engine={engine} />
        <SelectionStatus
          label="投票先"
          value={state.votes[player.id] ? engine.getPlayer(state.votes[player.id].targetId).name : '未選択'}
        />
        <div className="choice-grid">
          {engine.state.players
            .filter((candidate) => candidate.id !== player.id)
            .map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                className={state.votes[player.id]?.targetId === candidate.id ? 'choice selected' : 'choice'}
                onClick={() => {
                  engine.submitVote({ voterId: player.id, targetId: candidate.id });
                  onChange();
                }}
              >
                <Vote size={16} />
                <span>{candidate.name}</span>
              </button>
            ))}
        </div>
        {state.mode === 'advanced' && (
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
        )}
      </div>
    );
  }

  if (state.phase === 'branch') {
    const plans = branchOptions(engine.state.branchState.condition);
    return (
      <div className="manual-card">
        <ControlHeader player={player} title="作戦投票" engine={engine} />
        <SelectionStatus label="選択済み" value={state.branchVotes[player.id] ? branchPlanLabel(state.branchVotes[player.id].plan) : '未選択'} />
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

function ControlHeader({ player, title, engine }: { player: Player; title: string; engine: GameEngine }) {
  return (
    <div className="control-header">
      <div>
        <span className="section-kicker">{player.name}</span>
        <h3>{title} / {roleLabel(player)}</h3>
      </div>
      <span className="control-state">{engine.controlledByCpu(player) ? '自動' : '手動'}</span>
    </div>
  );
}

function SelectionStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className={value === '未選択' ? 'selection-status empty' : 'selection-status'}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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
          <dd>{engine.state.mode === 'advanced' ? suspicionStars(player.suspicion) : '簡易'}</dd>
        </div>
        <div>
          <dt>状態</dt>
          <dd>{engine.state.mode === 'advanced' && player.status === 'monitored' ? '監視対象' : '通常'}</dd>
        </div>
        <div>
          <dt>行動</dt>
          <dd>{submittedAction ? actionLabel(submittedAction.type, engine.state.mode) : '未選択'}</dd>
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
      {engine.state.mode === 'party' && result.finalVoteTargetId && (
        <p>
          おまけ投票:
          {' '}
          {result.finalVoteTargetId === result.spyId ? '名探偵砲台ボーナス' : 'スパイ潜伏成功'}
        </p>
      )}
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

function InferenceHintsPanel({ engine }: { engine: GameEngine }) {
  return (
    <div className="hint-panel">
      <h3>最終推理ヒント</h3>
      <div className="hint-list">
        {engine.state.inferenceHints.map((hint) => {
          const player = engine.getPlayer(hint.playerId);
          return (
            <div key={hint.playerId}>
              <strong>{player.name}</strong>
              <span>疑惑値 {hint.suspicion} / {suspicionStars(hint.suspicion)}</span>
              <em>{hint.reason}</em>
            </div>
          );
        })}
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

function RoundLogTimeline({ engine }: { engine: GameEngine }) {
  const rounds = engine.state.history.filter((round) => round.publicLogs.length > 0);
  const latestRound = rounds.at(-1);
  return (
    <div className="log-panel round-timeline">
      <h2>ラウンド別公開ログ</h2>
      {!latestRound ? (
        <p className="muted">ラウンド結果はまだありません。</p>
      ) : (
        <div className="round-log-stack">
          <RoundLogCard round={latestRound.round} logs={latestRound.publicLogs} latest />
          {rounds.slice(0, -1).reverse().map((round) => (
            <RoundLogCard key={round.round} round={round.round} logs={round.publicLogs} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoundLogCard({ round, logs, latest = false }: { round: number; logs: string[]; latest?: boolean }) {
  return (
    <article className={latest ? 'round-log-card latest' : 'round-log-card'}>
      <div className="round-log-title">
        <strong>Round {round}</strong>
        {latest && <span>最新</span>}
      </div>
      <ol>
        {logs.map((log, index) => <li key={`${round}-${index}`}>{log}</li>)}
      </ol>
    </article>
  );
}

function DebugLogPanel({ logs }: { logs: string[] }) {
  return (
    <details className="debug-panel">
      <summary>開発者用 debugLog ({logs.length})</summary>
      {logs.length === 0 ? (
        <p className="muted">debugLogはまだありません。</p>
      ) : (
        <ol>
          {logs.slice(-40).map((log, index) => <li key={`${log}-${index}`}>{log}</li>)}
        </ol>
      )}
    </details>
  );
}

function branchOptions(condition?: string): BranchPlan[] {
  if (condition === 'smooth') return ['normal', 'overdrive'];
  if (condition === 'hard') return ['normal', 'emergency'];
  return ['normal'];
}

function partyBossHint(type: BossActionType): string {
  if (type === 'big_charge') return '守る人がいると安心';
  if (type === 'armor_regen') return '集中して撃つチャンス';
  if (type === 'target_lock') return '狙われた砲台は守る';
  return '基本は撃つ';
}

function phaseLabel(phase: string, mode: GameMode): string {
  if (phase === 'action') return '行動選択';
  if (mode === 'party' && phase === 'vote') return 'スパイ予想';
  if (phase === 'plea') return '弁明タイム';
  if (phase === 'vote') return '疑惑投票';
  if (phase === 'branch') return '中間作戦';
  return '結果発表';
}

function phaseInstruction(phase: string, mode: GameMode): string {
  if (phase === 'action') return '行動を選んでください';
  if (mode === 'party' && phase === 'vote') return 'おまけでスパイを予想してください';
  if (phase === 'plea') return '弁明カードを選んでください';
  if (phase === 'vote') return '怪しい砲台に投票してください';
  if (phase === 'branch') return '作戦を投票してください';
  return '結果を確認してください';
}

function phaseInputLabel(phase: string, mode: GameMode): string {
  if (phase === 'action') return '行動入力';
  if (mode === 'party' && phase === 'vote') return '予想入力';
  if (phase === 'plea') return '弁明入力';
  if (phase === 'vote') return '投票入力';
  if (phase === 'branch') return '作戦投票';
  return '完了';
}

function phaseReadyCount(engine: GameEngine): { ready: number; total: number } {
  const state = engine.state;
  const total = state.players.length;
  if (state.phase === 'action') return { ready: Object.keys(state.submittedActions).length, total };
  if (state.phase === 'plea') return { ready: Object.keys(state.pleas).length, total };
  if (state.phase === 'vote') return { ready: Object.keys(state.votes).length, total };
  if (state.phase === 'branch') return { ready: Object.keys(state.branchVotes).length, total };
  return { ready: total, total };
}

createRoot(document.getElementById('root')!).render(<App />);
