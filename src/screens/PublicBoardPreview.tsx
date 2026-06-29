import type { HostBoardView, HostPlayerView, HostScreenViewModel, HostVoteView } from './screen_view_models';
import { percent } from '../view/format';

export function PublicBoardPreview({ hostView }: { hostView: HostScreenViewModel }) {
  return (
    <section className="player-board-preview" aria-label="中央画面">
      <div className="player-board-header">
        <div>
          <span className="section-kicker">中央画面</span>
          <h3>{hostView.board.flowTitle}</h3>
        </div>
        <span className={`player-board-phase phase-${hostView.board.phase}`}>{hostView.board.phaseLabel}</span>
      </div>

      <BoardVitals board={hostView.board} />
      <BoardSituation board={hostView.board} />
      {hostView.board.baseWarning && (
        <div className={`player-board-warning ${hostView.board.baseWarning.level}`}>
          <strong>{hostView.board.baseWarning.title}</strong>
          <span>{hostView.board.baseWarning.body}</span>
        </div>
      )}
      <BoardEventSummary board={hostView.board} />
      <BoardPlayerSync players={hostView.players} />
      <BoardVoteSummary votes={hostView.latestVotes} />
      <BoardLogPeek logs={hostView.publicLogs.slice(-3)} />
    </section>
  );
}

function BoardVitals({ board }: { board: HostBoardView }) {
  return (
    <div className="player-board-vitals">
      <BoardGauge label="ボスHP" value={board.bossHp} max={board.bossMaxHp} tone="boss" />
      <BoardGauge label="拠点耐久" value={board.baseHp} max={board.baseMaxHp} tone="base" />
    </div>
  );
}

function BoardGauge({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: 'boss' | 'base';
}) {
  return (
    <div className="player-board-gauge">
      <div>
        <span>{label}</span>
        <strong>{value}/{max}</strong>
      </div>
      <div className="gauge-track">
        <span className={tone} style={{ width: percent(value, max) }} />
      </div>
    </div>
  );
}

function BoardSituation({ board }: { board: HostBoardView }) {
  const bossDetail = board.bossTargetName
    ? `${board.bossTargetName}へロックオン`
    : board.bossActionForecast;
  const publicFocus = board.mode === 'party'
    ? board.flowBody
    : board.monitoredName
      ? `${board.monitoredName} / ${board.monitoredSuspicion}`
      : board.flowBody;

  return (
    <div className="player-board-situation">
      <div>
        <span>ROUND</span>
        <strong>{board.round} / {board.maxRounds}</strong>
        <em>{board.modeLabel}</em>
      </div>
      <div>
        <span>ボス予告</span>
        <strong>{board.bossActionLabel}</strong>
        <em>{bossDetail}</em>
      </div>
      <div>
        <span>{board.inputLabel}</span>
        <strong>{board.ready} / {board.readyTotal}</strong>
        <em>{publicFocus}</em>
      </div>
    </div>
  );
}

function BoardEventSummary({ board }: { board: HostBoardView }) {
  const latest = board.latestRound;
  if (!latest) {
    return (
      <div className="player-board-events">
        <span className={`event-chip ${board.bossActionType === 'big_charge' ? 'warning' : 'neutral'}`}>
          <strong>ボス予告</strong>
          <em>{board.bossActionForecast}</em>
        </span>
      </div>
    );
  }

  const events = [
    latest.totalDamage > 0 ? { key: 'attack', label: '砲撃命中', value: `${latest.totalDamage}`, tone: 'attack' } : undefined,
    latest.defenseCount > 0 ? { key: 'guard', label: '防御', value: `${latest.defenseCount}基`, tone: 'guard' } : undefined,
    latest.repairs > 0 ? { key: 'repair', label: '修理', value: `+${latest.repairs}`, tone: 'repair' } : undefined,
    latest.sabotageCount > 0 ? {
      key: 'sabotage',
      label: latest.sabotagePressure ? '強い通信ノイズ' : '通信ノイズ',
      value: latest.sabotagePressure ? '警戒' : `${latest.sabotageCount}件`,
      tone: latest.sabotagePressure ? 'sabotage pressure' : 'sabotage',
    } : undefined,
    latest.baseDamage > 0 ? { key: 'base', label: '拠点被弾', value: `-${latest.baseDamage}`, tone: 'danger' } : undefined,
    latest.bossHealing > 0 ? { key: 'heal', label: 'ボス回復', value: `+${latest.bossHealing}`, tone: 'heal' } : undefined,
  ].filter((event): event is { key: string; label: string; value: string; tone: string } => Boolean(event));

  if (events.length === 0) {
    events.push({ key: 'quiet', label: `R${latest.round}`, value: '大きな変化なし', tone: 'neutral' });
  }

  return (
    <div className="player-board-events" aria-label="中央画面の直近イベント">
      {events.slice(0, 4).map((event) => (
        <span key={event.key} className={`event-chip ${event.tone}`}>
          <strong>{event.label}</strong>
          <em>{event.value}</em>
        </span>
      ))}
    </div>
  );
}

function BoardPlayerSync({ players }: { players: HostPlayerView[] }) {
  return (
    <div className="player-board-sync" aria-label="公開プレイヤー入力状況">
      {players.map((player) => (
        <span key={player.id} className={`operation-chip ${player.inputTone}`}>
          {player.name} {player.inputStatus}
        </span>
      ))}
    </div>
  );
}

function BoardVoteSummary({ votes }: { votes: HostVoteView[] }) {
  if (votes.length === 0) return null;
  return (
    <div className="player-board-votes" aria-label="投票結果">
      {votes.map((vote) => (
        <span key={vote.playerId}>
          <strong>{vote.name}</strong>
          <em>{vote.count}票</em>
        </span>
      ))}
    </div>
  );
}

function BoardLogPeek({ logs }: { logs: string[] }) {
  if (logs.length === 0) return null;
  return (
    <div className="player-board-log">
      <span>公開ログ</span>
      <ol>
        {logs.map((log, index) => <li key={`${index}-${log}`}>{log}</li>)}
      </ol>
    </div>
  );
}
