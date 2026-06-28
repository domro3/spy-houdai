import { useState, type ReactNode } from 'react';
import {
  Cable,
  RefreshCcw,
  ScanSearch,
  Shield,
  Swords,
  Vote,
  Wrench,
  Zap,
} from 'lucide-react';
import type { ActionSubmission, ActionType, BranchPlan, BranchVoteSubmission, VoteSubmission } from '../core/types';
import type { LocalPlayerClientState } from '../local_sync/player_client';
import type { PlayerScreenViewModel } from './screen_view_models';

const ACTION_ICONS: Record<ActionType, ReactNode> = {
  normal_attack: <Swords size={16} />,
  charge_attack: <Zap size={16} />,
  defend: <Shield size={16} />,
  repair: <Wrench size={16} />,
  scan: <ScanSearch size={16} />,
  fake_attack: <Swords size={16} />,
  boss_heal: <Wrench size={16} />,
  sabotage: <Cable size={16} />,
  scramble_log: <Cable size={16} />,
};

export function SyncedPlayerScreen({
  playerId,
  client,
}: {
  playerId: string;
  client: LocalPlayerClientState & {
    submitAction: (submission: ActionSubmission) => void;
    submitVote: (submission: VoteSubmission) => void;
    submitPlea: (plea: string) => void;
    submitBranchVote: (submission: BranchVoteSubmission) => void;
    requestSnapshot: () => void;
  };
}) {
  const view = client.playerView;
  return (
    <section className="player-screen action-panel synced-player-screen" aria-label="同期プレイヤー画面">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">同期プレイヤー画面</span>
          <h2>{view?.phaseInstruction ?? 'ホスト画面を待っています'}</h2>
        </div>
        <button type="button" className="icon-button" onClick={client.requestSnapshot}>
          <RefreshCcw size={18} />
          再接続
        </button>
      </div>

      <SyncClientStatus client={client} playerId={playerId} />

      {!view ? (
        <WaitingForHost playerId={playerId} client={client} />
      ) : (
        <>
          <SyncedIdentityPanel view={view} />
          <PlayerStepBanner view={view} />
          {view.phase === 'finished' ? (
            <SyncedFinishedPanel view={view} />
          ) : (
            <SyncedControls view={view} client={client} />
          )}
        </>
      )}
    </section>
  );
}

function SyncClientStatus({
  client,
  playerId,
}: {
  client: LocalPlayerClientState;
  playerId: string;
}) {
  const label = client.status === 'connected'
    ? '接続中'
    : client.status === 'waiting'
      ? 'ホスト待ち'
      : client.status === 'unavailable'
        ? '未対応'
        : '接続準備中';
  return (
    <section className={`sync-status-panel ${client.status === 'connected' ? '' : 'waiting'}`}>
      <strong>Local Sync</strong>
      <span>{label}</span>
      <span>Player {playerId}</span>
      <span>{client.sessionId ? `Session ${client.sessionId.slice(0, 8)}` : 'No session'}</span>
      <span>{client.lastEvent}</span>
    </section>
  );
}

function WaitingForHost({
  playerId,
  client,
}: {
  playerId: string;
  client: { requestSnapshot: () => void; errors: string[] };
}) {
  return (
    <div className="manual-card">
      <h3>{playerId} はホスト画面を待っています</h3>
      <p className="muted">同じブラウザで /board を開くと、この画面にプレイヤー表示が届きます。</p>
      <button type="button" className="icon-button primary" onClick={client.requestSnapshot}>
        <RefreshCcw size={18} />
        ホストを探す
      </button>
      <SyncErrors errors={client.errors} />
    </div>
  );
}

function SyncedIdentityPanel({ view }: { view: PlayerScreenViewModel }) {
  return (
    <section className="player-identity-panel">
      <div className="player-topline">
        <div>
          <span className="section-kicker">{view.id}</span>
          <h3>{view.name}</h3>
        </div>
        <span>{view.control}</span>
      </div>
      <dl>
        <div>
          <dt>あなたの役職</dt>
          <dd>{view.role}</dd>
        </div>
        <div>
          <dt>状態</dt>
          <dd>{view.status}</dd>
        </div>
        <div>
          <dt>選択済み</dt>
          <dd>{view.selectedActionLabel}</dd>
        </div>
        <div>
          <dt>前ラウンド</dt>
          <dd>{view.recentActionLabel}</dd>
        </div>
        <div>
          <dt>個別反応</dt>
          <dd>{view.wasSabotaged ? '妨害を受けました' : '通常'}</dd>
        </div>
      </dl>
    </section>
  );
}

