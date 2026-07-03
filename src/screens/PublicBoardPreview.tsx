import type { HostBoardView, HostPlayerView, HostScreenViewModel, HostVoteView } from './screen_view_models';
import {
  BossUnlinkMk01,
  CoreGuardTurret,
  GameIcon,
  LinkCoreVisual,
  type BossMk01State,
  type CoreGuardTurretState,
  type LinkCoreState,
} from '../components/game/assets/visual/GameVisualAssets';
import { percent } from '../view/format';

export function PublicBoardPreview({ hostView }: { hostView: HostScreenViewModel }) {
  return (
    <section className="player-board-preview signal-combat-board" aria-label="中央画面">
      <div className="signal-board-backdrop" aria-hidden="true" />
      <SignalTopHud board={hostView.board} />
      <div className="signal-battle-layout">
        <OperatorSignalRail players={hostView.players} />
        <SignalArena board={hostView.board} />
        <SignalResultPanel board={hostView.board} logs={hostView.publicLogs.slice(-3)} />
      </div>
      <div className="signal-compact-strip">
        <BoardProgress board={hostView.board} />
        <BoardEventSummary board={hostView.board} />
        <BoardPlayerSync players={hostView.players} />
        <BoardVoteSummary votes={hostView.latestVotes} />
      </div>
    </section>
  );
}

function SignalTopHud({ board }: { board: HostBoardView }) {
  return (
    <div className="signal-top-hud">
      <div className="signal-brand-lockup">
        <strong>スパイ砲台</strong>
        <span>Party / Public Alpha</span>
      </div>
      <div className="signal-vital-strip">
        <div className="signal-vital boss">
          <GameIcon name="boss" size={28} />
          <div>
            <span>BOSS HP</span>
            <strong>{board.bossHp} / {board.bossMaxHp}</strong>
            <div className="signal-hp-track"><i style={{ width: percent(board.bossHp, board.bossMaxHp) }} /></div>
          </div>
        </div>
        <div className="signal-vital base">
          <GameIcon name="core" size={28} />
          <div>
            <span>拠点</span>
            <strong>{board.baseHp} / {board.baseMaxHp}</strong>
            <div className="signal-hp-track"><i style={{ width: percent(board.baseHp, board.baseMaxHp) }} /></div>
          </div>
        </div>
        <div className={`signal-warning ${board.bossActionType === 'big_charge' ? 'danger' : ''}`}>
          <GameIcon name="warning" size={22} />
          <div>
            <span>ボスの予告</span>
            <strong>{board.bossActionLabel}</strong>
          </div>
        </div>
      </div>
      <div className="signal-room-card">
        <span>ROUND</span>
        <strong>{board.round}/{board.maxRounds}</strong>
        <em>{board.phaseLabel}</em>
      </div>
    </div>
  );
}

function OperatorSignalRail({ players }: { players: HostPlayerView[] }) {
  return (
    <div className="operator-signal-rail" aria-label="公開オペレーター入力状況">
      <span className="rail-kicker">OPERATOR SIGNAL</span>
      {players.slice(0, 5).map((player) => (
        <div key={player.id} className={`operator-rail-card ${player.inputTone}`}>
          <strong>{player.id.toUpperCase()}</strong>
          <CoreGuardTurret state={railTurretState(player.inputTone)} playerId={player.id} compact />
          <div>
            <span>{player.inputStatus}</span>
            <em>{player.role}</em>
          </div>
        </div>
      ))}
    </div>
  );
}

function railTurretState(tone: HostPlayerView['inputTone']): CoreGuardTurretState {
  if (tone === 'ready' || tone === 'done') return 'attack';
  if (tone === 'auto') return 'repair';
  return 'idle';
}

function SignalArena({ board }: { board: HostBoardView }) {
  const latest = board.latestRound;
  const bossState = board.bossActionType === 'big_charge'
    ? 'charge'
    : latest?.totalDamage
      ? 'damaged'
      : latest?.sabotageCount || latest?.baseDamage
        ? 'attack'
        : 'idle';
  const bossEffect = board.bossActionType === 'big_charge'
    ? 'charge'
    : latest?.bossHealing
      ? 'heal'
      : latest?.totalDamage
        ? 'damage'
        : latest?.sabotageCount
          ? 'noise'
          : undefined;
  const turretStates: Array<{ id: string; state: CoreGuardTurretState; label: string }> = [
    { id: 'p1', state: latest?.totalDamage ? 'attack' : 'idle', label: '攻撃' },
    { id: 'p2', state: latest?.defenseCount ? 'guard' : 'idle', label: '守り' },
    { id: 'p3', state: latest?.repairs ? 'repair' : 'idle', label: '修復' },
    { id: 'p4', state: latest?.sabotageCount ? 'suspect' : 'idle', label: 'ノイズ' },
    { id: 'p5', state: latest?.totalDamage ? 'attack' : 'idle', label: '同期' },
  ];

  return (
    <div className="signal-arena" aria-label="タレット戦闘シーン">
      <div className="signal-arena-image" aria-hidden="true" />
      {bossEffect && <span className={`arena-boss-effect ${bossEffect}`} aria-hidden="true" />}
      <BossUnlinkMk01 state={bossState as BossMk01State} className="signal-arena-boss" />
      <div className="signal-core-target">
        <LinkCoreVisual state={board.baseWarning?.level === 'critical' ? 'critical' : 'idle'} compact />
        <span>CORE</span>
      </div>
      {turretStates.map((turret) => (
        <div key={turret.id} className={`arena-turret arena-${turret.id} ${turret.state}`}>
          <CoreGuardTurret state={turret.state} playerId={turret.id} compact />
          <span>{turret.label}</span>
        </div>
      ))}
      <SignalActionPops board={board} />
    </div>
  );
}

