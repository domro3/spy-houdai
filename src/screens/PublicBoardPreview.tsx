import type { HostBoardView, HostPlayerView, HostScreenViewModel, HostVoteView } from './screen_view_models';
import { PrototypeAssetImage } from '../assets/PrototypeAssetImage';
import { prototypeAssets } from '../assets/prototype_assets';
import { percent } from '../view/format';

export function PublicBoardPreview({ hostView }: { hostView: HostScreenViewModel }) {
  return (
    <section className="player-board-preview" aria-label="中央画面">
      <div className="player-board-header">
        <div>
          <span className="section-kicker">BATTLE HUD</span>
          <h3>{hostView.board.bossName}</h3>
        </div>
        <div className="player-board-badges">
          <span className="round-badge">ROUND {hostView.board.round}/{hostView.board.maxRounds}</span>
          <span className={`player-board-phase phase-${hostView.board.phase}`}>{hostView.board.phaseLabel}</span>
        </div>
      </div>

      <BoardVitals board={hostView.board} />
      <BoardProgress board={hostView.board} />
      <BoardBossMini board={hostView.board} />
      <BoardBossAlert board={hostView.board} />
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

function BoardBossMini({ board }: { board: HostBoardView }) {
  return (
    <div className="player-board-mini" aria-label="ボス戦況ミニビュー">
      <div className="boss-mini-core">
        <PrototypeAssetImage
          src={prototypeAssets.boss}
          alt="ボス"
          className="boss-mini-asset"
          fallback={<span className="boss-mini-fallback" />}
        />
      </div>
      <div>
        <span>ボス戦況</span>
        <strong>{board.flowTitle}</strong>
        <em>{board.bossActionForecast}</em>
      </div>
    </div>
  );
}

function BoardBossAlert({ board }: { board: HostBoardView }) {
  const bossDetail = board.bossTargetName
    ? `${board.bossTargetName}へロックオン`
    : board.bossActionForecast;
  const tone = board.bossActionType === 'big_charge' ? 'warning' : 'active';

  return (
    <div className={`player-board-alert ${tone}`}>
      <span>ボス予告</span>
      <strong>{board.bossActionLabel}</strong>
      <em>{bossDetail}</em>
      <b>{board.flowBody}</b>
    </div>
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

function BoardProgress({ board }: { board: HostBoardView }) {
  return (
    <div className="player-board-progress">
      <div>
        <span>{board.inputLabel}</span>
        <strong>{board.ready} / {board.readyTotal}</strong>
      </div>
      <div className="terminal-progress-track" aria-hidden="true">
        <span style={{ width: percent(board.ready, Math.max(1, board.readyTotal)) }} />
      </div>
    </div>
  );
}

function BoardSituation({ board }: { board: HostBoardView }) {
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
        <span>判断ヒント</span>
        <strong>{board.flowKicker}</strong>
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
    <details className="player-board-log">
      <summary>公開ログ</summary>
      <ol>
        {logs.map((log, index) => {
          const event = boardLogEvent(log);
          return (
            <li key={`${index}-${log}`} className={`terminal-log-line ${event.tone}`}>
              <b>{event.label}</b>
              <span>{log}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

function boardLogEvent(log: string): { label: string; tone: string } {
  if (log.includes('大技') || log.includes('危険') || log.includes('陥落') || log.includes('被害')) {
    return { label: 'ボス予告', tone: 'warning' };
  }
  if (log.includes('ノイズ') || log.includes('異常') || log.includes('妨害')) {
    return { label: '妨害', tone: 'sabotage' };
  }
  if (log.includes('修理') || log.includes('回復') || log.includes('耐久は残り')) {
    return { label: '修理', tone: 'repair' };
  }
  if (log.includes('防御') || log.includes('守')) {
    return { label: 'ガード', tone: 'guard' };
  }
  if (log.includes('入力') || log.includes('作戦')) {
    return { label: '入力', tone: 'input' };
  }
  return { label: '情報', tone: 'neutral' };
}
