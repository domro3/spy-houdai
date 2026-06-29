import { Trophy } from 'lucide-react';
import { PrototypeAssetImage } from '../assets/PrototypeAssetImage';
import { prototypeAssets, turretPrototypeAsset } from '../assets/prototype_assets';
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
    <section className="host-screen" aria-label="戦況スクリーン">
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
          <span className="section-kicker">戦況スクリーン</span>
          <h2>ROUND {Math.min(state.round, state.maxRounds)} / {state.maxRounds}</h2>
        </div>
        <div className="phase-pill">{phaseLabel(state.phase, state.mode)}</div>
      </div>

      <BoardFlowBanner engine={engine} readyCount={readyCount} />
      <BattleTheater engine={engine} />

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

function BoardFlowBanner({
  engine,
  readyCount,
}: {
  engine: GameEngine;
  readyCount: { ready: number; total: number };
}) {
  const state = engine.state;
  const remaining = Math.max(0, readyCount.total - readyCount.ready);
  const allReady = state.phase !== 'finished' && readyCount.total > 0 && remaining === 0;
  const tone = state.phase === 'finished'
    ? 'finished'
    : allReady
      ? 'ready'
      : state.currentBossAction.type === 'big_charge'
        ? 'warning'
        : 'active';

  return (
    <div className={`board-flow-banner ${tone}`}>
      <div>
        <span>{boardFlowKicker(state.phase)}</span>
        <strong>{boardFlowTitle(engine, readyCount)}</strong>
      </div>
      {allReady ? (
        <div className="sync-countdown" aria-label="自動解決カウントダウン">
          <span>3</span>
          <span>2</span>
          <span>1</span>
        </div>
      ) : (
        <em>{boardFlowBody(engine, readyCount)}</em>
      )}
    </div>
  );
}

function boardFlowKicker(phase: GameEngine['state']['phase']): string {
  if (phase === 'finished') return 'ゲーム終了';
  if (phase === 'action') return '次にすること';
  if (phase === 'vote') return '入力待ち';
  if (phase === 'plea') return '入力待ち';
  if (phase === 'branch') return '作戦選択';
  return '進行中';
}

function boardFlowTitle(engine: GameEngine, readyCount: { ready: number; total: number }): string {
  const state = engine.state;
  const remaining = Math.max(0, readyCount.total - readyCount.ready);
  if (state.phase === 'finished') return '結果を確認してください';
  if (readyCount.total > 0 && remaining === 0) return '作戦同期完了 - 解決中...';
  if (state.phase === 'action') return `${remaining}基の作戦待ち`;
  if (state.mode === 'party' && state.phase === 'vote') return `${remaining}基のスパイ予想待ち`;
  if (state.phase === 'vote') return `${remaining}基の投票待ち`;
  if (state.phase === 'plea') return `${remaining}基の弁明待ち`;
  if (state.phase === 'branch') return `${remaining}基の作戦投票待ち`;
  return '進行待ち';
}

function boardFlowBody(engine: GameEngine, readyCount: { ready: number; total: number }): string {
  const state = engine.state;
  const remaining = Math.max(0, readyCount.total - readyCount.ready);
  if (state.phase === 'finished') return 'スパイ正体と称号を公開しています。';
  if (readyCount.total > 0 && remaining === 0) return '未接続砲台を自動同期し、戦闘結果を処理します。';
  if (state.phase === 'action' && state.mode === 'party') return partyBossHint(state.currentBossAction.type);
  if (state.phase === 'action') return '各プレイヤーは自分の画面で行動を選びます。';
  if (state.mode === 'party' && state.phase === 'vote') return '勝敗後のおまけ投票です。怪しい砲台を1人選びます。';
  return `${phaseInputLabel(state.phase, state.mode)}を各プレイヤー画面で送信します。`;
}

