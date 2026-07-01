import { GameEngine } from '../core/game_engine';
import type { ActionSubmission, ActionType, BranchPlan } from '../core/types';
import { fillCpuActions, fillCpuBranchVotes, fillCpuPleas, fillCpuVotes } from '../cpu/autoplay';
import { parseLocalRoute } from '../screens/local_routes';
import { INITIAL_ALPHA_SEED, nextAlphaSeed } from '../screens/alpha_seed';
import { PUBLIC_ALPHA_ENTRY } from '../screens/public_alpha_content';
import { createHostScreenViewModel, createPlayerScreenViewModel, type PlayerScreenViewModel } from '../screens/screen_view_models';
import { runAlphaPreflight } from './alpha_preflight';

export interface M5PublicAlphaPreflightOptions {
  games?: number;
  seed?: number;
}

export interface M5PublicAlphaCheck {
  id: string;
  label: string;
  target: string;
  observed: string;
  passed: boolean;
}

export interface M5SoloFlowTrace {
  phase: string;
  instruction: string;
  action: string;
  round: number;
}

export interface M5PublicAlphaPreflightReport {
  status: 'pass' | 'fail';
  seed: number;
  games: number;
  checks: M5PublicAlphaCheck[];
  blockers: string[];
  soloTrace: M5SoloFlowTrace[];
  notes: string[];
}

const DEFAULT_GAMES = 100;
const REQUIRED_ENTRY_TERMS = [
  'Public Alpha v0.1',
  'スマホ',
  '5分',
  '通信スパイ',
  'CPU4基同期',
  'Boardなし',
  'この端末で開始',
];
const SPY_ONLY_LABELS = ['弱く撃つ', '邪魔する', 'ボスを助ける'];

export function runM5PublicAlphaPreflight(options: M5PublicAlphaPreflightOptions = {}): M5PublicAlphaPreflightReport {
  const seed = options.seed ?? INITIAL_ALPHA_SEED;
  const games = options.games ?? DEFAULT_GAMES;
  const solo = runSoloAlphaFlow(seed);
  const checks = [
    evaluateEntryContent(),
    evaluateRouteContract(),
    evaluateInitialGuidance(seed),
    evaluatePrivacyContract(seed),
    evaluateSoloCompletion(solo),
    evaluateResultAndRematch(seed, solo),
    evaluateM4RegressionGates(games, seed),
  ];
  const blockers = checks.filter((check) => !check.passed).map((check) => check.label);

  return {
    status: blockers.length === 0 ? 'pass' : 'fail',
    seed,
    games,
    checks,
    blockers,
    soloTrace: solo.trace,
    notes: [
      'M5 Public Alpha Preflightは、人間の追加スモークチェックをAIで代替するための導線・表示・完走ゲートである。',
      '面白さやワクワク感そのものは人間の感情実測ではないため、入口の明確さ、操作可能性、結果/再戦の可視性に置き換えて判定する。',
      'M4 AI Alpha Preflightの数値・秘密情報ゲートも同時に通すことで、M5の公開Alpha入口が既存品質を落としていないことを確認する。',
    ],
  };
}

export function formatM5PublicAlphaPreflightMarkdown(
  report: M5PublicAlphaPreflightReport,
  options: { date?: string; command?: string } = {},
): string {
  const statusLabel = report.status === 'pass' ? 'PASS' : 'FAIL';
  const command = options.command ?? 'npm run playtest:m5';
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const lines = [
    '# M5 Public Alpha AI Preflight',
    '',
    `ステータス: ${statusLabel}`,
    `作成日: ${date}`,
    `コマンド: \`${command}\``,
    '',
    'このレポートは、M5/Public Alpha v0.1準備の人間スモーク確認項目をAIで代替確認するための証跡である。',
    '主観的な「面白さ」は直接測らず、初見入口、次操作、秘密情報、ソロ完走、結果/再戦、既存Alpha品質ゲートを検査する。',
    '',
    '## サマリー',
    '',
    `- Seed: ${report.seed}`,
    `- M4回帰シミュレーション: ${report.games}ゲーム`,
    `- ゲート数: ${report.checks.length}`,
    `- ブロッカー: ${report.blockers.length === 0 ? 'なし' : report.blockers.join(', ')}`,
    '',
    '## ゲート',
    '',
    '| 判定 | 項目 | 目標 | 実測 |',
    '| --- | --- | --- | --- |',
    ...report.checks.map((check) => `| ${check.passed ? 'OK' : 'NG'} | ${check.label} | ${check.target} | ${check.observed} |`),
    '',
    '## ソロAlpha操作トレース',
    '',
    '| Round | Phase | Instruction | AI操作 |',
    '| ---: | --- | --- | --- |',
    ...report.soloTrace.map((step) => `| ${step.round} | ${step.phase} | ${step.instruction} | ${step.action} |`),
    '',
    '## ブロッカー',
    '',
    report.blockers.length === 0
      ? '- なし'
      : report.blockers.map((blocker) => `- ${blocker}`).join('\n'),
    '',
    '## メモ',
    '',
    ...report.notes.map((note) => `- ${note}`),
  ];
  return lines.join('\n');
}

