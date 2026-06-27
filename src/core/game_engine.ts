import {
  ACTION_BALANCE,
  ACTION_LABELS,
  BALANCE_BY_PLAYER_COUNT,
  BOSS_BALANCE,
  BOSS_DEFINITIONS,
  BRANCH_EFFECTS,
  CPU_PROFILES,
  DEFAULT_BOSS_ID,
  GUNNER_ACTIONS,
  PLAYER_LIMITS,
  PLAYER_NAMES,
  PARTY_ACTION_BALANCE,
  PARTY_ACTION_LABELS,
  PARTY_BOSS_ACTION_BALANCE,
  PARTY_GUNNER_ACTIONS,
  PARTY_RULES,
  PARTY_SPY_ACTIONS,
  SPY_ACTIONS,
} from '../data/constants';
import { createInferenceHints } from './inference';
import { changeSuspicion } from './suspicion';
import { clamp, SeededRandom, shuffle, weightedChoice } from './random';
import type {
  ActionSubmission,
  ActionType,
  Award,
  BossActionPlan,
  BossActionType,
  BossDefinition,
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
  ScanResult,
  SuspiciousCoinEvent,
  VoteSubmission,
} from './types';

const createStats = (): PlayerStats => ({
  damage: 0,
  healing: 0,
  mitigated: 0,
  sabotage: 0,
  sabotageAttack: 0,
  sabotageDefense: 0,
  sabotageRepair: 0,
  bossSyncedSabotage: 0,
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
    const allowedActions = this.availableActions(player.id);
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
    if (this.state.mode === 'party') {
      throw new Error('Suspicious coin is only available in Advanced Mode');
    }
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
    if (this.state.mode === 'party') {
      return this.resolvePartyActions();
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
      evidence: [],
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

    this.addMonitoredEvidence(summary);
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
    this.prepareInferenceHintsIfFinalVote();
  }

  resolveVotes(): void {
    this.assertPhase('vote');
    const missing = this.state.players.filter((player) => !this.state.votes[player.id]);
    if (missing.length > 0) {
      throw new Error(`Missing votes: ${missing.map((player) => player.name).join(', ')}`);
    }
    if (this.state.mode === 'party') {
      this.resolvePartyVotes();
      return;
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
    if (this.state.mode === 'party') {
      return player.role === 'spy' ? PARTY_SPY_ACTIONS : PARTY_GUNNER_ACTIONS;
    }
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

    const mode = options.mode ?? 'advanced';
    const balance = BALANCE_BY_PLAYER_COUNT[options.totalPlayers];
    const boss = this.bossDefinition(options.bossId);
    const playerCount = options.totalPlayers as 4 | 5 | 6;
    const bossMaxHp = mode === 'party'
      ? boss.maxHpByPlayerCount[playerCount]
      : balance.bossHp;
    const baseMaxHp = mode === 'party' ? PARTY_RULES.baseHp : balance.baseHp;
    const maxRounds = mode === 'party' ? PARTY_RULES.rounds : balance.rounds;
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
    const currentBossAction = mode === 'party'
      ? this.selectBossActionPlan(boss, players)
      : { type: 'normal_attack' as const };

    return {
      mode,
      phase: 'action',
      round: 1,
      maxRounds,
      players,
      boss,
      currentBossAction,
      bossHp: bossMaxHp,
      bossMaxHp,
      baseHp: baseMaxHp,
      baseMaxHp,
      submittedActions: {},
      pleas: {},
      votes: {},
      branchVotes: {},
      roundLogs: [],
      publicLogs: mode === 'party'
        ? [
          `${boss.name}出現。全砲台、起動してください。`,
          this.partyBossForecastLog(currentBossAction, players),
        ]
        : ['ボス出現。全砲台、起動してください。'],
      privateLogs: Object.fromEntries(players.map((player) => [player.id, []])),
      debugLogs: [],
      inferenceHints: [],
      branchState: {
        plan: 'normal',
        resolved: false,
      },
      history: [],
    };
  }

  private bossDefinition(bossId = DEFAULT_BOSS_ID): BossDefinition {
    const boss = BOSS_DEFINITIONS[bossId];
    if (!boss) {
      throw new Error(`Unknown boss definition: ${bossId}`);
    }
    return boss;
  }

  private selectBossActionPlan(boss: BossDefinition, players: Player[]): BossActionPlan {
    const type = weightedChoice(
      Object.entries(boss.actionWeights).map(([value, weight]) => ({
        value: value as BossActionType,
        weight: weight ?? 0,
      })),
      this.rng,
    );
    if (type !== 'target_lock') {
      return { type };
    }
    return {
      type,
      targetPlayerId: players[Math.floor(this.rng.next() * players.length)]?.id,
    };
  }

  private resolvePartyActions(): RoundSummary {
    const summary: RoundSummary = {
      round: this.state.round,
      bossAction: this.state.currentBossAction,
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
      evidence: [],
    };
    this.state.history.push(summary);
    this.state.debugLogs.push(
      `[debug] party round ${this.state.round} boss action: ${this.state.currentBossAction.type}`
      + `${this.state.currentBossAction.targetPlayerId ? `->${this.state.currentBossAction.targetPlayerId}` : ''}`,
    );
    this.state.debugLogs.push(
      `[debug] round ${this.state.round} submitted actions: ${Object.values(this.state.submittedActions)
        .map((action) => `${action.playerId}:${action.type}${action.targetId ? `->${action.targetId}` : ''}`)
        .join(', ')}`,
    );

    const sabotagedTargets = this.collectSabotageTargets(summary);
    const defenders: string[] = [];
    let pendingBossDamage = 0;
    let pendingBossHealing = 0;

    for (const action of Object.values(this.state.submittedActions)) {
      const player = this.getPlayer(action.playerId);
      player.lastAction = action.type;
      const sabotaged = sabotagedTargets.has(player.id);

      switch (action.type) {
        case 'normal_attack': {
          const damage = this.partyActionValue(PARTY_ACTION_BALANCE.attackDamage, sabotaged);
          pendingBossDamage += damage;
          player.stats.damage += damage;
          summary.totalDamage += damage;
          break;
        }
        case 'fake_attack': {
          const damage = this.partyActionValue(PARTY_ACTION_BALANCE.weakAttackDamage, sabotaged);
          pendingBossDamage += damage;
          player.stats.damage += damage;
          summary.totalDamage += damage;
          break;
        }
        case 'defend':
          defenders.push(player.id);
          summary.defenseCount += 1;
          break;
        case 'repair': {
          const amount = sabotaged
            ? PARTY_ACTION_BALANCE.sabotagedRepairAmount
            : PARTY_ACTION_BALANCE.repairAmount;
          const healed = this.healBase(amount);
          player.stats.healing += healed;
          summary.repairs += healed;
          break;
        }
        case 'boss_heal': {
          pendingBossHealing += PARTY_ACTION_BALANCE.spyBossHealAmount;
          player.stats.bossHealing += PARTY_ACTION_BALANCE.spyBossHealAmount;
          break;
        }
        case 'sabotage':
          break;
        case 'charge_attack':
        case 'scan':
        case 'scramble_log':
          throw new Error(`${action.type} is not available in Party Mode`);
        default:
          assertNever(action.type);
      }

      if (!player.isConnected) {
        player.stats.robotContribution += estimateRobotContribution(action.type);
      }
    }

    const beforeBossHp = this.state.bossHp;
    this.state.bossHp = clamp(
      this.state.bossHp - pendingBossDamage + pendingBossHealing,
      0,
      this.state.bossMaxHp,
    );
    summary.bossHealing += Math.max(0, this.state.bossHp - Math.max(0, beforeBossHp - pendingBossDamage));

    const bossEventLog = this.state.bossHp <= 0
      ? 'ボスを撃破！砲台の勝ちどきが響きました。'
      : this.resolvePartyBossAction(summary, defenders, sabotagedTargets);
    this.writePartyRoundLogs(summary, bossEventLog);

    if (this.shouldFinish()) {
      this.state.phase = 'vote';
      this.state.publicLogs.push('ボス戦終了。最後にスパイ予想を投票してください。');
      return summary;
    }

    this.advanceRound();
    return summary;
  }

  private resolvePartyBossAction(
    summary: RoundSummary,
    defenders: string[],
    sabotagedTargets: Set<string>,
  ): string {
    const action = this.state.currentBossAction;
    switch (action.type) {
      case 'normal_attack': {
        const damage = this.damageBase(PARTY_BOSS_ACTION_BALANCE.normalAttackDamage);
        summary.baseDamage += damage;
        return `ボスの通常攻撃！拠点に${damage}ダメージ。`;
      }
      case 'big_charge': {
        const guarded = defenders.length > 0;
        const noisyGuard = guarded && defenders.every((id) => sabotagedTargets.has(id));
        const damage = this.damageBase(
          guarded
            ? noisyGuard
              ? PARTY_BOSS_ACTION_BALANCE.bigChargeNoisyGuardDamage
              : PARTY_BOSS_ACTION_BALANCE.bigChargeGuardedDamage
            : PARTY_BOSS_ACTION_BALANCE.bigChargeDamage,
        );
        summary.baseDamage += damage;
        this.addMitigationStats(defenders, PARTY_BOSS_ACTION_BALANCE.bigChargeDamage - damage);
        if (!guarded) return `大技が直撃！拠点に${damage}ダメージ。`;
        if (noisyGuard) return `バリアにノイズ発生！大技を少しだけ軽減しました。`;
        return 'バリア成功！大技ダメージを半分にしました。';
      }
      case 'armor_regen': {
        const playerCount = this.state.players.length as 4 | 5 | 6;
        const threshold = PARTY_BOSS_ACTION_BALANCE.armorRegenBlockThresholdByPlayerCount[playerCount];
        if (summary.totalDamage >= threshold) {
          return '集中砲火成功！装甲再生を止めました。';
        }
        const healed = this.healBoss(PARTY_BOSS_ACTION_BALANCE.armorRegenHeal);
        summary.bossHealing += healed;
        return healed > 0
          ? `火力不足！ボスの装甲が${healed}回復。`
          : '火力不足！しかしボスの装甲は限界でした。';
      }
      case 'target_lock': {
        const target = action.targetPlayerId ? this.getPlayer(action.targetPlayerId) : undefined;
        const targetGuarded = target ? defenders.includes(target.id) : false;
        const noisyGuard = Boolean(target && targetGuarded && sabotagedTargets.has(target.id));
        const damage = this.damageBase(
          targetGuarded
            ? noisyGuard
              ? PARTY_BOSS_ACTION_BALANCE.targetLockNoisyGuardDamage
              : PARTY_BOSS_ACTION_BALANCE.targetLockGuardedDamage
            : PARTY_BOSS_ACTION_BALANCE.targetLockDamage,
        );
        summary.baseDamage += damage;
        this.addMitigationStats(targetGuarded && target ? [target.id] : [], PARTY_BOSS_ACTION_BALANCE.targetLockDamage - damage);
        if (!target) return `狙い撃ち！拠点に${damage}ダメージ。`;
        if (!targetGuarded) return `${target.name}周辺に直撃！拠点に${damage}ダメージ。`;
        if (noisyGuard) return `${target.name}のバリアにノイズ！被害を少し軽減しました。`;
        return `${target.name}が回避バリア！ダメージを大きく軽減しました。`;
      }
      default:
        return assertNever(action.type);
    }
  }

  private resolvePartyVotes(): void {
    const voteCounts: Record<string, number> = {};
    for (const vote of Object.values(this.state.votes)) {
      this.getPlayer(vote.voterId);
      const target = this.getPlayer(vote.targetId);
      voteCounts[target.id] = (voteCounts[target.id] ?? 0) + 1;
    }
    const topTargetId = Object.entries(voteCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    const summary = this.currentSummary();
    summary.votes = voteCounts;
    this.state.publicLogs.push(
      `おまけ投票: ${Object.entries(voteCounts)
        .map(([playerId, count]) => `${this.getPlayer(playerId).name} ${count}票`)
        .join(' / ')}`,
    );
    this.finishGame(topTargetId);
  }

  private partyActionValue(baseValue: number, sabotaged: boolean): number {
    return Math.round(baseValue * (sabotaged ? PARTY_ACTION_BALANCE.sabotageMultiplier : 1));
  }

  private damageBase(amount: number): number {
    const before = this.state.baseHp;
    this.state.baseHp = clamp(this.state.baseHp - amount, 0, this.state.baseMaxHp);
    return before - this.state.baseHp;
  }

  private addMitigationStats(defenderIds: string[], mitigated: number): void {
    if (defenderIds.length === 0 || mitigated <= 0) return;
    const perDefender = Math.max(1, Math.round(mitigated / defenderIds.length));
    for (const defenderId of defenderIds) {
      this.getPlayer(defenderId).stats.mitigated += perDefender;
    }
  }

  private writePartyRoundLogs(summary: RoundSummary, bossEventLog: string): void {
    const netDamage = Math.max(0, summary.totalDamage - summary.bossHealing);
    const attackLog = netDamage >= 180
      ? `ボスに大ダメージ！実質${netDamage}ダメージ。`
      : netDamage > 0
        ? `ボスに${netDamage}ダメージ。`
        : 'ボスへの有効打は少なめでした。';
    const repairLog = summary.repairs > 0
      ? `拠点を${summary.repairs}修理。残り耐久${this.state.baseHp}。`
      : `拠点耐久は残り${this.state.baseHp}。`;
    const logs = [
      `第${summary.round}ラウンド: ${bossActionLabel(this.state.currentBossAction.type)}。${
        summary.sabotageCount > 0 ? 'どこかにノイズ。' : ''
      }`,
      attackLog,
      bossEventLog,
      repairLog,
    ];
    summary.publicLogs = logs;
    this.state.roundLogs = logs;
    this.state.publicLogs.push(...logs);
  }

  private partyBossForecastLog(plan: BossActionPlan, players = this.state.players): string {
    if (plan.type === 'target_lock' && plan.targetPlayerId) {
      const target = players.find((player) => player.id === plan.targetPlayerId);
      return `ボス予告: ${target?.name ?? 'どこかの砲台'}を狙っています。`;
    }
    return `ボス予告: ${bossForecastLabel(plan.type)}`;
  }

  private collectSabotageTargets(summary: RoundSummary): Set<string> {
    const sabotagedTargets = new Set<string>();
    for (const action of Object.values(this.state.submittedActions)) {
      if (action.type !== 'sabotage' || !action.targetId) continue;
      sabotagedTargets.add(action.targetId);
      summary.sabotageCount += 1;
      const spy = this.getPlayer(action.playerId);
      const target = this.getPlayer(action.targetId);
      const targetAction = this.state.submittedActions[target.id]?.type;
      if (this.state.mode === 'party') {
        this.writePartySabotageFeedback(spy, target, targetAction);
      } else {
        this.state.privateLogs[target.id].push('外部ノイズにより行動効率が低下しました。');
      }
      this.state.debugLogs.push(`[debug] sabotage target: ${spy.name} -> ${target.name}`);
      spy.stats.sabotage += 1;
    }
    return sabotagedTargets;
  }

  private writePartySabotageFeedback(
    spy: Player,
    target: Player,
    targetAction?: ActionType,
  ): void {
    this.recordPartySabotageStats(spy, targetAction);
    const combo = this.partySabotageCombo(targetAction);
    const targetActionLabel = targetAction ? actionLabel(targetAction, 'party') : '行動';
    const targetLog = combo?.targetLog ?? partySabotageTargetLog(targetAction);
    const spyLog = combo?.spyLog ?? `妨害成功: ${target.name}の${targetActionLabel}を乱しました。`;

    this.state.privateLogs[target.id].push(`あなたが邪魔されました。${targetLog}`);
    this.state.privateLogs[spy.id].push(spyLog);
  }

  private recordPartySabotageStats(spy: Player, targetAction?: ActionType): void {
    if (targetAction === 'normal_attack' || targetAction === 'fake_attack' || targetAction === 'charge_attack') {
      spy.stats.sabotageAttack += 1;
      return;
    }
    if (targetAction === 'defend') {
      spy.stats.sabotageDefense += 1;
      return;
    }
    if (targetAction === 'repair') {
      spy.stats.sabotageRepair += 1;
    }
  }

  private partySabotageCombo(targetAction?: ActionType): { targetLog: string; spyLog: string } | undefined {
    const bossAction = this.state.currentBossAction.type;
    if (bossAction === 'big_charge' && targetAction === 'defend') {
      this.spy().stats.bossSyncedSabotage += 1;
      return {
        targetLog: '大技の直前にバリアへノイズ。防御効果が弱まっています。',
        spyLog: '妨害成功: 大技チャージ中のバリアを崩しました。',
      };
    }
    if (bossAction === 'armor_regen' && (targetAction === 'normal_attack' || targetAction === 'fake_attack')) {
      this.spy().stats.bossSyncedSabotage += 1;
      return {
        targetLog: '砲身がブレました。装甲再生を止める火力が出にくくなっています。',
        spyLog: '妨害成功: 装甲再生中の火力を落としました。',
      };
    }
    if (this.state.baseHp <= 35 && targetAction === 'repair') {
      this.spy().stats.bossSyncedSabotage += 1;
      return {
        targetLog: '修理アームが一瞬停止。拠点ピンチで回復量が少なくなっています。',
        spyLog: '妨害成功: 拠点ピンチの修理を止めました。',
      };
    }
    return undefined;
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
    let result: ScanResult;
    if (sabotaged) {
      result = 'unstable';
    } else if (target.role === 'spy') {
      result = roll < 0.35 ? 'strong_signal' : roll < 0.82 ? 'weak_noise' : 'clear';
    } else {
      result = roll < 0.78 ? 'clear' : roll < 0.95 ? 'weak_noise' : 'strong_signal';
    }

    if (result === 'clear') changeSuspicion(target, -1);
    if (result === 'weak_noise') changeSuspicion(target, 1);
    if (result === 'strong_signal') changeSuspicion(target, 3);

    this.addScanEvidence(this.currentSummary(), target.id, result);

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

  private addMonitoredEvidence(summary: RoundSummary): void {
    const monitoredId = this.state.monitoredPlayerId;
    if (!monitoredId) return;
    const action = this.state.submittedActions[monitoredId];
    if (!action) return;
    const monitored = this.getPlayer(monitoredId);

    if (action.type === 'boss_heal') {
      summary.monitoredHint = '監視対象ログ: 監視中の砲台周辺で、ボス反応と同期する強い異常反応。';
      summary.evidence.push({
        playerId: monitoredId,
        round: summary.round,
        kind: 'monitored_noise',
        weight: 4,
        reason: 'ボス回復ラウンドで監視対象周辺に強い異常反応',
      });
      return;
    }

    if (action.type === 'sabotage') {
      summary.monitoredHint = '監視対象ログ: 監視中の砲台付近から、外部ノイズに近い反応。';
      summary.evidence.push({
        playerId: monitoredId,
        round: summary.round,
        kind: 'monitored_noise',
        weight: 3,
        reason: '妨害発生ラウンドで監視対象付近に外部ノイズ',
      });
      return;
    }

    if (action.type === 'fake_attack') {
      summary.monitoredHint = '監視対象ログ: 監視中の砲台の出力が、攻撃ログと少しズレています。';
      summary.evidence.push({
        playerId: monitoredId,
        round: summary.round,
        kind: 'monitored_mismatch',
        weight: 2,
        reason: '攻撃宣言と火力ログにズレあり',
      });
      return;
    }

    if (action.type === 'scramble_log') {
      summary.monitoredHint = '監視対象ログ: 監視中の砲台周辺で、作戦ログの欠落反応。';
      summary.evidence.push({
        playerId: monitoredId,
        round: summary.round,
        kind: 'monitored_noise',
        weight: 3,
        reason: '監視対象周辺で作戦ログの欠落反応',
      });
      return;
    }

    if (['normal_attack', 'charge_attack', 'defend', 'repair'].includes(action.type)) {
      summary.evidence.push({
        playerId: monitoredId,
        round: summary.round,
        kind: 'monitored_clear',
        weight: -1,
        reason: `${monitored.name}は監視中に明確な貢献ログあり`,
      });
    }
  }

  private addScanEvidence(summary: RoundSummary, targetId: string, result: ScanResult): void {
    const target = this.getPlayer(targetId);
    if (result === 'clear') {
      summary.evidence.push({
        playerId: targetId,
        round: summary.round,
        kind: 'scan_clear',
        weight: -1,
        reason: `${target.name}に異常なしのスキャン結果`,
      });
    }
    if (result === 'weak_noise') {
      summary.evidence.push({
        playerId: targetId,
        round: summary.round,
        kind: 'scan_weak_noise',
        weight: 2,
        reason: `${target.name}に微弱なノイズのスキャン結果`,
      });
    }
    if (result === 'strong_signal') {
      summary.evidence.push({
        playerId: targetId,
        round: summary.round,
        kind: 'scan_strong_signal',
        weight: 4,
        reason: `${target.name}に強い異常反応のスキャン結果`,
      });
    }
  }

  private writeRoundLogs(summary: RoundSummary): void {
    const anomalyLog = summary.monitoredHint
      ?? (summary.sabotageCount > 0 || summary.scrambleLog
        ? '異常ログ: どこかの砲台にノイズが発生。'
        : '異常ログ: 大きな異常反応なし。');
    const logs = [
      summary.scrambleLog
        ? `第${summary.round}ラウンド結果: ボスへの損傷ログが不安定です。`
        : `第${summary.round}ラウンド結果: ボスに合計${summary.totalDamage}ダメージ。`,
      summary.bossHealing > 0
        ? `ボス反応: ${summary.bossHealing}の謎の回復反応を検出。`
        : 'ボス反応: 回復反応なし。',
      `拠点状況: ${summary.baseDamage}ダメージ${summary.repairs > 0 ? ` / ${summary.repairs}修理` : ''}${summary.defenseCount > 0 ? ' / 防御展開' : ''}。`,
      anomalyLog,
      summary.scans.length > 0
        ? `スキャン: ${summary.scans.length}件実行。詳細は各パイロットの個別ログへ送信。`
        : 'スキャン: 実行なし。',
    ];
    summary.publicLogs = logs;
    this.state.roundLogs = logs;
    this.state.publicLogs.push(...logs);
  }

  private prepareInferenceHintsIfFinalVote(): void {
    if (!this.shouldFinish()) return;
    this.state.inferenceHints = createInferenceHints(this.state, 3);
    this.state.publicLogs.push('最終推理ヒント: 疑惑上位3候補を確認してください。');
    for (const hint of this.state.inferenceHints) {
      this.state.publicLogs.push(`${this.getPlayer(hint.playerId).name}: ${hint.reason}`);
    }
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
    if (this.state.mode === 'party') {
      this.state.currentBossAction = this.selectBossActionPlan(this.state.boss, this.state.players);
      this.state.publicLogs.push(this.partyBossForecastLog(this.state.currentBossAction));
    }
  }

  private shouldFinish(): boolean {
    return this.state.baseHp <= 0 || this.state.bossHp <= 0 || this.state.round >= this.state.maxRounds;
  }

  private finishGame(finalVoteTargetId?: string): void {
    const bossDefeated = this.state.bossHp <= 0;
    const baseDestroyed = this.state.baseHp <= 0;
    const spy = this.spy();
    const spyBehindWin = this.state.mode === 'advanced' && bossDefeated && finalVoteTargetId !== spy.id;
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
      bossHealingCount: this.state.mode === 'party'
        ? history.filter((round) => round.bossHealing > 0).length
        : spy.stats.bossHealing > 0
          ? history.filter((round) => round.bossHealing > 0).length
          : 0,
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
    if (this.state.mode === 'party' && result.finalVoteTargetId) {
      this.state.publicLogs.push(
        result.finalVoteTargetId === spy.id
          ? 'おまけ投票成功。砲台チームに名探偵砲台ボーナスです。'
          : 'おまけ投票失敗。スパイに潜伏成功称号です。',
      );
    }
    this.state.publicLogs.push(`今回のスパイは ${spy.name} でした。`);
  }

  private createAwards(result: GameResult): Award[] {
    if (this.state.mode === 'party') {
      return this.createPartyAwards(result);
    }

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

  private createPartyAwards(result: GameResult): Award[] {
    const awards: Award[] = [];
    const byStat = (stat: keyof PlayerStats) =>
      [...this.state.players].sort((a, b) => b.stats[stat] - a.stats[stat])[0];
    const spy = this.spy();

    awards.push({
      title: 'MVP',
      playerId: byStat('damage').id,
      reason: 'ボスへの砲撃ダメージが最大でした',
    });
    awards.push({
      title: '守護砲台',
      playerId: byStat('mitigated').id,
      reason: 'ボス攻撃の軽減に貢献しました',
    });
    awards.push({
      title: '整備名人',
      playerId: byStat('healing').id,
      reason: '拠点修理量が最大でした',
    });
    if (spy.stats.sabotage > 0) {
      awards.push({
        title: '妨害職人',
        playerId: spy.id,
        reason: `${spy.stats.sabotage}回の妨害で場を揺らしました`,
      });
    }
    if (spy.stats.sabotageDefense > 0) {
      awards.push({
        title: 'バリアクラッシャー',
        playerId: spy.id,
        reason: `${spy.stats.sabotageDefense}回、防御役のバリアを乱しました`,
      });
    }
    if (spy.stats.sabotageAttack > 0) {
      awards.push({
        title: '火力泥棒',
        playerId: spy.id,
        reason: `${spy.stats.sabotageAttack}回、砲撃出力を落としました`,
      });
    }
    if (spy.stats.sabotageRepair > 0) {
      awards.push({
        title: '修理止めの名人',
        playerId: spy.id,
        reason: `${spy.stats.sabotageRepair}回、修理アームを止めました`,
      });
    }
    awards.push({
      title: result.finalVoteTargetId === spy.id ? '名探偵砲台' : '潜伏成功',
      playerId: result.finalVoteTargetId === spy.id
        ? (this.state.players.find((player) => player.role === 'gunner')?.id ?? spy.id)
        : spy.id,
      reason: result.finalVoteTargetId === spy.id
        ? 'おまけ投票でスパイを当てました'
        : 'おまけ投票をかわしました',
    });
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

export function actionLabel(type: ActionType, mode: GameState['mode'] = 'advanced'): string {
  if (mode === 'party' && PARTY_ACTION_LABELS[type]) {
    return PARTY_ACTION_LABELS[type];
  }
  return ACTION_LABELS[type];
}

export function bossActionLabel(type: BossActionType): string {
  if (type === 'normal_attack') return '通常攻撃';
  if (type === 'big_charge') return '大技チャージ';
  if (type === 'armor_regen') return '装甲再生';
  if (type === 'target_lock') return '狙い撃ち';
  return assertNever(type);
}

export function bossForecastLabel(type: BossActionType): string {
  if (type === 'normal_attack') return 'ボスの通常攻撃が来ます。';
  if (type === 'big_charge') return 'ボスが大技を準備しています。';
  if (type === 'armor_regen') return 'ボスの装甲が再生しはじめています。';
  if (type === 'target_lock') return 'ボスが狙い撃ちの対象を探しています。';
  return assertNever(type);
}

export function scanResultLabel(result: ScanReport['result']): string {
  switch (result) {
    case 'clear':
      return '異常なし';
    case 'weak_noise':
      return '微弱なノイズ';
    case 'strong_signal':
      return '強い異常反応';
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

function partySabotageTargetLog(targetAction?: ActionType): string {
  if (targetAction === 'normal_attack' || targetAction === 'fake_attack' || targetAction === 'charge_attack') {
    return '砲身がブレました。攻撃出力が下がっています。';
  }
  if (targetAction === 'defend') {
    return 'バリアにノイズ。防御効果が弱まっています。';
  }
  if (targetAction === 'repair') {
    return '修理アームが一瞬停止。回復量が少なくなっています。';
  }
  return '操作系にノイズ。行動が少し弱まりました。';
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