function SignalActionPops({ board }: { board: HostBoardView }) {
  const latest = board.latestRound;
  if (!latest) {
    return (
      <span className={`signal-pop signal-pop-warning ${board.bossActionType === 'big_charge' ? 'active' : ''}`}>
        {board.bossActionForecast}
      </span>
    );
  }
  return (
    <>
      {latest.totalDamage > 0 && <span className="signal-pop signal-pop-damage">-{latest.totalDamage}</span>}
      {latest.repairs > 0 && <span className="signal-pop signal-pop-repair">+{latest.repairs}</span>}
      {latest.defenseCount > 0 && <span className="signal-pop signal-pop-guard">軽減 {latest.defenseCount}</span>}
      {latest.sabotageCount > 0 && <span className="signal-pop signal-pop-noise">ノイズ</span>}
      {latest.bossHealing > 0 && <span className="signal-pop signal-pop-heal">+{latest.bossHealing}?</span>}
    </>
  );
}

function SignalResultPanel({ board, logs }: { board: HostBoardView; logs: string[] }) {
  const latest = board.latestRound;
  const rows = latest
    ? [
      { key: 'damage', icon: 'attack' as const, label: '与ダメージ合計', value: latest.totalDamage ? `-${latest.totalDamage}` : '0', tone: 'attack' },
      { key: 'repair', icon: 'repair' as const, label: '回復合計', value: latest.repairs ? `+${latest.repairs}` : '0', tone: 'repair' },
      { key: 'guard', icon: 'guard' as const, label: '軽減合計', value: latest.defenseCount ? `${latest.defenseCount}` : '0', tone: 'guard' },
      { key: 'noise', icon: 'sabotage' as const, label: 'ノイズ検出', value: `${latest.sabotageCount}件`, tone: 'sabotage' },
      { key: 'heal', icon: 'boss' as const, label: '異常回復', value: latest.bossHealing ? `+${latest.bossHealing}?` : 'なし', tone: 'heal' },
    ]
    : [
      { key: 'forecast', icon: 'warning' as const, label: 'ボス予告', value: board.bossActionLabel, tone: 'warning' },
      { key: 'ready', icon: 'sync' as const, label: board.inputLabel, value: `${board.ready}/${board.readyTotal}`, tone: 'guard' },
    ];

  return (
    <div className="signal-result-panel">
      <div>
        <h4>アクション結果（公開）</h4>
        <div className="signal-result-list">
          {rows.map((row) => (
            <div key={row.key} className={`signal-result-row ${row.tone}`}>
              <GameIcon name={row.icon} size={20} />
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h4>公開ログ</h4>
        <ol className="signal-log-list">
          {(logs.length ? logs : [board.flowBody]).map((log, index) => (
            <li key={`${index}-${log}`}>{log}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function BoardBossMini({ board }: { board: HostBoardView }) {
  const bossState = board.bossActionType === 'big_charge'
    ? 'charge'
    : board.latestRound?.totalDamage
      ? 'damaged'
      : board.latestRound?.sabotageCount || board.latestRound?.baseDamage
        ? 'attack'
        : board.baseWarning?.level === 'critical'
          ? 'danger'
          : 'idle';
  const coreState = board.baseWarning?.level === 'critical'
    ? 'critical'
    : board.baseWarning || board.latestRound?.baseDamage
      ? 'damage'
      : 'idle';

  return (
    <div className="player-board-mini" aria-label="ボス戦況ミニビュー">
      <div className="boss-mini-core">
        <BossUnlinkMk01 state={bossState as BossMk01State} compact />
        <LinkCoreVisual state={coreState as LinkCoreState} compact />
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
    latest.totalDamage > 0 ? { key: 'attack', label: '攻撃信号', value: `-${latest.totalDamage}`, tone: 'attack' } : undefined,
    latest.defenseCount > 0 ? { key: 'guard', label: '防御信号', value: `軽減 ${latest.defenseCount}基`, tone: 'guard' } : undefined,
    latest.repairs > 0 ? { key: 'repair', label: '修復信号', value: `+${latest.repairs}`, tone: 'repair' } : undefined,
    latest.sabotageCount > 0 ? {
      key: 'sabotage',
      label: latest.sabotagePressure ? '強い信号ノイズ' : '信号ノイズ',
      value: latest.sabotagePressure ? '警戒' : `ノイズ ${latest.sabotageCount}`,
      tone: latest.sabotagePressure ? 'sabotage pressure' : 'sabotage',
    } : undefined,
    latest.baseDamage > 0 ? { key: 'base', label: '拠点被弾', value: `-${latest.baseDamage}`, tone: 'danger' } : undefined,
    latest.bossHealing > 0 ? { key: 'heal', label: '異常回復', value: `+${latest.bossHealing}?`, tone: 'heal' } : undefined,
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
    <div className="player-board-sync" aria-label="公開オペレーター入力状況">
      {players.map((player) => (
        <span key={player.id} className={`operation-chip ${player.inputTone}`}>
          {player.id.toUpperCase()} {player.inputStatus}
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
    <details className="player-board-log panel-log">
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
    return { label: 'ノイズ', tone: 'sabotage' };
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