function evaluateEntryContent(): M5PublicAlphaCheck {
  const copy = [
    PUBLIC_ALPHA_ENTRY.kicker,
    ...PUBLIC_ALPHA_ENTRY.headlineLines,
    PUBLIC_ALPHA_ENTRY.body,
    PUBLIC_ALPHA_ENTRY.primaryCta,
    PUBLIC_ALPHA_ENTRY.boardCta,
    ...PUBLIC_ALPHA_ENTRY.routeActions,
    ...PUBLIC_ALPHA_ENTRY.highlights.flatMap((highlight) => [highlight.label, highlight.value]),
  ].join(' ');
  const missing = REQUIRED_ENTRY_TERMS.filter((term) => !copy.includes(term));
  return check({
    id: 'entry_content',
    label: '初見入口コピー',
    target: 'Alpha版、スマホ、短時間、ソロ開始、CPU同期、Board任意が入口で分かる',
    observed: missing.length === 0 ? '必要語句をすべて含む' : `不足: ${missing.join(', ')}`,
    passed: missing.length === 0,
  });
}

function evaluateRouteContract(): M5PublicAlphaCheck {
  const routes = {
    '/': parseLocalRoute('/').view,
    '/board': parseLocalRoute('/board').view,
    '/player/p1': parseLocalRoute('/player/p1').view,
    '/dev': parseLocalRoute('/dev').view,
    '/debug': parseLocalRoute('/debug').view,
  };
  const passed = routes['/'] === 'alpha'
    && routes['/board'] === 'board'
    && routes['/player/p1'] === 'player'
    && routes['/dev'] === 'split'
    && routes['/debug'] === 'debug';
  return check({
    id: 'route_contract',
    label: 'Public Alphaルート契約',
    target: '`/` が主入口、Board/Player/Dev/Debugが補助導線として残る',
    observed: Object.entries(routes).map(([path, view]) => `${path}:${view}`).join(' / '),
    passed,
  });
}

function evaluateInitialGuidance(seed: number): M5PublicAlphaCheck {
  const engine = new GameEngine({ totalPlayers: 5, humanPlayers: 1, seed, spyId: 'p5', mode: 'party' });
  const hostView = createHostScreenViewModel(engine);
  const playerView = createPlayerScreenViewModel(engine, 'p1');
  const labels = playerView.availableActions.map((action) => action.label);
  const helps = playerView.availableActions.map((action) => action.help).filter(Boolean);
  const passed = playerView.phaseInstruction.includes('行動')
    && hostView.board.flowTitle.length > 0
    && hostView.board.flowBody.length > 0
    && hostView.board.bossActionForecast.length > 0
    && ['撃つ', '守る', '直す'].every((label) => labels.includes(label))
    && helps.length === playerView.availableActions.length
    && !SPY_ONLY_LABELS.some((label) => labels.includes(label));
  return check({
    id: 'initial_guidance',
    label: 'Player端末の次操作ガイド',
    target: '通常プレイヤーが行動・ボス予告・基本3行動・ヘルプ文を見て次操作を選べる',
    observed: `instruction=${playerView.phaseInstruction} / board=${hostView.board.flowTitle} / actions=${labels.join(', ')}`,
    passed,
  });
}

