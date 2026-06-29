import { GameEngine } from '../core/game_engine';
import { PARTY_RULES } from '../data/constants';
import { runSimulation, type SimulationSummary } from '../sim/simulation';
import { createHostScreenViewModel, createPlayerScreenViewModel } from '../screens/screen_view_models';

export interface AlphaPreflightOptions {
  games?: number;
  players?: number;
  seed?: number;
  expectedSecondsPerRound?: number;
}

export interface AlphaPreflightCheck {
  id: string;
  label: string;
  target: string;
  observed: string;
  passed: boolean;
}

export interface AlphaPrivacyCheck {
  passed: boolean;
  findings: string[];
}

export interface AlphaPreflightReport {
  status: 'pass' | 'fail';
  summary: SimulationSummary;
  estimatedAverageMinutes: number;
  targetTimeGameRate: number;
  privacy: AlphaPrivacyCheck;
  checks: AlphaPreflightCheck[];
  blockers: string[];
  notes: string[];
}

const DEFAULT_GAMES = 100;
const DEFAULT_PLAYERS = 5;
const DEFAULT_SEED = 20260627;

export function runAlphaPreflight(options: AlphaPreflightOptions = {}): AlphaPreflightReport {
  const games = options.games ?? DEFAULT_GAMES;
  const players = options.players ?? DEFAULT_PLAYERS;
  const seed = options.seed ?? DEFAULT_SEED;
  const expectedSecondsPerRound = options.expectedSecondsPerRound ?? PARTY_RULES.expectedSecondsPerRound;
  const summary = runSimulation({
    games,
    players,
    seed,
    mode: 'party',
  });
  const estimatedAverageMinutes = estimatedMinutes(summary.averageRounds, expectedSecondsPerRound);
  const targetTimeGameRate = summary.records.filter((record) => {
    const minutes = estimatedMinutes(record.rounds, expectedSecondsPerRound);
    return minutes >= 5 && minutes <= 8;
  }).length / summary.games;
  const privacy = evaluatePrivacyProjection(players, seed);
  const checks: AlphaPreflightCheck[] = [
    {
      id: 'cpu_games_finished',
      label: 'CPU補完ゲーム完走',
      target: `${games}ゲームすべてが結果まで到達`,
      observed: `${summary.gunnerWins + summary.spyWins}/${summary.games}ゲーム完了`,
      passed: summary.records.length === games
        && summary.gunnerWins + summary.spyWins === games
        && summary.records.every((record) => record.rounds >= 1 && record.rounds <= PARTY_RULES.rounds),
    },
    {
      id: 'target_time_average',
      label: '平均プレイ時間見込み',
      target: '5から8分',
      observed: `${formatMinutes(estimatedAverageMinutes)} (${formatNumber(summary.averageRounds)}ラウンド平均)`,
      passed: estimatedAverageMinutes >= 5 && estimatedAverageMinutes <= 8,
    },
    {
      id: 'target_time_distribution',
      label: '5から8分枠ゲーム率',
      target: '80%以上',
      observed: formatRate(targetTimeGameRate),
      passed: targetTimeGameRate >= 0.8,
    },
    {
      id: 'gunner_win_rate',
      label: 'Party Mode砲台勝率',
      target: '55から70%',
      observed: formatRate(summary.gunnerWinRate),
      passed: summary.gunnerWinRate >= 0.55 && summary.gunnerWinRate <= 0.7,
    },
    {
      id: 'public_log_length',
      label: '公開ログの短さ',
      target: '全ラウンド3から4行',
      observed: `${formatRate(summary.shortPublicLogRoundRate)} / ${summary.minPublicLogLinesPerRound}-${summary.maxPublicLogLinesPerRound}行`,
      passed: summary.shortPublicLogRoundRate === 1
        && summary.minPublicLogLinesPerRound >= 3
        && summary.maxPublicLogLinesPerRound <= 4,
    },
    {
      id: 'party_action_coverage',
      label: '守る・直す・妨害の出現',
      target: '各平均が実プレイ判断に使える量で出る',
      observed: `守る${formatNumber(summary.averageDefenseCount)} / 直す${formatNumber(summary.averageRepairCount)} / 妨害${formatNumber(summary.averageSabotageCount)}`,
      passed: summary.averageDefenseCount >= 3
        && summary.averageRepairCount >= 1
        && summary.averageSabotageCount >= 0.5,
    },
    {
      id: 'danger_state_exercised',
      label: '拠点危険状態の発生',
      target: '40%以下到達率25%以上、0敗北率15%以下',
      observed: `40以下${formatRate(summary.baseDanger40Rate)} / 0敗北${formatRate(summary.baseDestroyedRate)}`,
      passed: summary.baseDanger40Rate >= 0.25 && summary.baseDestroyedRate <= 0.15,
    },
    {
      id: 'party_rules_isolated',
      label: 'Party専用ルールの維持',
      target: '怪しいコイン0回、スパイ裏勝利0回',
      observed: `怪しいコイン${summary.suspiciousCoinUses}回 / 裏勝利${summary.spyBehindWins}回`,
      passed: summary.suspiciousCoinUses === 0 && summary.spyBehindWins === 0,
    },
    {
      id: 'final_guess_bonus_exercised',
      label: 'おまけスパイ予想の発生',
      target: '成功と失敗の両方がシミュレーション内に出る',
      observed: `成功${summary.finalVoteHitSpyCount} / 失敗${summary.games - summary.finalVoteHitSpyCount}`,
      passed: summary.finalVoteHitSpyCount > 0 && summary.finalVoteHitSpyCount < summary.games,
    },
    {
      id: 'privacy_projection',
      label: '画面分離・秘密情報ガード',
      target: 'Boardに秘密情報なし、スパイ操作はスパイ端末だけ',
      observed: privacy.passed ? '漏えい検出なし' : privacy.findings.join(' / '),
      passed: privacy.passed,
    },
  ];
  const blockers = checks.filter((check) => !check.passed).map((check) => check.label);

  return {
    status: blockers.length === 0 ? 'pass' : 'fail',
    summary,
    estimatedAverageMinutes,
    targetTimeGameRate,
    privacy,
    checks,
    blockers,
    notes: [
      'AI Alpha Preflightは、CPUプレイ・画面投影・ログ量・数値バランスの自動確認である。',
      '人間が説明なしで迷わないか、盛り上がるか、もう一戦したいかは未判定のまま残す。',
      '人間プレイテスト前でも、M4をAlpha Playtest Readyへ近づけるための回帰チェックとして使う。',
    ],
  };
}

