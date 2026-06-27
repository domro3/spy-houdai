import {
  ACTION_BALANCE,
  ACTION_LABELS,
  BALANCE_BY_PLAYER_COUNT,
  BOSS_BALANCE,
  BRANCH_EFFECTS,
  CPU_PROFILES,
  GUNNER_ACTIONS,
  PLAYER_LIMITS,
  PLAYER_NAMES,
  SPY_ACTIONS,
} from '../data/constants';
import { changeSuspicion } from './suspicion';
import { clamp, SeededRandom, shuffle } from './random';
import type {
  ActionSubmission,
  ActionType,
  Award,
  BranchCondition,
  BranchPlan,
  BranchVoteSubmission,
  GameResult,
  GameSetupOptions,
  GameState,
  Player,
  PlayerStats,
  RandomSource,
  RoundSummary,
  ScanReport,
  SuspiciousCoinEvent,
  VoteSubmission,
} from './types';

const createStats = (): PlayerStats => ({
  damage: 0,
  healing: 0,
  mitigated: 0,
  sabotage: 0,
  bossHealing: 0,
  logScrambles: 0,
  robotContribution: 0,
  wrongCitizenVotes: 0,
  chargeSuccesses: 0,
});

export class GameEngine {
  readonly rng: RandomSource;
  state: GameState;

  constructor(options: GameSetupOptions, rng?: RandomSource) {
    this.rng = rng ?? new SeededRandom(options.seed);
    this.state = this.createInitialState(options);
  }

  submitAction(submission: ActionSubmission): void {
    this.assertPhase('action');
    const player = this.getPlayer(submission.playerId);
    const allowedActions = player.role === 'spy' ? SPY_ACTIONS : GUNNER_ACTIONS;
    if (!allowedActions.includes(submission.type)) {
      throw new Error(`${player.name} cannot use ${submission.type}`);
    }
    if (requiresTarget(submission.type) && !submission.targetId) {
      throw new Error(`${submission.type} requires a target`);
    }
    if (submission.targetId === submission.playerId) {
      throw new Error('Players cannot target themselves');
    }
    this.state.submittedActions[submission.playerId] = submission;
  }

  submitPlea(playerId: string, plea: string): void {
    this.assertPhase('plea');
    this.getPlayer(playerId).lastPlea = plea;
    this.state.pleas[playerId] = plea;
  }

  useSuspiciousCoin(playerId: string): SuspiciousCoinEvent {
    this.assertPhase('vote');
    const player = this.getPlayer(playerId);
    if (player.role !== 'spy') {
      throw new Error('Only the spy can use the suspicious coin');
    }
    if (player.hasUsedCoin) {
      throw new Error('Suspicious coin can only be used once');
    }
    if (this.state.round < ACTION_BALANCE.suspiciousCoinMinRound) {
      throw new Error(`Suspicious coin can only be used from round ${ACTION_BALANCE.suspiciousCoinMinRound}`);
    }

    const success = this.rng.next() < ACTION_BALANCE.suspiciousCoinSuccessRate;
    player.hasUsedCoin = true;
    player.coinResult = success ? 'success' : 'failed';
    const event = { playerId, round: this.state.round, success };
    this.currentSummary().suspiciousCoin = event;
    this.state.publicLogs.push('投票システムに不自然な加重反応を検出しました。');
    if (!success) {
      changeSuspicion(player, ACTION_BALANCE.suspiciousCoinFailureSuspicion);
      this.state.publicLogs.push('異常反応は失敗し、どこかの砲台の疑惑値が上昇しました。');
    }
    return event;
  }

  submitVote(submission: VoteSubmission): void {
    this.assertPhase('vote');
    if (submission.voterId === submission.targetId) {
      throw new Error('Players cannot vote for themselves');
    }
    this.getPlayer(submission.voterId);
    this.getPlayer(submission.targetId);
    this.state.votes[submission.voterId] = submission;
  }

  submitBranchVote(submission: BranchVoteSubmission): void {
    this.assertPhase('branch');
    this.getPlayer(submission.voterId);
    this.state.branchVotes[submission.voterId] = submission;
  }

