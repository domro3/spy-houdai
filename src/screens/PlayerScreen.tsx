import { useState, type ReactNode } from 'react';
import {
  Bot,
  Cable,
  RefreshCcw,
  RotateCcw,
  ScanSearch,
  Shield,
  Swords,
  Trophy,
  Vote,
  Wrench,
  Zap,
} from 'lucide-react';
import { GameEngine, requiresTarget } from '../core/game_engine';
import type { ActionType, Player } from '../core/types';
import { PLEA_CARDS } from '../data/constants';
import {
  actionHelp,
  actionLabel,
  branchHelp,
  branchPlanLabel,
  controlLabel,
  roleLabel,
  suspicionStars,
} from '../view/format';
import {
  branchOptions,
  canResolveCurrentPhase,
  phaseInstruction,
} from './screen_state';
import { createPlayerScreenViewModel } from './screen_view_models';

const ACTION_ICONS: Record<ActionType, ReactNode> = {
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

export function PlayerScreen({
  engine,
  activePlayerId,
  onActivePlayerChange,
  onAutoFillCurrentPhase,
  onResolvePhase,
  onChange,
}: {
  engine: GameEngine;
  activePlayerId: string;
  onActivePlayerChange: (playerId: string) => void;
  onAutoFillCurrentPhase: () => void;
  onResolvePhase: () => void;
  onChange: () => void;
}) {
  const state = engine.state;
  const activePlayer = state.players.find((player) => player.id === activePlayerId) ?? state.players[0];
  const canResolve = canResolveCurrentPhase(engine);

  return (
    <section className="player-screen action-panel" aria-label="プレイヤー画面">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">プレイヤー画面</span>
          <h2>{phaseInstruction(state.phase, state.mode)}</h2>
        </div>
        <div className="button-row">
          <button type="button" className="icon-button" onClick={onAutoFillCurrentPhase} disabled={state.phase === 'finished'}>
            <Bot size={18} />
            CPU入力
          </button>
          <button
            type="button"
            className="icon-button primary"
            onClick={onResolvePhase}
            disabled={!canResolve}
          >
            <RefreshCcw size={18} />
            解決
          </button>
        </div>
      </div>

      <div className="view-switcher">
        <label>
          ローカル表示
          <select value={activePlayer.id} onChange={(event) => onActivePlayerChange(event.target.value)}>
            {state.players.map((player, index) => (
              <option key={player.id} value={player.id}>
                View as Player {index + 1} / {player.name}
              </option>
            ))}
          </select>
        </label>
        <span>/player/{activePlayer.id} 想定</span>
      </div>

      <PlayerIdentityPanel player={activePlayer} engine={engine} onChange={onChange} />

      {state.phase === 'finished' ? (
        <PlayerFinishedPanel player={activePlayer} engine={engine} />
      ) : (
        <div className="manual-stack">
          {state.phase === 'vote' && state.inferenceHints.length > 0 && (
            <InferenceHintsPanel engine={engine} />
          )}
          <PlayerControl key={activePlayer.id} player={activePlayer} engine={engine} onChange={onChange} />
          <p className="muted">
            ここはローカル開発用のプレイヤー表示です。ホスト画面には役職・スパイ専用行動・個別ログを出しません。
          </p>
        </div>
      )}
    </section>
  );
}

function PlayerIdentityPanel({
  player,
  engine,
  onChange,
}: {
  player: Player;
  engine: GameEngine;
  onChange: () => void;
}) {
  const playerView = createPlayerScreenViewModel(engine, player.id);

  return (
    <section className={`player-identity-panel role-${player.role === 'spy' ? 'spy' : 'gunner'}`}>
      <div className="player-topline">
        <div>
          <span className="section-kicker">{player.id}</span>
          <h3>{player.name}</h3>
        </div>
        <span>{controlLabel(player)}</span>
      </div>
      <dl>
        <div>
          <dt>あなたの役職</dt>
          <dd>{playerView.role}</dd>
        </div>
        <div>
          <dt>状態</dt>
          <dd>{player.isConnected ? '手動操縦' : '砲台ロボ制御'}</dd>
        </div>
        <div>
          <dt>選択済み</dt>
          <dd>{playerView.selectedActionLabel}</dd>
        </div>
        <div>
          <dt>直近結果</dt>
          <dd>{playerView.recentActionLabel}</dd>
        </div>
        <div>
          <dt>個別反応</dt>
          <dd>{playerView.wasSabotaged ? '妨害を受けました' : '通常'}</dd>
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
    </section>
  );
}

function PlayerControl({ player, engine, onChange }: { player: Player; engine: GameEngine; onChange: () => void }) {
  const state = engine.state;
  const availableActions = engine.availableActions(player.id);
  const selectedAction = state.submittedActions[player.id];
  const [targetByPlayer, setTargetByPlayer] = useState<Record<string, string>>({});
  const targetId = targetByPlayer[player.id] ?? state.players.find((candidate) => candidate.id !== player.id)?.id;

  if (state.phase === 'action') {
    const partySpyBasicActions = state.mode === 'party' && player.role === 'spy'
      ? availableActions.filter((type) => ['normal_attack', 'defend', 'repair'].includes(type))
      : [];
    const partySpySpecialActions = state.mode === 'party' && player.role === 'spy'
      ? availableActions.filter((type) => ['fake_attack', 'sabotage', 'boss_heal'].includes(type))
      : [];
    const groupedPartySpyActions = partySpyBasicActions.length > 0 || partySpySpecialActions.length > 0;
    const actionButton = (type: ActionType, quiet = false) => (
      <button
        type="button"
        key={type}
        className={[
          selectedAction?.type === type ? 'choice selected' : 'choice',
          `action-${type}`,
          quiet ? 'quiet' : '',
        ].filter(Boolean).join(' ')}
        title={actionHelp(type, state.mode)}
        aria-pressed={selectedAction?.type === type}
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
        <span>
          <strong>{actionLabel(type, state.mode)}</strong>
          <small>{actionHelp(type, state.mode)}</small>
        </span>
      </button>
    );

    return (
      <div className="manual-card">
        <ControlHeader player={player} title="行動選択" engine={engine} />
        <SelectionStatus label="選択済み" value={selectedAction ? actionLabel(selectedAction.type, state.mode) : '未選択'} />
        {selectedAction && requiresTarget(selectedAction.type) && selectedAction.targetId && (
          <SelectionStatus label="対象" value={engine.getPlayer(selectedAction.targetId).name} />
        )}
        {groupedPartySpyActions ? (
          <div className="spy-action-stack">
            <div>
              <span className="action-group-label">基本行動</span>
              <div className="choice-grid">{partySpyBasicActions.map((type) => actionButton(type))}</div>
            </div>
            <div>
              <span className="action-group-label">スパイ用行動</span>
              <div className="choice-grid spy-special">{partySpySpecialActions.map((type) => actionButton(type, true))}</div>
            </div>
          </div>
        ) : (
          <div className="choice-grid">
            {availableActions.map((type) => actionButton(type))}
          </div>
        )}
        {availableActions.some(requiresTarget) && (
          <TargetSelect
            player={player}
            value={targetId}
            engine={engine}
            onChange={(next) => setTargetByPlayer({ ...targetByPlayer, [player.id]: next })}
          />
        )}
        <PrivateLogPeek player={player} engine={engine} />
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
        <PrivateLogPeek player={player} engine={engine} />
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
        <PrivateLogPeek player={player} engine={engine} />
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
        <PrivateLogPeek player={player} engine={engine} />
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

function PrivateLogPeek({ player, engine }: { player: Player; engine: GameEngine }) {
  const logs = engine.state.privateLogs[player.id]?.slice(-4) ?? [];
  if (logs.length === 0) return null;
  return (
    <div className="private-log-peek">
      <span>個別ログ</span>
      <ol>
        {logs.map((log, index) => <li key={`${player.id}-private-${index}-${log}`}>{log}</li>)}
      </ol>
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

function PlayerFinishedPanel({ player, engine }: { player: Player; engine: GameEngine }) {
  const result = engine.state.result;
  if (!result) return null;
  const view = createPlayerScreenViewModel(engine, player.id);
  const votedTarget = engine.state.votes[player.id]?.targetId
    ? engine.getPlayer(engine.state.votes[player.id].targetId).name
    : '未投票';
  const personalAwards = view.result?.awards.filter((award) => award.isMine) ?? [];
  const sharedAwards = view.result?.awards.filter((award) => !award.isMine).slice(0, 4) ?? [];
  return (
    <div className="manual-card terminal-result-card">
      <ControlHeader player={player} title="結果確認" engine={engine} />
      <div className="terminal-result-summary">
        <SelectionStatus label="勝者" value={result.winner === 'gunners' ? '砲台チーム' : 'スパイ'} />
        <SelectionStatus label="あなたの投票" value={votedTarget} />
        <SelectionStatus label="スパイ正体" value={engine.getPlayer(result.spyId).name} />
      </div>
      {personalAwards.length > 0 && (
        <div className="terminal-award-block personal">
          <span>あなたの称号</span>
          {personalAwards.map((award) => (
            <TerminalAward key={`${award.title}-${award.owner}`} award={award} />
          ))}
        </div>
      )}
      {sharedAwards.length > 0 && (
        <div className="terminal-award-block">
          <span>全体ハイライト</span>
          {sharedAwards.map((award) => (
            <TerminalAward key={`${award.title}-${award.owner}`} award={award} />
          ))}
        </div>
      )}
      <PrivateLogPeek player={player} engine={engine} />
    </div>
  );
}

function TerminalAward({
  award,
}: {
  award: NonNullable<ReturnType<typeof createPlayerScreenViewModel>['result']>['awards'][number];
}) {
  return (
    <div className="terminal-award-row">
      <Trophy size={16} />
      <div>
        <strong>{award.title}</strong>
        <small>{award.owner} / {award.reason}</small>
      </div>
    </div>
  );
}