function PlayerStepBanner({ view }: { view: PlayerScreenViewModel }) {
  const submitted = playerPhaseSubmitted(view);
  const tone = view.phase === 'finished' ? 'finished' : submitted ? 'submitted' : 'active';
  return (
    <section className={`player-step-banner ${tone}`}>
      <div>
        <span>{playerStepKicker(view)}</span>
        <strong>{submitted ? '送信済み' : playerStepTitle(view)}</strong>
      </div>
      <em>{submitted ? 'Boardの自動進行を待っています。' : playerStepBody(view)}</em>
    </section>
  );
}

function playerPhaseSubmitted(view: PlayerScreenViewModel): boolean {
  if (view.phase === 'action') return Boolean(view.selectedActionType);
  if (view.phase === 'plea') return Boolean(view.selectedPlea);
  if (view.phase === 'vote') return Boolean(view.selectedVoteTargetId);
  if (view.phase === 'branch') return Boolean(view.selectedBranchPlan);
  return view.phase === 'finished';
}

function playerStepKicker(view: PlayerScreenViewModel): string {
  if (view.phase === 'finished') return '結果確認';
  if (view.phase === 'action') return 'あなたの行動';
  if (view.phase === 'vote') return view.mode === 'party' ? 'スパイ予想' : '疑惑投票';
  if (view.phase === 'plea') return '弁明カード';
  if (view.phase === 'branch') return '作戦投票';
  return '次の操作';
}

function playerStepTitle(view: PlayerScreenViewModel): string {
  if (view.phase === 'finished') return '結果を確認してください';
  if (view.phase === 'action') return '行動を1つ選んでください';
  if (view.phase === 'vote') return '投票先を1人選んでください';
  if (view.phase === 'plea') return '弁明カードを選んでください';
  if (view.phase === 'branch') return '作戦を選んでください';
  return '操作してください';
}

function playerStepBody(view: PlayerScreenViewModel): string {
  if (view.phase === 'action' && view.mode === 'party') return '迷ったら「撃つ」。危ない予告なら「守る」、拠点が減ったら「直す」。';
  if (view.phase === 'vote' && view.mode === 'party') return '勝敗後のおまけ投票です。怪しい砲台を選んでください。';
  return '選ぶとすぐBoardへ送信されます。';
}

function SyncedControls({
  view,
  client,
}: {
  view: PlayerScreenViewModel;
  client: {
    submitAction: (submission: ActionSubmission) => void;
    submitVote: (submission: VoteSubmission) => void;
    submitPlea: (plea: string) => void;
    submitBranchVote: (submission: BranchVoteSubmission) => void;
    errors: string[];
  };
}) {
  return (
    <div className="manual-stack">
      {view.phase === 'vote' && view.inferenceHints.length > 0 && <SyncedInferenceHints view={view} />}
      {view.phase === 'action' && <SyncedActionControls view={view} onSubmit={client.submitAction} />}
      {view.phase === 'plea' && <SyncedPleaControls view={view} onSubmit={client.submitPlea} />}
      {view.phase === 'vote' && <SyncedVoteControls view={view} onSubmit={client.submitVote} />}
      {view.phase === 'branch' && <SyncedBranchControls view={view} onSubmit={client.submitBranchVote} />}
      <PrivateLogList logs={view.privateLogs.slice(-4)} />
      <SyncErrors errors={client.errors} />
      <p className="muted">この画面はローカル同期プロトタイプです。入力は /board のGameCoreへ送信されます。</p>
    </div>
  );
}

function SyncedActionControls({
  view,
  onSubmit,
}: {
  view: PlayerScreenViewModel;
  onSubmit: (submission: ActionSubmission) => void;
}) {
  const [targetId, setTargetId] = useState(view.targetOptions[0]?.id);
  const basicActions = view.mode === 'party' && view.availableActions.some((action) => action.type === 'sabotage')
    ? view.availableActions.filter((action) => ['normal_attack', 'defend', 'repair'].includes(action.type))
    : [];
  const specialActions = view.mode === 'party' && view.availableActions.some((action) => action.type === 'sabotage')
    ? view.availableActions.filter((action) => ['fake_attack', 'sabotage', 'boss_heal'].includes(action.type))
    : [];
  const grouped = basicActions.length > 0 || specialActions.length > 0;
  const actionButton = (action: PlayerScreenViewModel['availableActions'][number], quiet = false) => (
    <button
      type="button"
      key={action.type}
      className={[
        view.selectedActionType === action.type ? 'choice selected' : 'choice',
        `action-${action.type}`,
        quiet ? 'quiet' : '',
      ].filter(Boolean).join(' ')}
      aria-pressed={view.selectedActionType === action.type}
      title={action.help}
      onClick={() => onSubmit({
        playerId: view.id,
        type: action.type,
        targetId: action.requiresTarget ? targetId : undefined,
      })}
    >
      {ACTION_ICONS[action.type]}
      <span>
        <strong>{action.label}</strong>
        <small>{action.help}</small>
      </span>
    </button>
  );

  return (
    <div className="manual-card">
      <ControlTitle view={view} title="行動選択" />
      <SelectionStatus label="選択済み" value={view.selectedActionLabel} />
      {view.selectedActionTargetName && <SelectionStatus label="対象" value={view.selectedActionTargetName} />}
      {grouped ? (
        <div className="spy-action-stack">
          <div>
            <span className="action-group-label">基本行動</span>
            <div className="choice-grid">{basicActions.map((action) => actionButton(action))}</div>
          </div>
          <div>
            <span className="action-group-label">スパイ用行動</span>
            <div className="choice-grid spy-special">{specialActions.map((action) => actionButton(action, true))}</div>
          </div>
        </div>
      ) : (
        <div className="choice-grid">{view.availableActions.map((action) => actionButton(action))}</div>
      )}
      {view.availableActions.some((action) => action.requiresTarget) && (
        <TargetSelect value={targetId} options={view.targetOptions} onChange={setTargetId} />
      )}
    </div>
  );
}

