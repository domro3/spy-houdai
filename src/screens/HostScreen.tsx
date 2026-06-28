import { bossActionLabel, bossForecastLabel, GameEngine } from '../core/game_engine';
import type { BossActionType, RoundSummary } from '../core/types';
import {
  percent,
  suspicionStars,
} from '../view/format';
import {
  deltaTone,
  formatDelta,
  partyBaseWarning,
  partyBossHint,
  phaseInputLabel,
  phaseLabel,
  phaseReadyCount,
} from './screen_state';
import { createHostScreenViewModel, type HostPlayerView, type HostVoteView } from './screen_view_models';

export function HostScreen({ engine }: { engine: GameEngine }) {
  const hostView = createHostScreenViewModel(engine);
  return (
    <section className="host-screen" aria-label="ホスト画面">
      <CentralStatusPanel engine={engine} />
      {engine.state.phase === 'finished' && <ResultView engine={engine} />}
      <HostVoteResult votes={hostView.latestVotes} />
      <PublicPlayerBoard players={hostView.players} />
      <div className="log-layout">
        <RoundLogTimeline engine={engine} />
        <LogPanel title="公開ログ履歴" logs={hostView.publicLogs.slice(-18)} />
      </div>
    </section>
  );
}

function CentralStatusPanel({ engine }: { engine: GameEngine }) {
  const state = engine.state;
  const readyCount = phaseReadyCount(engine);
  const monitored = state.monitoredPlayerId ? engine.getPlayer(state.monitoredPlayerId) : undefined;
  const bossTarget = state.currentBossAction.targetPlayerId
    ? engine.getPlayer(state.currentBossAction.targetPlayerId)
    : undefined;
  const latestRound = state.history.at(-1);
  const bossDelta = latestRound ? latestRound.bossHealing - latestRound.totalDamage : undefined;
  const baseDelta = latestRound ? latestRound.repairs - latestRound.baseDamage : undefined;
  const baseWarning = state.mode === 'party' ? partyBaseWarning(state.baseHp) : undefined;

  return (
    <section className="central-panel" aria-label="中央状況">
      <div className="central-header">
        <div>
          <span className="section-kicker">ホスト画面</span>
          <h2>ROUND {Math.min(state.round, state.maxRounds)} / {state.maxRounds}</h2>
        </div>
        <div className="phase-pill">{phaseLabel(state.phase, state.mode)}</div>
      </div>

      <div className="status-grid">
        <BattleGauge label="ボスHP" value={state.bossHp} max={state.bossMaxHp} delta={bossDelta} tone="boss" />
        <BattleGauge label="拠点耐久" value={state.baseHp} max={state.baseMaxHp} delta={baseDelta} tone="base" />
      </div>
      {state.mode === 'party' && <BattleEventStrip engine={engine} />}
      {baseWarning && (
        <div className={`base-warning ${baseWarning.level}`}>
          <strong>{baseWarning.title}</strong>
          <span>{baseWarning.body}</span>
        </div>
      )}

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
          <strong>{readyCount.ready} / {readyCount.total}</strong>
          <em>{phaseInputLabel(state.phase, state.mode)}</em>
        </div>
      </div>

      {state.mode === 'party' ? <PartyStatusBoard engine={engine} /> : <SuspicionBoard engine={engine} />}
    </section>
  );
}

function BattleEventStrip({ engine }: { engine: GameEngine }) {
  const state = engine.state;
  const latestRound = state.history.at(-1);
  const bossAction = state.currentBossAction;
  const attackActive = Boolean(latestRound && latestRound.totalDamage > 0);
  const guardActive = Boolean(latestRound && latestRound.defenseCount > 0);
  const repairActive = Boolean(latestRound && latestRound.repairs > 0);
  const sabotageActive = Boolean(latestRound && latestRound.sabotageCount > 0);
  const sabotagePressure = Boolean(latestRound?.sabotagePressure);
  const bossHitActive = Boolean(latestRound && latestRound.totalDamage > 0);
  const baseHitActive = Boolean(latestRound && latestRound.baseDamage > 0);
  const healActive = Boolean(latestRound && latestRound.bossHealing > 0);
  const warningActive = state.phase === 'action' && bossAction.type === 'big_charge';
  const events = battleEvents(state.currentBossAction.type, latestRound);

  return (
    <div className="battle-event-strip" aria-label="戦闘イベント">
      <div className="battle-stage">
        <div
          className={[
            'battle-node',
            'boss-node',
            bossHitActive ? 'boss-hit' : '',
            healActive ? 'boss-heal' : '',
            warningActive ? 'boss-warning' : '',
          ].filter(Boolean).join(' ')}
        >
          <span>ボス</span>
        </div>
        <div className={attackActive ? 'battle-projectile active' : 'battle-projectile'} />
        <div
          className={[
            'sabotage-noise',
            sabotageActive ? 'active' : '',
            sabotagePressure ? 'pressure' : '',
          ].filter(Boolean).join(' ')}
        />
        <div className={guardActive ? 'shield-ring active' : 'shield-ring'} />
        <div
          className={[
            'battle-node',
            'base-node',
            baseHitActive ? 'base-hit' : '',
            repairActive ? 'base-repair' : '',
          ].filter(Boolean).join(' ')}
        >
          <span>拠点</span>
        </div>
      </div>
      <div className="event-chip-row">
        {events.map((event) => (
          <span key={event.key} className={`event-chip ${event.tone}`}>
            <strong>{event.label}</strong>
            <em>{event.value}</em>
          </span>
        ))}
      </div>
    </div>
  );
}