  disconnectPlayer(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player.isConnected) return;
    player.isConnected = false;
    this.state.publicLogs.push(`${player.name}のパイロットが脱出しました。砲台ロボが自動制御を引き継ぎます。`);
  }

  reconnectPlayer(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (player.isConnected) return;
    player.isConnected = true;
    this.state.publicLogs.push(`${player.name}のパイロットが帰還しました。手動操縦に戻ります。`);
  }

  resolveActions(): RoundSummary {
    this.assertPhase('action');
    const missing = this.state.players.filter((player) => !this.state.submittedActions[player.id]);
    if (missing.length > 0) {
      throw new Error(`Missing actions: ${missing.map((player) => player.name).join(', ')}`);
    }

    const summary: RoundSummary = {
      round: this.state.round,
      totalDamage: 0,
      bossHealing: 0,
      baseDamage: 0,
      repairs: 0,
      defenseCount: 0,
      sabotageCount: 0,
      scrambleLog: false,
      scans: [],
      votes: {},
      publicLogs: [],
    };
    this.state.history.push(summary);
    this.state.debugLogs.push(
      `[debug] round ${this.state.round} submitted actions: ${Object.values(this.state.submittedActions)
        .map((action) => `${action.playerId}:${action.type}${action.targetId ? `->${action.targetId}` : ''}`)
        .join(', ')}`,
    );

    const sabotagedTargets = this.collectSabotageTargets(summary);
    let defenseReduction = 0;

    for (const action of Object.values(this.state.submittedActions)) {
      const player = this.getPlayer(action.playerId);
      player.lastAction = action.type;
      const sabotaged = sabotagedTargets.has(player.id);
      const damageMultiplier = BRANCH_EFFECTS[this.state.branchState.plan].damageMultiplier;

      switch (action.type) {
        case 'normal_attack':
          this.applyDamage(player, ACTION_BALANCE.normalAttackDamage, damageMultiplier, sabotaged, summary);
          break;
        case 'charge_attack':
          this.resolveChargeAttack(player, damageMultiplier, sabotaged, summary);
          break;
        case 'defend': {
          summary.defenseCount += 1;
          const reduction = sabotaged
            ? ACTION_BALANCE.sabotagedDefendReduction
            : ACTION_BALANCE.defendReduction;
          defenseReduction = Math.max(defenseReduction, reduction);
          changeSuspicion(player, -1);
          break;
        }
        case 'repair': {
          const amount = sabotaged ? ACTION_BALANCE.sabotagedRepairAmount : ACTION_BALANCE.repairAmount;
          const healed = this.healBase(amount);
          player.stats.healing += healed;
          summary.repairs += healed;
          changeSuspicion(player, -1);
          break;
        }
        case 'scan':
          summary.scans.push(this.resolveScan(player, action.targetId, sabotaged));
          break;
        case 'fake_attack':
          this.applyDamage(player, ACTION_BALANCE.fakeAttackDamage, damageMultiplier, sabotaged, summary);
          changeSuspicion(player, ACTION_BALANCE.fakeAttackSuspicion);
          break;
        case 'boss_heal': {
          const healed = this.healBoss(ACTION_BALANCE.bossHealAmount);
          player.stats.bossHealing += healed;
          summary.bossHealing += healed;
          changeSuspicion(player, ACTION_BALANCE.bossHealSuspicion);
          break;
        }
        case 'sabotage':
          player.stats.sabotage += 1;
          changeSuspicion(player, ACTION_BALANCE.sabotageSuspicion);
          break;
        case 'scramble_log':
          summary.scrambleLog = true;
          player.stats.logScrambles += 1;
          changeSuspicion(player, ACTION_BALANCE.scrambleLogSuspicion);
          break;
        default:
          assertNever(action.type);
      }

      if (!player.isConnected) {
        player.stats.robotContribution += estimateRobotContribution(action.type);
      }
    }

    const baseDamage = this.resolveBossAttack(defenseReduction);
    summary.baseDamage = baseDamage;
    if (defenseReduction > 0) {
      const mitigated = Math.round(baseDamage * (defenseReduction / Math.max(0.01, 1 - defenseReduction)));
      for (const action of Object.values(this.state.submittedActions)) {
        if (action.type === 'defend') {
          this.getPlayer(action.playerId).stats.mitigated += Math.max(1, Math.round(mitigated / summary.defenseCount));
        }
      }
    }

    this.writeRoundLogs(summary);
    this.state.phase = 'plea';
    return summary;
  }

  resolvePleas(): void {
    this.assertPhase('plea');
    const missing = this.state.players.filter((player) => !this.state.pleas[player.id]);
    if (missing.length > 0) {
      throw new Error(`Missing pleas: ${missing.map((player) => player.name).join(', ')}`);
    }
    for (const player of this.state.players) {
      if (pleaContradictsAction(player.lastPlea ?? '', player.lastAction)) {
        changeSuspicion(player, player.role === 'spy' ? 2 : 1);
      }
    }
    this.state.publicLogs.push(
      `弁明: ${this.state.players.map((player) => `${player.name}「${this.state.pleas[player.id]}」`).join(' / ')}`,
    );
    this.state.phase = 'vote';
  }

  resolveVotes(): void {
    this.assertPhase('vote');
    const missing = this.state.players.filter((player) => !this.state.votes[player.id]);
    if (missing.length > 0) {
      throw new Error(`Missing votes: ${missing.map((player) => player.name).join(', ')}`);
    }

    const voteCounts: Record<string, number> = {};
    const spy = this.spy();
    for (const vote of Object.values(this.state.votes)) {
      const voter = this.getPlayer(vote.voterId);
      const target = this.getPlayer(vote.targetId);
      const weight = voter.id === spy.id && voter.coinResult === 'success' ? 2 : 1;
      voteCounts[target.id] = (voteCounts[target.id] ?? 0) + weight;
      changeSuspicion(target, weight);
      if (voter.role === 'gunner' && target.role === 'gunner') {
        voter.stats.wrongCitizenVotes += 1;
      }
    }

    const topTargetId = Object.entries(voteCounts)
      .sort((a, b) => b[1] - a[1] || this.getPlayer(b[0]).suspicion - this.getPlayer(a[0]).suspicion)[0]?.[0];

    if (topTargetId) {
      this.state.players.forEach((player) => {
        player.status = player.id === topTargetId ? 'monitored' : 'active';
      });
      this.state.monitoredPlayerId = topTargetId;
      changeSuspicion(this.getPlayer(topTargetId), 1);
    }

    const summary = this.currentSummary();
    summary.votes = voteCounts;
    summary.monitoredPlayerId = topTargetId;
    this.state.publicLogs.push(
      `投票結果: ${Object.entries(voteCounts)
        .map(([playerId, count]) => `${this.getPlayer(playerId).name} ${count}票`)
        .join(' / ')}`,
    );
    if (topTargetId) {
      this.state.publicLogs.push(`${this.getPlayer(topTargetId).name}が次ラウンドの監視対象になりました。`);
    }

    if (this.shouldFinish()) {
      this.finishGame(topTargetId);
      return;
    }

    if (this.state.round === 3 && !this.state.branchState.resolved) {
      this.prepareBranch();
      return;
    }

    this.advanceRound();
  }

  resolveBranch(): void {
    this.assertPhase('branch');
    const missing = this.state.players.filter((player) => !this.state.branchVotes[player.id]);
    if (missing.length > 0) {
      throw new Error(`Missing branch votes: ${missing.map((player) => player.name).join(', ')}`);
    }

    const counts: Record<BranchPlan, number> = {
      normal: 0,
      overdrive: 0,
      emergency: 0,
    };
    for (const vote of Object.values(this.state.branchVotes)) {
      counts[vote.plan] += 1;
    }

    const allowed = this.allowedBranchPlans();
    const selected = allowed
      .map((plan) => [plan, counts[plan]] as const)
      .sort((a, b) => b[1] - a[1] || planPriority(a[0]) - planPriority(b[0]))[0][0];

    this.state.branchState.plan = selected;
    this.state.branchState.resolved = true;
    this.currentSummary().branchPlan = selected;
    this.state.publicLogs.push(`中間作戦: ${branchPlanLabel(selected)}に決定しました。`);
    this.advanceRound();
  }

  availableActions(playerId: string): ActionType[] {
    const player = this.getPlayer(playerId);
    return player.role === 'spy' ? SPY_ACTIONS : GUNNER_ACTIONS;
  }

  controlledByCpu(player: Player): boolean {
    return player.isCpu || !player.isConnected;
  }

  getPlayer(playerId: string): Player {
    const player = this.state.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      throw new Error(`Unknown player: ${playerId}`);
    }
    return player;
  }

  spy(): Player {
    const spy = this.state.players.find((player) => player.role === 'spy');
    if (!spy) {
      throw new Error('Spy is missing');
    }
    return spy;
  }

  currentSummary(): RoundSummary {
    const summary = this.state.history[this.state.history.length - 1];
    if (!summary) {
      throw new Error('No round summary is available yet');
    }
    return summary;
  }

  private createInitialState(options: GameSetupOptions): GameState {
    if (options.totalPlayers < PLAYER_LIMITS.min || options.totalPlayers > PLAYER_LIMITS.max) {
      throw new Error(`totalPlayers must be between ${PLAYER_LIMITS.min} and ${PLAYER_LIMITS.max}`);
    }
    if (options.humanPlayers < 0 || options.humanPlayers > options.totalPlayers) {
      throw new Error('humanPlayers must be between 0 and totalPlayers');
    }

    const balance = BALANCE_BY_PLAYER_COUNT[options.totalPlayers];
    const ids = Array.from({ length: options.totalPlayers }, (_, index) => `p${index + 1}`);
    const spyId = options.spyId ?? shuffle(ids, this.rng)[0];

    const players = ids.map<Player>((id, index) => ({
      id,
      name: PLAYER_NAMES[index] ?? `砲台${index + 1}`,
      role: id === spyId ? 'spy' : 'gunner',
      isCpu: index >= options.humanPlayers,
      isConnected: true,
      cpuProfile: CPU_PROFILES[index % CPU_PROFILES.length],
      suspicion: 0,
      status: 'active',
      hasUsedCoin: false,
      coinResult: 'unused',
      stats: createStats(),
    }));

    return {
      phase: 'action',
      round: 1,
      maxRounds: balance.rounds,
      players,
      bossHp: balance.bossHp,
      bossMaxHp: balance.bossHp,
      baseHp: balance.baseHp,
      baseMaxHp: balance.baseHp,
      submittedActions: {},
      pleas: {},
      votes: {},
      branchVotes: {},
      roundLogs: [],
      publicLogs: ['ボス出現。全砲台、起動してください。'],
      privateLogs: Object.fromEntries(players.map((player) => [player.id, []])),
      debugLogs: [],
      branchState: {
        plan: 'normal',
        resolved: false,
      },
      history: [],
    };
  }

  private collectSabotageTargets(summary: RoundSummary): Set<string> {
    const sabotagedTargets = new Set<string>();
    for (const action of Object.values(this.state.submittedActions)) {
      if (action.type !== 'sabotage' || !action.targetId) continue;
      sabotagedTargets.add(action.targetId);
      summary.sabotageCount += 1;
      const spy = this.getPlayer(action.playerId);
      const target = this.getPlayer(action.targetId);
      this.state.privateLogs[target.id].push('外部ノイズにより行動効率が低下しました。');
      this.state.debugLogs.push(`[debug] sabotage target: ${spy.name} -> ${target.name}`);
      spy.stats.sabotage += 1;
    }
    return sabotagedTargets;
  }

  private applyDamage(
    player: Player,
    baseDamage: number,
    branchMultiplier: number,
    sabotaged: boolean,
    summary: RoundSummary,
  ): void {
    const damage = Math.round(baseDamage * branchMultiplier * (sabotaged ? ACTION_BALANCE.sabotageAttackMultiplier : 1));
    this.state.bossHp = clamp(this.state.bossHp - damage, 0, this.state.bossMaxHp);
    player.stats.damage += damage;
    summary.totalDamage += damage;
    if (damage >= 60 || player.role === 'gunner') {
      changeSuspicion(player, -1);
    }
  }

  private resolveChargeAttack(
    player: Player,
    branchMultiplier: number,
    sabotaged: boolean,
    summary: RoundSummary,
  ): void {
    const successRate = ACTION_BALANCE.chargeAttackSuccessRate - (sabotaged ? ACTION_BALANCE.sabotageChargePenalty : 0);
    const success = this.rng.next() < successRate;
    const baseDamage = success
      ? ACTION_BALANCE.chargeAttackSuccessDamage
      : ACTION_BALANCE.chargeAttackFailureDamage;
    this.applyDamage(player, baseDamage, branchMultiplier, false, summary);
    if (success) {
      player.stats.chargeSuccesses += 1;
      changeSuspicion(player, -1);
    } else {
      changeSuspicion(player, 1);
    }
    if (this.rng.next() < ACTION_BALANCE.chargeBackfireRate) {
      this.state.baseHp = clamp(
        this.state.baseHp - ACTION_BALANCE.chargeBackfireBaseDamage,
        0,
        this.state.baseMaxHp,
      );
      summary.baseDamage += ACTION_BALANCE.chargeBackfireBaseDamage;
      changeSuspicion(player, 1);
      this.state.debugLogs.push(`[debug] charge backfire: ${player.name}`);
    }
  }

  private resolveScan(player: Player, targetId: string | undefined, sabotaged: boolean): ScanReport {
    if (!targetId) {
      throw new Error('scan requires targetId');
    }
    const target = this.getPlayer(targetId);
    const roll = this.rng.next();
    let result: ScanReport['result'];
    if (sabotaged) {
      result = 'unstable';
    } else if (target.role === 'spy') {
      result = roll < 0.45 ? 'weak_signal' : roll < 0.75 ? 'missing_log' : 'clear';
    } else {
      result = roll < 0.7 ? 'clear' : roll < 0.9 ? 'weak_signal' : 'contradiction_possible';
    }

    if (result === 'clear') changeSuspicion(target, -1);
    if (result === 'weak_signal') changeSuspicion(target, 1);
    if (result === 'missing_log' || result === 'contradiction_possible') changeSuspicion(target, 2);

    this.state.privateLogs[player.id].push(`${target.name}のスキャン結果: ${scanResultLabel(result)}`);
    return { scannerId: player.id, targetId, result };
  }

  private resolveBossAttack(defenseReduction: number): number {
    const special = this.rng.next() < BOSS_BALANCE.specialRate;
    const baseAttack = special
      ? (this.rng.next() < 0.5 ? BOSS_BALANCE.strongAttack : BOSS_BALANCE.weakAttack)
      : BOSS_BALANCE.normalAttack;
    const branchDelta = BRANCH_EFFECTS[this.state.branchState.plan].bossAttackDelta;
    const damage = Math.max(0, Math.round((baseAttack + branchDelta) * (1 - defenseReduction)));
    this.state.baseHp = clamp(this.state.baseHp - damage, 0, this.state.baseMaxHp);
    return damage;
  }

  private healBase(amount: number): number {
    const before = this.state.baseHp;
    this.state.baseHp = clamp(this.state.baseHp + amount, 0, this.state.baseMaxHp);
    return this.state.baseHp - before;
  }

  private healBoss(amount: number): number {
    const before = this.state.bossHp;
    this.state.bossHp = clamp(this.state.bossHp + amount, 0, this.state.bossMaxHp);
    return this.state.bossHp - before;
  }

  private writeRoundLogs(summary: RoundSummary): void {
    const logs = [
      summary.scrambleLog
        ? `第${summary.round}ラウンド結果: ボスへの損傷ログが不安定です。`
        : `第${summary.round}ラウンド結果: ボスに合計${summary.totalDamage}ダメージ。`,
      summary.bossHealing > 0
        ? `ボス反応: ${summary.bossHealing}の謎の回復反応を検出。`
        : 'ボス反応: 回復反応なし。',
      `拠点状況: ${summary.baseDamage}ダメージ${summary.repairs > 0 ? ` / ${summary.repairs}修理` : ''}${summary.defenseCount > 0 ? ' / 防御展開' : ''}。`,
      summary.sabotageCount > 0 || summary.scrambleLog
        ? '異常ログ: どこかの砲台にノイズが発生。'
        : '異常ログ: 大きな異常反応なし。',
      summary.scans.length > 0
        ? `スキャン: ${summary.scans.length}件実行。詳細は各パイロットの個別ログへ送信。`
        : 'スキャン: 実行なし。',
    ];
    summary.publicLogs = logs;
    this.state.roundLogs = logs;
    this.state.publicLogs.push(...logs);
  }

  private prepareBranch(): void {
    const condition = this.branchCondition();
    this.state.branchState.condition = condition;
    this.state.phase = 'branch';
    this.state.publicLogs.push(`中間作戦判定: ${branchConditionLabel(condition)}。作戦投票を開始します。`);
  }

  private allowedBranchPlans(): BranchPlan[] {
    if (this.state.branchState.condition === 'smooth') return ['normal', 'overdrive'];
    if (this.state.branchState.condition === 'hard') return ['normal', 'emergency'];
    return ['normal'];
  }

  private branchCondition(): BranchCondition {
    const bossRate = this.state.bossHp / this.state.bossMaxHp;
    const baseRate = this.state.baseHp / this.state.baseMaxHp;
    if (bossRate <= 0.4 && baseRate >= 0.5) return 'smooth';
    if (bossRate >= 0.66 || baseRate < 0.3) return 'hard';
    return 'normal';
  }

  private advanceRound(): void {
    this.state.round += 1;
    this.state.submittedActions = {};
    this.state.pleas = {};
    this.state.votes = {};
    this.state.branchVotes = {};
    this.state.roundLogs = [];
    this.state.players.forEach((player) => {
      player.lastAction = undefined;
      player.lastPlea = undefined;
      if (player.coinResult === 'success') {
        player.coinResult = 'unused';
      }
    });
    this.state.phase = 'action';
    this.state.publicLogs.push(`ROUND ${this.state.round} 開始。`);
  }

  private shouldFinish(): boolean {
    return this.state.baseHp <= 0 || this.state.bossHp <= 0 || this.state.round >= this.state.maxRounds;
  }

  private finishGame(finalVoteTargetId?: string): void {
    const bossDefeated = this.state.bossHp <= 0;
    const baseDestroyed = this.state.baseHp <= 0;
    const spy = this.spy();
    const spyBehindWin = bossDefeated && finalVoteTargetId !== spy.id;
    const winner = bossDefeated && !baseDestroyed && !spyBehindWin ? 'gunners' : 'spy';
    const history = this.state.history;
    const result: GameResult = {
      bossDefeated,
      baseDestroyed,
      winner,
      spyBehindWin,
      spyId: spy.id,
      finalVoteTargetId,
      sabotageCount: history.reduce((sum, round) => sum + round.sabotageCount, 0),
      bossHealingCount: spy.stats.bossHealing > 0 ? history.filter((round) => round.bossHealing > 0).length : 0,
      logScrambleCount: history.filter((round) => round.scrambleLog).length,
      suspiciousCoin: history.find((round) => round.suspiciousCoin)?.suspiciousCoin,
      awards: [],
    };
    result.awards = this.createAwards(result);
    this.state.result = result;
    this.state.phase = 'finished';
    this.state.publicLogs.push(
      result.winner === 'gunners'
        ? 'ボス撃破成功。砲台チーム勝利です。'
        : '作戦失敗。スパイ側の勝利です。',
    );
    if (result.spyBehindWin) {
      this.state.publicLogs.push('ただし、最終投票でスパイを当てられず、スパイ裏勝利が発生しました。');
    }
    this.state.publicLogs.push(`今回のスパイは ${spy.name} でした。`);
  }

  private createAwards(result: GameResult): Award[] {
    const awards: Award[] = [];
    const byStat = (stat: keyof PlayerStats) =>
      [...this.state.players].sort((a, b) => b.stats[stat] - a.stats[stat])[0];
    const bySuspicion = [...this.state.players].sort((a, b) => b.suspicion - a.suspicion)[0];
    const citizenBySuspicion = [...this.state.players]
      .filter((player) => player.role === 'gunner')
      .sort((a, b) => b.suspicion - a.suspicion)[0];
    const spy = this.spy();

    awards.push({
      title: 'MVP',
      playerId: byStat('damage').id,
      reason: '総ダメージが最大でした',
    });
    awards.push({
      title: '最大火力',
      playerId: byStat('damage').id,
      reason: 'ボスへの砲撃ダメージが最大でした',
    });
    awards.push({
      title: '最大回復',
      playerId: byStat('healing').id,
      reason: '拠点修理量が最大でした',
    });
    awards.push({
      title: '最大防御',
      playerId: byStat('mitigated').id,
      reason: '防御貢献が最大でした',
    });
    awards.push({
      title: '最大妨害',
      playerId: byStat('sabotage').id,
      reason: '妨害回数が最大でした',
    });
    awards.push({
      title: '一番疑われた人',
      playerId: bySuspicion.id,
      reason: `疑惑メーター ${bySuspicion.suspicion}`,
    });
    if (citizenBySuspicion) {
      awards.push({
        title: '冤罪賞',
        playerId: citizenBySuspicion.id,
        reason: '市民側で最も疑われました',
      });
    }
    awards.push({
      title: '裏MVP',
      playerId: spy.id,
      reason: result.winner === 'spy' ? 'スパイ側勝利に貢献しました' : '最後まで潜伏しました',
    });
    const robot = [...this.state.players].sort((a, b) => b.stats.robotContribution - a.stats.robotContribution)[0];
    if (robot.stats.robotContribution > 0) {
      awards.push({
        title: 'ロボット操縦賞',
        playerId: robot.id,
        reason: '自動砲台中の貢献が最大でした',
      });
    }
    return awards;
  }

  private assertPhase(phase: GameState['phase']): void {
    if (this.state.phase !== phase) {
      throw new Error(`Expected phase ${phase}, got ${this.state.phase}`);
    }
  }
}