function evaluatePrivacyContract(seed: number): M5PublicAlphaCheck {
  const engine = new GameEngine({ totalPlayers: 5, humanPlayers: 1, seed, spyId: 'p5', mode: 'party' });
  engine.state.privateLogs.p5.push('スパイだけの個別ログ。ボスを助ける準備。');
  engine.state.debugLogs.push('[debug] spy=p5 secret action=boss_heal');
  const hostView = createHostScreenViewModel(engine);
  const gunnerView = createPlayerScreenViewModel(engine, 'p1');
  const spyView = createPlayerScreenViewModel(engine, 'p5');
  const hostSerialized = JSON.stringify(hostView);
  const gunnerLabels = gunnerView.availableActions.map((action) => action.label);
  const spyLabels = spyView.availableActions.map((action) => action.label);
  const hostForbidden = [
    'スパイ',
    'スパイだけ',
    'ボスを助ける',
    '弱く撃つ',
    '邪魔する',
    '[debug]',
    'boss_heal',
  ].filter((term) => hostSerialized.includes(term));
  const gunnerForbidden = SPY_ONLY_LABELS.filter((label) => gunnerLabels.includes(label));
  const spyMissing = SPY_ONLY_LABELS.filter((label) => !spyLabels.includes(label));
  const passed = hostForbidden.length === 0
    && gunnerForbidden.length === 0
    && spyMissing.length === 0
    && hostView.players.every((player) => player.role === '非公開');
  return check({
    id: 'privacy_contract',
    label: '秘密情報ガード',
    target: 'Boardと通常端末にスパイ専用情報が漏れず、スパイ端末だけに裏行動が出る',
    observed: passed
      ? '漏えい検出なし'
      : `host=${hostForbidden.join(', ') || 'なし'} / gunner=${gunnerForbidden.join(', ') || 'なし'} / spyMissing=${spyMissing.join(', ') || 'なし'}`,
    passed,
  });
}

function evaluateSoloCompletion(solo: SoloAlphaFlow): M5PublicAlphaCheck {
  const passed = solo.finished
    && solo.voteSeen
    && solo.resultAwards >= 4
    && solo.finalView.result?.spyName
    && solo.trace.length > 0
    && solo.trace.length <= 12;
  return check({
    id: 'solo_completion',
    label: 'Boardなしソロ完走',
    target: 'p1 AIユーザー + CPU4基でスパイ予想と結果まで到達する',
    observed: `finished=${solo.finished} / voteSeen=${solo.voteSeen} / steps=${solo.trace.length} / awards=${solo.resultAwards}`,
    passed: Boolean(passed),
  });
}

function evaluateResultAndRematch(seed: number, solo: SoloAlphaFlow): M5PublicAlphaCheck {
  const rematchSeed = nextAlphaSeed(seed);
  const rematch = new GameEngine({ totalPlayers: 5, humanPlayers: 1, seed: rematchSeed, mode: 'party' });
  const rematchView = createPlayerScreenViewModel(rematch, 'p1');
  const passed = solo.finalView.phase === 'finished'
    && Boolean(solo.finalView.result?.winner)
    && Boolean(solo.finalView.result?.spyName)
    && Boolean(solo.finalView.result?.finalVoteOutcome)
    && rematchSeed !== seed
    && rematch.state.phase === 'action'
    && rematchView.selectedActionLabel === '未選択';
  return check({
    id: 'result_rematch',
    label: '結果/再戦導線',
    target: '結果で勝者・スパイ正体・おまけ投票・称号が見え、再戦Seedで新規ROUND 1へ戻れる',
    observed: `winner=${solo.finalView.result?.winner ?? 'なし'} / spy=${solo.finalView.result?.spyName ?? 'なし'} / bonus=${solo.finalView.result?.finalVoteOutcome ?? 'なし'} / rematchSeed=${rematchSeed}`,
    passed,
  });
}

function evaluateM4RegressionGates(games: number, seed: number): M5PublicAlphaCheck {
  const report = runAlphaPreflight({ games, players: 5, seed });
  return check({
    id: 'm4_regression_gates',
    label: 'M4 Alpha品質回帰',
    target: 'CPU補完、時間見込み、勝率、ログ量、称号、秘密情報が既存ゲートを通る',
    observed: `status=${report.status} / win=${formatRate(report.summary.gunnerWinRate)} / minutes=${formatNumber(report.estimatedAverageMinutes)} / targetTime=${formatRate(report.targetTimeGameRate)}`,
    passed: report.status === 'pass',
  });
}

interface SoloAlphaFlow {
  finished: boolean;
  voteSeen: boolean;
  resultAwards: number;
  trace: M5SoloFlowTrace[];
  finalView: PlayerScreenViewModel;
}