export function evaluatePrivacyProjection(players = DEFAULT_PLAYERS, seed = DEFAULT_SEED): AlphaPrivacyCheck {
  const engine = new GameEngine({
    totalPlayers: players,
    humanPlayers: players,
    seed,
    spyId: 'p4',
    mode: 'party',
  });
  engine.state.privateLogs.p1.push('赤砲台だけの個別ログ。');
  engine.state.privateLogs.p4.push('スパイだけの個別ログ。ボスを助ける準備。');
  engine.state.debugLogs.push('[debug] spy=p4 secret action=boss_heal');

  const hostView = createHostScreenViewModel(engine);
  const gunnerView = createPlayerScreenViewModel(engine, 'p1');
  const spyView = createPlayerScreenViewModel(engine, 'p4');
  const hostSerialized = JSON.stringify(hostView);
  const findings: string[] = [];
  const forbiddenHostTexts = [
    'スパイ',
    'スパイだけ',
    'ボスを助ける',
    '邪魔する',
    '弱く撃つ',
    '[debug]',
    'boss_heal',
  ];

  for (const text of forbiddenHostTexts) {
    if (hostSerialized.includes(text)) {
      findings.push(`Boardに${text}が出た`);
    }
  }
  if (!hostView.players.every((player) => player.role === '非公開')) {
    findings.push('Boardの役職が非公開ではない');
  }
  const gunnerActions = gunnerView.availableActions.map((action) => action.label);
  const spyActions = spyView.availableActions.map((action) => action.label);
  for (const label of ['弱く撃つ', '邪魔する', 'ボスを助ける']) {
    if (gunnerActions.includes(label)) {
      findings.push(`砲台端末に${label}が出た`);
    }
    if (!spyActions.includes(label)) {
      findings.push(`スパイ端末に${label}が出ていない`);
    }
  }
  if (gunnerView.privateLogs.join('\n').includes('スパイだけ')) {
    findings.push('砲台端末にスパイの個別ログが混ざった');
  }
  if (!spyView.privateLogs.join('\n').includes('スパイだけの個別ログ')) {
    findings.push('スパイ端末に自分の個別ログが出ていない');
  }

  return {
    passed: findings.length === 0,
    findings,
  };
}

export function formatAlphaPreflightMarkdown(
  report: AlphaPreflightReport,
  options: { date?: string; command?: string } = {},
): string {
  const statusLabel = report.status === 'pass' ? 'PASS' : 'FAIL';
  const command = options.command ?? 'npm run playtest:ai -- --games 100';
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const lines = [
    '# M4 AI Alpha Preflight',
    '',
    `ステータス: ${statusLabel}`,
    `作成日: ${date}`,
    `コマンド: \`${command}\``,
    '',
    'このレポートは、人間プレイテストを完了扱いにするものではない。',
    'CPUシミュレーションと画面投影ガードで、AIが先に潰せるM4リスクを確認するための証跡である。',
    '',
    '## 結果サマリー',
    '',
    `- 試行回数: ${report.summary.games}`,
    `- プレイヤー数: ${report.summary.players}`,
    `- Seed: ${report.summary.seed}`,
    `- 砲台チーム勝率: ${formatRate(report.summary.gunnerWinRate)}`,
    `- 平均ラウンド数: ${formatNumber(report.summary.averageRounds)}`,
    `- 平均プレイ時間見込み: ${formatMinutes(report.estimatedAverageMinutes)}`,
    `- 5から8分枠ゲーム率: ${formatRate(report.targetTimeGameRate)}`,
    `- 拠点耐久40以下到達率: ${formatRate(report.summary.baseDanger40Rate)}`,
    `- 拠点耐久0敗北率: ${formatRate(report.summary.baseDestroyedRate)}`,
    `- 短い公開ログ率: ${formatRate(report.summary.shortPublicLogRoundRate)}`,
    '',
    '## ゲート',
    '',
    '| 判定 | 項目 | 目標 | 実測 |',
    '| --- | --- | --- | --- |',
    ...report.checks.map((check) => `| ${check.passed ? 'OK' : 'NG'} | ${check.label} | ${check.target} | ${check.observed} |`),
    '',
    '## 未判定として残すこと',
    '',
    '- 人間が説明なしで操作意図を理解できるか',
    '- Boardだけで戦況が直感できるか',
    '- Player端末だけで次の操作に迷わないか',
    '- 盛り上がり、退屈さ、もう一戦したい感覚',
    '- 実測プレイ時間5から8分',
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

function estimatedMinutes(rounds: number, secondsPerRound: number): number {
  return (rounds * secondsPerRound) / 60;
}

function formatRate(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatMinutes(value: number): string {
  return `${formatNumber(value)}分`;
}

function formatNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}
