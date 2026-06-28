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
import { PrototypeAssetImage } from '../assets/PrototypeAssetImage';
import { turretPrototypeAsset } from '../assets/prototype_assets';
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
  const terminalTone = view?.role === 'スパイ' ? 'terminal-spy' : 'terminal-gunner';
  return (
    <section className={`player-screen action-panel synced-player-screen ${terminalTone}`} aria-label="作戦端末">
      <div className="panel-heading">
        <div>
          <span className="section-kicker">作戦端末</span>
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
          <PlayerStepBanner view={view} />
          {view.phase === 'finished' ? (
            <SyncedFinishedPanel view={view} />
          ) : (
            <SyncedControls view={view} client={client} />
          )}
          <SyncedIdentityPanel view={view} />
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
    ? 'リンク中'
    : client.status === 'waiting'
      ? 'Board待ち'
      : client.status === 'unavailable'
        ? '未対応'
        : 'リンク準備中';
  return (
    <section className={`sync-status-panel ${client.status === 'connected' ? '' : 'waiting'}`}>
      <strong>端末リンク</strong>
      <span>{label}</span>
      <span>{playerId.toUpperCase()}</span>
      <span>{client.sessionId ? `同期 ${client.sessionId.slice(0, 8)}` : '同期待ち'}</span>
      <span>{clientEventLabel(client.lastEvent)}</span>
    </section>
  );
}

function clientEventLabel(event: string): string {
  if (event === 'connecting to local host') return 'Board探索中';
  if (event === 'local player sync disabled') return '端末待機';
  if (event === 'BroadcastChannel unavailable') return '同期未対応';
  if (event === 'waiting for host tab') return 'Board待機中';
  if (event === 'send failed') return '送信失敗';
  if (event === 'host snapshot received') return '戦況受信';
  if (event === 'player view updated') return '端末更新';
  if (event === 'host returned an error') return '送信エラー';
  if (event.startsWith('host r')) return 'Boardリンク確認';
  if (event.startsWith('session reset:')) return 'セッション更新';
  return event;
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
  const isSpy = view.role === 'スパイ';
  return (
    <section className={`player-identity-panel ${isSpy ? 'role-spy' : 'role-gunner'}`}>
      <div className="player-topline">
        <div>
          <span className="section-kicker">{view.id}</span>
          <h3>{view.name}</h3>
        </div>
        <span>{view.control}</span>
      </div>
      <div className="private-role-card">
        <span>あなたの役職</span>
        <strong>{isSpy ? 'あなたはスパイです' : 'あなたは砲台員です'}</strong>
        <em>{isSpy ? '裏回線の行動はこの端末だけに表示されます。' : 'チーム砲台としてボスを止めます。'}</em>
      </div>
      <dl className="terminal-status-grid">
        <div>
          <dt>端末状態</dt>
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
        <strong>{submitted ? playerSubmittedTitle(view) : playerStepTitle(view)}</strong>
      </div>
      <div className="player-step-visual" aria-label={`${view.name}の砲台ユニット`}>
        <PrototypeAssetImage
          src={turretPrototypeAsset(view.id)}
          alt="砲台ユニット"
          className="terminal-turret-asset"
          fallback={<span className="terminal-turret-fallback" />}
        />
      </div>
      <em>{submitted ? '他プレイヤーの入力待ち。揃うと自動で戦況が進みます。' : playerStepBody(view)}</em>
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

function playerSubmittedTitle(view: PlayerScreenViewModel): string {
  if (view.phase === 'action') return '作戦送信済み';
  if (view.phase === 'vote') return view.mode === 'party' ? '予想送信済み' : '投票送信済み';
  if (view.phase === 'plea') return '弁明送信済み';
  if (view.phase === 'branch') return '作戦投票済み';
  return '送信済み';
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
  const submitted = playerPhaseSubmitted(view);
  return (
    <div className="manual-stack">
      {view.phase === 'vote' && view.inferenceHints.length > 0 && <SyncedInferenceHints view={view} />}
      {submitted && view.phase !== 'finished' && <SubmittedWaitPanel view={view} />}
      {view.phase === 'action' && <SyncedActionControls view={view} onSubmit={client.submitAction} />}
      {view.phase === 'plea' && <SyncedPleaControls view={view} onSubmit={client.submitPlea} />}
      {view.phase === 'vote' && <SyncedVoteControls view={view} onSubmit={client.submitVote} />}
      {view.phase === 'branch' && <SyncedBranchControls view={view} onSubmit={client.submitBranchVote} />}
      <PrivateLogList logs={view.privateLogs.slice(-4)} />
      <SyncErrors errors={client.errors} />
    </div>
  );
}

function SubmittedWaitPanel({ view }: { view: PlayerScreenViewModel }) {
  return (
    <section className="submitted-wait-panel">
      <span>{playerSubmittedTitle(view)}</span>
      <strong>同期待機中</strong>
      <em>端末を閉じずに戦況スクリーンの解決を待ってください。</em>
    </section>
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
  const submitted = Boolean(view.selectedActionType);
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
      disabled={submitted}
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
  const submitted = Boolean(view.selectedPlea);
  return (
    <div className="manual-card">
      <ControlTitle view={view} title="弁明カード" />
      <SelectionStatus label="選択済み" value={view.selectedPlea ?? '未選択'} />
      <select value={view.selectedPlea ?? ''} disabled={submitted} onChange={(event) => onSubmit(event.target.value)}>
        <option value="" disabled>弁明カードを選択</option>
        {view.pleaOptions.map((card) => <option key={card} value={card}>{card}</option>)}
      </select>
    </div>
  );
}

function SyncedVoteControls({ view, onSubmit }: { view: PlayerScreenViewModel; onSubmit: (vote: VoteSubmission) => void }) {
  const submitted = Boolean(view.selectedVoteTargetId);
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
            disabled={submitted}
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
  const submitted = Boolean(view.selectedBranchPlan);
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
            disabled={submitted}
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
      <span>通信エラー</span>
      <ol>
        {errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
      </ol>
    </div>
  );
}