export function requiresTarget(type: ActionType): boolean {
  return type === 'scan' || type === 'sabotage';
}

export function actionLabel(type: ActionType): string {
  return ACTION_LABELS[type];
}

export function scanResultLabel(result: ScanReport['result']): string {
  switch (result) {
    case 'clear':
      return '異常反応なし';
    case 'weak_signal':
      return '微弱な異常反応あり';
    case 'missing_log':
      return '砲台ログに不自然な欠落あり';
    case 'contradiction_possible':
      return '行動に矛盾の可能性あり';
    case 'unstable':
      return 'スキャン結果が不安定';
    default:
      return assertNever(result);
  }
}

export function branchPlanLabel(plan: BranchPlan): string {
  if (plan === 'overdrive') return 'オーバードライブ作戦';
  if (plan === 'emergency') return '緊急弱体化プロトコル';
  return '通常作戦';
}

export function branchConditionLabel(condition: BranchCondition): string {
  if (condition === 'smooth') return '順調';
  if (condition === 'hard') return '苦戦';
  return '普通';
}

function planPriority(plan: BranchPlan): number {
  if (plan === 'overdrive') return 0;
  if (plan === 'emergency') return 0;
  return 1;
}

function estimateRobotContribution(type: ActionType): number {
  if (type === 'normal_attack') return 2;
  if (type === 'charge_attack') return 3;
  if (type === 'defend' || type === 'repair') return 2;
  if (type === 'scan') return 1;
  return 1;
}

function pleaContradictsAction(plea: string, action?: ActionType): boolean {
  if (!action) return false;
  if (plea.includes('攻撃')) {
    return !['normal_attack', 'charge_attack', 'fake_attack'].includes(action);
  }
  if (plea.includes('回復')) return action !== 'repair' && action !== 'boss_heal';
  if (plea.includes('防御')) return action !== 'defend';
  if (plea.includes('スキャン')) return action !== 'scan';
  return false;
}

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}