function BattleTheater({ engine }: { engine: GameEngine }) {
  const state = engine.state;
  const latestRound = state.history.at(-1);
  const bossTarget = state.currentBossAction.targetPlayerId
    ? engine.getPlayer(state.currentBossAction.targetPlayerId)
    : undefined;
  const bossWarning = state.phase === 'action' && state.currentBossAction.type === 'big_charge';
  const bossClasses = [
    'boss-core',
    latestRound?.totalDamage ? 'hit' : '',
    latestRound?.bossHealing ? 'heal' : '',
    bossWarning ? 'charging' : '',
  ].filter(Boolean).join(' ');
  const baseClasses = [
    'base-core',
    latestRound?.baseDamage ? 'hit' : '',
    latestRound?.repairs ? 'repairing' : '',
    partyBaseWarning(state.baseHp)?.level ?? '',
  ].filter(Boolean).join(' ');

  return (
    <section className="battle-theater" aria-label="公開戦況ステージ">
      <div className="boss-arena">
        <div className="theater-label">
          <span>巨大ボス</span>
          <strong>{state.boss.name}</strong>
        </div>
        <div className={bossClasses}>
          <PrototypeAssetImage
            src={prototypeAssets.boss}
            alt="ボス"
            className="boss-asset"
            fallback={null}
          />
          <BossFallbackVisual />
        </div>
        <TheaterHp label="BOSS HP" value={state.bossHp} max={state.bossMaxHp} tone="boss" />
        <div className={`danger-readout ${state.currentBossAction.type}`}>
          <span>次の危険</span>
          <strong>{bossActionLabel(state.currentBossAction.type)}</strong>
          <em>{bossTarget ? `${bossTarget.name}へロックオン` : bossForecastLabel(state.currentBossAction.type)}</em>
        </div>
      </div>

      <div className="theater-lane" aria-hidden="true">
        <span className={latestRound?.totalDamage ? 'lane-shot active' : 'lane-shot'} />
        <span className={latestRound?.sabotageCount ? 'lane-noise active' : 'lane-noise'}>
          <PrototypeAssetImage
            src={prototypeAssets.noiseEffect}
            alt=""
            className="noise-overlay-asset"
            fallback={null}
          />
        </span>
        <span className={latestRound?.defenseCount ? 'lane-shield active' : 'lane-shield'} />
      </div>

      <div className="base-arena">
        <div className="theater-label">
          <span>砲台基地</span>
          <strong>拠点耐久</strong>
        </div>
        <div className={baseClasses}>
          <PrototypeAssetImage
            src={prototypeAssets.baseCore}
            alt="拠点コア"
            className="base-core-asset"
            fallback={null}
          />
          <BaseFallbackVisual />
        </div>
        <TheaterHp label="BASE HP" value={state.baseHp} max={state.baseMaxHp} tone="base" />
        <div className="base-readout">
          <span>防衛状況</span>
          <strong>{partyBaseWarning(state.baseHp)?.title ?? '拠点安定'}</strong>
          <em>{latestRound?.baseDamage ? `直近被害 -${latestRound.baseDamage}` : '砲台同期を維持中'}</em>
        </div>
      </div>
    </section>
  );
}

function BossFallbackVisual() {
  return (
    <>
      <span className="boss-eye left" />
      <span className="boss-eye right" />
      <span className="boss-cannon" />
      <span className="boss-core-light" />
    </>
  );
}

function BaseFallbackVisual() {
  return (
    <>
      <span />
      <span />
      <span />
    </>
  );
}

function TheaterHp({
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
    <div className="theater-hp">
      <div>
        <span>{label}</span>
        <strong>{value}/{max}</strong>
      </div>
      <div className="theater-hp-track">
        <span className={tone} style={{ width: percent(value, max) }} />
      </div>
    </div>
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
        >
          <PrototypeAssetImage
            src={prototypeAssets.noiseEffect}
            alt=""
            className="noise-overlay-asset"
            fallback={null}
          />
        </div>
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
    <article className={`public-player-card sync-${player.inputTone}`}>
      <div className="player-topline">
        <h3>{player.name}</h3>
        <span>{player.control}</span>
      </div>
      <PublicTurretAvatar playerId={player.id} />
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
          <dd><span className={`operation-chip ${player.inputTone}`}>{player.inputStatus}</span></dd>
        </div>
      </dl>
    </article>
  );
}