function SyncedPleaControls({ view, onSubmit }: { view: PlayerScreenViewModel; onSubmit: (plea: string) => void }) {
  return (
    <div className="manual-card">
      <ControlTitle view={view} title="弁明カード" />
      <SelectionStatus label="選択済み" value={view.selectedPlea ?? '未選択'} />
      <select value={view.selectedPlea ?? ''} onChange={(event) => onSubmit(event.target.value)}>
        <option value="" disabled>弁明カードを選択</option>
        {view.pleaOptions.map((card) => <option key={card} value={card}>{card}</option>)}
      </select>
    </div>
  );
}

function SyncedVoteControls({ view, onSubmit }: { view: PlayerScreenViewModel; onSubmit: (vote: VoteSubmission) => void }) {
  return (
    <div className="manual-card">
      <ControlTitle view={view} title={view.mode === 'party' ? 'スパイ予想' : '疑惑投票'} />
      <SelectionStatus label="投票先" value={view.selectedVoteTargetName ?? '未選択'} />
      <div className="choice-grid">
        {view.voteOptions.map((candidate) => (
          <button
            type="button"
            key={candidate.id}
            className={view.selectedVoteTargetId === candidate.id ? 'choice selected' : 'choice'}
            onClick={() => onSubmit({ voterId: view.id, targetId: candidate.id })}
          >
            <Vote size={16} />
            <span>{candidate.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SyncedBranchControls({
  view,
  onSubmit,
}: {
  view: PlayerScreenViewModel;
  onSubmit: (submission: BranchVoteSubmission) => void;
}) {
  return (
    <div className="manual-card">
      <ControlTitle view={view} title="作戦投票" />
      <SelectionStatus
        label="選択済み"
        value={view.branchOptions.find((option) => option.plan === view.selectedBranchPlan)?.label ?? '未選択'}
      />
      <div className="choice-grid">
        {view.branchOptions.map((option) => (
          <button
            type="button"
            key={option.plan}
            className={view.selectedBranchPlan === option.plan ? 'choice selected' : 'choice'}
            title={option.help}
            onClick={() => onSubmit({ voterId: view.id, plan: option.plan as BranchPlan })}
          >
            <Shield size={16} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SyncedInferenceHints({ view }: { view: PlayerScreenViewModel }) {
  return (
    <div className="hint-panel">
      <h3>最終推理ヒント</h3>
      <div className="hint-list">
        {view.inferenceHints.map((hint) => (
          <div key={hint.playerId}>
            <strong>{hint.playerName}</strong>
            <span>疑惑値 {hint.suspicion} / {hint.suspicionStars}</span>
            <em>{hint.reason}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncedFinishedPanel({ view }: { view: PlayerScreenViewModel }) {
  return (
    <div className="manual-card">
      <ControlTitle view={view} title="結果確認" />
      <SelectionStatus label="勝者" value={view.result?.winner ?? '未確定'} />
      <SelectionStatus label="あなたの投票" value={view.result?.votedTarget ?? '未投票'} />
      <PrivateLogList logs={view.privateLogs.slice(-4)} />
    </div>
  );
}

function ControlTitle({ view, title }: { view: PlayerScreenViewModel; title: string }) {
  return (
    <div className="control-header">
      <div>
        <span className="section-kicker">{view.name}</span>
        <h3>{title} / {view.role}</h3>
      </div>
      <span className="control-state">{view.control}</span>
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
  value,
  options,
  onChange,
}: {
  value?: string;
  options: Array<{ id: string; name: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="target-select">
      対象
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {candidate.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function PrivateLogList({ logs }: { logs: string[] }) {
  if (logs.length === 0) return null;
  return (
    <div className="private-log-peek">
      <span>個別ログ</span>
      <ol>
        {logs.map((log, index) => <li key={`${index}-${log}`}>{log}</li>)}
      </ol>
    </div>
  );
}

function SyncErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="sync-error-list">
      <span>Local Sync Error</span>
      <ol>
        {errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
      </ol>
    </div>
  );
}