function runSoloAlphaFlow(seed: number): SoloAlphaFlow {
  const engine = new GameEngine({ totalPlayers: 5, humanPlayers: 1, seed, mode: 'party' });
  const trace: M5SoloFlowTrace[] = [];
  let voteSeen = false;
  let guard = 0;

  while (engine.state.phase !== 'finished') {
    guard += 1;
    if (guard > 30) {
      throw new Error('M5 solo alpha flow exceeded guard limit');
    }
    const hostView = createHostScreenViewModel(engine);
    const playerView = createPlayerScreenViewModel(engine, 'p1');

    if (engine.state.phase === 'action') {
      const submission = chooseAiAction(playerView, hostView.board);
      trace.push({
        phase: playerView.phase,
        instruction: playerView.phaseInstruction,
        action: actionTraceLabel(playerView, submission.type),
        round: engine.state.round,
      });
      engine.submitAction(submission);
      fillCpuActions(engine);
      if (engine.state.players.every((player) => engine.state.submittedActions[player.id])) {
        engine.resolveActions();
      }
      continue;
    }

    if (engine.state.phase === 'plea') {
      const plea = playerView.pleaOptions[0] ?? '了解';
      trace.push({
        phase: playerView.phase,
        instruction: playerView.phaseInstruction,
        action: `弁明:${plea}`,
        round: engine.state.round,
      });
      engine.submitPlea('p1', plea);
      fillCpuPleas(engine);
      if (engine.state.players.every((player) => engine.state.pleas[player.id])) {
        engine.resolvePleas();
      }
      continue;
    }

    if (engine.state.phase === 'vote') {
      voteSeen = true;
      const targetId = chooseAiVoteTarget(playerView);
      trace.push({
        phase: playerView.phase,
        instruction: playerView.phaseInstruction,
        action: `予想:${playerView.voteOptions.find((candidate) => candidate.id === targetId)?.name ?? targetId}`,
        round: engine.state.round,
      });
      engine.submitVote({ voterId: 'p1', targetId });
      fillCpuVotes(engine);
      if (engine.state.players.every((player) => engine.state.votes[player.id])) {
        engine.resolveVotes();
      }
      continue;
    }

    if (engine.state.phase === 'branch') {
      const plan: BranchPlan = playerView.branchOptions[0]?.plan ?? 'normal';
      trace.push({
        phase: playerView.phase,
        instruction: playerView.phaseInstruction,
        action: `作戦:${plan}`,
        round: engine.state.round,
      });
      engine.submitBranchVote({ voterId: 'p1', plan });
      fillCpuBranchVotes(engine);
      if (engine.state.players.every((player) => engine.state.branchVotes[player.id])) {
        engine.resolveBranch();
      }
    }
  }

  const finalView = createPlayerScreenViewModel(engine, 'p1');
  return {
    finished: engine.state.phase === 'finished',
    voteSeen,
    resultAwards: finalView.result?.awards.length ?? 0,
    trace,
    finalView,
  };
}

function chooseAiAction(
  view: PlayerScreenViewModel,
  board: ReturnType<typeof createHostScreenViewModel>['board'],
): ActionSubmission {
  const preferredTypes: ActionType[] = view.role === 'スパイ'
    ? ['sabotage', 'fake_attack', 'boss_heal']
    : board.baseWarning
      ? ['repair', 'defend', 'normal_attack']
      : board.bossActionType === 'big_charge'
        ? ['defend', 'normal_attack', 'repair']
        : board.bossActionType === 'target_lock' && board.bossTargetName === view.name
          ? ['defend', 'normal_attack', 'repair']
          : ['normal_attack', 'repair', 'defend'];
  const action = preferredTypes
    .map((type) => view.availableActions.find((candidate) => candidate.type === type))
    .find(Boolean)
    ?? view.availableActions[0];
  if (!action) {
    throw new Error('No action is available for M5 solo flow');
  }
  return {
    playerId: view.id,
    type: action.type,
    targetId: action.requiresTarget ? view.targetOptions[0]?.id : undefined,
  };
}

function chooseAiVoteTarget(view: PlayerScreenViewModel): string {
  const hinted = view.inferenceHints[0]?.playerId;
  if (hinted && hinted !== view.id) return hinted;
  const first = view.voteOptions[0]?.id;
  if (!first) {
    throw new Error('No vote target is available for M5 solo flow');
  }
  return first;
}

function actionTraceLabel(view: PlayerScreenViewModel, type: ActionType): string {
  return view.availableActions.find((action) => action.type === type)?.label ?? type;
}

function check(check: M5PublicAlphaCheck): M5PublicAlphaCheck {
  return check;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}