function PublicTurretAvatar({ playerId }: { playerId: string }) {
  return (
    <div className="public-turret-visual" aria-hidden="true">
      <PrototypeAssetImage
        src={turretPrototypeAsset(playerId)}
        alt=""
        className="turret-avatar-asset"
        fallback={<span className="turret-avatar-fallback" />}
      />
    </div>
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
  const finalVoteTarget = result.finalVoteTargetId ? engine.getPlayer(result.finalVoteTargetId) : undefined;
  const winnerLabel = result.winner === 'gunners' ? '砲台チーム勝利' : 'スパイ勝利';
  const resultTone = result.winner === 'gunners' ? 'gunners' : 'spy';
  const headline = result.winner === 'gunners'
    ? 'ボス撃破、拠点防衛成功'
    : result.baseDestroyed
      ? '拠点陥落、作戦失敗'
      : 'ボス撃破ならず、作戦失敗';
  const spotlightAwards = result.awards.slice(0, 3);
  const remainingAwards = result.awards.slice(3);

  return (
    <section className={`result-view result-${resultTone}`} aria-label="結果発表">
      <div className="result-hero">
        <div>
          <span className="section-kicker">結果発表</span>
          <h2>{winnerLabel}</h2>
          <p>{headline}</p>
        </div>
        <div className="result-scoreboard">
          <div>
            <span>ボスHP</span>
            <strong>{engine.state.bossHp}/{engine.state.bossMaxHp}</strong>
          </div>
          <div>
            <span>拠点耐久</span>
            <strong>{engine.state.baseHp}/{engine.state.baseMaxHp}</strong>
          </div>
          <div>
            <span>スパイ正体</span>
            <strong>{spy.name}</strong>
          </div>
        </div>
      </div>

      <div className="result-callouts">
        {engine.state.mode === 'party' && finalVoteTarget && (
          <div className={finalVoteTarget.id === result.spyId ? 'result-callout success' : 'result-callout spy'}>
            <span>おまけ投票</span>
            <strong>{finalVoteTarget.id === result.spyId ? '名探偵砲台チームボーナス' : 'スパイ潜伏成功'}</strong>
            <em>{finalVoteTarget.name}に票が集まりました。</em>
          </div>
        )}
        {result.spyBehindWin && (
          <div className="result-callout spy">
            <span>裏勝利</span>
            <strong>スパイ潜伏成功</strong>
            <em>最終投票でスパイを当てられませんでした。</em>
          </div>
        )}
      </div>

      <div className="award-showcase" aria-label="称号発表">
        <div className="board-heading">
          <h3>称号発表</h3>
          <span>今回のハイライト</span>
        </div>
        <div className="award-spotlight-list">
          {spotlightAwards.map((award) => (
            <AwardRow key={`${award.title}-${award.playerId ?? 'team'}`} engine={engine} award={award} spotlight />
          ))}
        </div>
        {remainingAwards.length > 0 && (
          <div className="award-list">
            {remainingAwards.map((award) => (
              <AwardRow key={`${award.title}-${award.playerId ?? 'team'}`} engine={engine} award={award} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AwardRow({
  engine,
  award,
  spotlight = false,
}: {
  engine: GameEngine;
  award: NonNullable<GameEngine['state']['result']>['awards'][number];
  spotlight?: boolean;
}) {
  const owner = award.playerId ? engine.getPlayer(award.playerId).name : 'チーム';
  return (
    <div className={spotlight ? 'award-row spotlight' : 'award-row'}>
      <span className="award-icon" aria-hidden="true"><Trophy size={18} /></span>
      <div>
        <strong>{award.title}</strong>
        <span>{owner}</span>
      </div>
      <em>{award.reason}</em>
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
          {logs.map((log, index) => <PublicLogLine key={`${log}-${index}`} log={log} />)}
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
        {logs.map((log, index) => <PublicLogLine key={`${round}-${index}`} log={log} />)}
      </ol>
    </article>
  );
}

function PublicLogLine({ log }: { log: string }) {
  const event = publicLogEvent(log);
  return (
    <li className={`public-log-line ${event.tone}`}>
      <span className="log-event-badge" aria-hidden="true">{event.label}</span>
      <span>{log}</span>
    </li>
  );
}

function publicLogEvent(log: string): { label: string; tone: string } {
  if (log.includes('大技') || log.includes('危険') || log.includes('陥落') || log.includes('被害')) {
    return { label: '警告', tone: 'warning' };
  }
  if (log.includes('ノイズ') || log.includes('異常') || log.includes('妨害')) {
    return { label: '妨害', tone: 'sabotage' };
  }
  if (log.includes('ボス') && log.includes('回復')) {
    return { label: '妨害', tone: 'sabotage' };
  }
  if (log.includes('修理') || log.includes('回復') || log.includes('耐久は残り')) {
    return { label: '修理', tone: 'repair' };
  }
  if (log.includes('防御') || log.includes('守')) {
    return { label: '防御', tone: 'guard' };
  }
  if (log.includes('ダメージ') || log.includes('攻撃') || log.includes('撃破')) {
    return { label: '攻撃', tone: 'attack' };
  }
  return { label: '情報', tone: 'neutral' };
}