function battleEvents(
  bossAction: BossActionType,
  latestRound?: RoundSummary,
): Array<{ key: string; label: string; value: string; tone: string }> {
  if (!latestRound) {
    return [{
      key: 'forecast',
      label: 'ボス予告',
      value: bossForecastLabel(bossAction),
      tone: bossAction === 'big_charge' ? 'warning' : 'neutral',
    }];
  }

  const events: Array<{ key: string; label: string; value: string; tone: string }> = [];
  if (latestRound.totalDamage > 0) {
    events.push({ key: 'attack', label: '砲撃命中', value: `${latestRound.totalDamage}ダメージ`, tone: 'attack' });
  }
  if (latestRound.defenseCount > 0) {
    events.push({ key: 'guard', label: 'バリア展開', value: `${latestRound.defenseCount}基`, tone: 'guard' });
  }
  if (latestRound.repairs > 0) {
    events.push({ key: 'repair', label: '修理完了', value: `+${latestRound.repairs}`, tone: 'repair' });
  }
  if (latestRound.sabotageCount > 0) {
    events.push({
      key: 'sabotage',
      label: latestRound.sabotagePressure ? '強い通信ノイズ' : '通信ノイズ',
      value: latestRound.sabotagePressure ? '警戒' : `${latestRound.sabotageCount}件`,
      tone: latestRound.sabotagePressure ? 'sabotage pressure' : 'sabotage',
    });
  }
  if (latestRound.baseDamage > 0) {
    events.push({ key: 'base', label: '拠点被弾', value: `-${latestRound.baseDamage}`, tone: 'danger' });
  }
  if (latestRound.bossHealing > 0) {
    events.push({ key: 'heal', label: 'ボス回復', value: `+${latestRound.bossHealing}`, tone: 'heal' });
  }
  return events.slice(0, 5);
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

function HostVoteResult({ votes }: { votes: HostVoteView[] }) {
  if (votes.length === 0) return null;

  return (
    <section className="host-public-panel">
      <div className="board-heading">
        <h3>投票結果</h3>
        <span>公開済みの集計</span>
      </div>
      <div className="public-vote-list">
        {votes.map((vote) => (
          <div key={vote.playerId}>
            <span>{vote.name}</span>
            <strong>{vote.count}票</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function PublicPlayerBoard({ players }: { players: HostPlayerView[] }) {
  return (
    <section className="host-public-panel">
      <div className="board-heading">
        <h3>公開プレイヤー状況</h3>
        <span>役職と個別行動は進行中非公開</span>
      </div>
      <div className="public-player-grid">
        {players.map((player) => (
          <PublicPlayerCard key={player.id} player={player} />
        ))}
      </div>
    </section>
  );
}

function PublicPlayerCard({ player }: { player: HostPlayerView }) {
  return (
    <article className="public-player-card">
      <div className="player-topline">
        <h3>{player.name}</h3>
        <span>{player.control}</span>
      </div>
      <dl>
        <div>
          <dt>役職</dt>
          <dd>{player.role}</dd>
        </div>
        <div>
          <dt>状態</dt>
          <dd>{player.status}</dd>
        </div>
        <div>
          <dt>入力</dt>
          <dd>{player.inputStatus}</dd>
        </div>
      </dl>
    </article>
  );
}

function BattleGauge({
  label,
  value,
  max,
  delta,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  delta?: number;
  tone: 'boss' | 'base';
}) {
  return (
    <div className="gauge-panel">
      <div>
        <span>{label}</span>
        <strong>
          {value}/{max}
          {delta !== undefined && (
            <em className={`gauge-delta ${deltaTone(delta)}`}>{formatDelta(delta)}</em>
          )}
        </strong>
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
    <section className="result-view host-public-panel">
      <h3>{result.winner === 'gunners' ? '砲台チーム勝利' : 'スパイ勝利'}</h3>
      <p>{result.bossDefeated ? 'ボス撃破成功' : 'ボス撃破失敗'} / 拠点耐久 {engine.state.baseHp}</p>
      <p>スパイ正体: {spy.name}</p>
      {result.spyBehindWin && <p>スパイ裏勝利: 最終投票でスパイを当てられませんでした。</p>}
      {engine.state.mode === 'party' && result.finalVoteTargetId && (
        <p>
          おまけ投票:
          {' '}
          {result.finalVoteTargetId === result.spyId ? '名探偵砲台チームボーナス' : 'スパイ潜伏成功'}
        </p>
      )}
      <div className="award-list">
        {result.awards.map((award) => (
          <div key={`${award.title}-${award.playerId ?? 'team'}`}>
            <strong>{award.title}</strong>
            <span>{award.playerId ? engine.getPlayer(award.playerId).name : 'チーム'} - {award.reason}</span>
          </div>
        ))}
      </div>
    </section>
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
