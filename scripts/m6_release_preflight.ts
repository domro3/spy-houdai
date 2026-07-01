import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

interface ReleaseCheck {
  id: string;
  label: string;
  target: string;
  observed: string;
  passed: boolean;
}

const args = parseArgs(process.argv.slice(2));
const report = createReport();
const markdown = formatReport(report, {
  date: args.date,
  command: 'npm run release:m6',
});

console.log(markdown);

if (args.write) {
  mkdirSync(dirname(args.write), { recursive: true });
  writeFileSync(args.write, `${markdown}\n`);
  console.log(`\nWrote ${args.write}`);
}

if (report.status === 'fail' || (args.strict === 'true' && report.status !== 'pass')) {
  process.exitCode = 1;
}

function createReport(): {
  status: 'pass' | 'needs_decision' | 'fail';
  checks: ReleaseCheck[];
  externalBlockers: string[];
} {
  const packageJson = jsonFile('package.json') as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  const checks: ReleaseCheck[] = [
    fileContainsCheck({
      id: 'm5_closed',
      label: 'M5完了証跡',
      path: 'docs/playtest/m5_completion_report.md',
      terms: ['M5 Closed', 'Public Alpha v0.1 AI Complete'],
      target: 'M5が完了済みとして記録されている',
    }),
    fileContainsCheck({
      id: 'm5_preflight_pass',
      label: 'M5 AI Preflight',
      path: 'docs/playtest/m5_public_alpha_preflight.md',
      terms: ['ステータス: PASS', 'ブロッカー: なし'],
      target: 'M5のAI代替ゲートがPASSしている',
    }),
    scriptCheck(packageJson.scripts ?? {}),
    releaseDocsCheck(),
    indexMetaCheck(),
    distCheck(),
    publicAssetCheck(),
    lucideLicenseCheck(packageJson.dependencies ?? {}),
    releaseCopyPolicyCheck(),
  ];
  const externalBlockers = externalReleaseBlockers();
  const autoFailed = checks.some((check) => !check.passed);

  return {
    status: autoFailed ? 'fail' : externalBlockers.length > 0 ? 'needs_decision' : 'pass',
    checks,
    externalBlockers,
  };
}

function formatReport(
  report: ReturnType<typeof createReport>,
  options: { date?: string; command?: string } = {},
): string {
  const statusLabel = report.status === 'pass'
    ? 'PASS'
    : report.status === 'needs_decision'
      ? 'NEEDS_DECISION'
      : 'FAIL';
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const command = options.command ?? 'npm run release:m6';
  const lines = [
    '# M6 Release Preflight',
    '',
    `ステータス: ${statusLabel}`,
    `作成日: ${date}`,
    `コマンド: \`${command}\``,
    '',
    'このレポートは、Public Alpha v0.1公開準備のうち、AIで確認できる項目と外部判断が必要な項目を分けて記録する。',
    '',
    '## 自動ゲート',
    '',
    '| 判定 | 項目 | 目標 | 実測 |',
    '| --- | --- | --- | --- |',
    ...report.checks.map((check) => `| ${check.passed ? 'OK' : 'NG'} | ${check.label} | ${check.target} | ${check.observed} |`),
    '',
    '## 外部判断ブロッカー',
    '',
    report.externalBlockers.length === 0
      ? '- なし'
      : report.externalBlockers.map((blocker) => `- ${blocker}`).join('\n'),
    '',
    '## 判定',
    '',
    report.status === 'pass'
      ? '- 公開準備ゲートは通過。公開URLで最終確認へ進む。'
      : report.status === 'needs_decision'
        ? '- 自動ゲートは通過。外部公開に必要な公開先・デプロイ設定などの判断が残る。'
        : '- 自動ゲートに失敗。公開準備を進める前に修正する。',
  ];
  return lines.join('\n');
}

function scriptCheck(scripts: Record<string, string>): ReleaseCheck {
  const required = ['build', 'test', 'typecheck', 'playtest:m5', 'release:m6'];
  const missing = required.filter((script) => !scripts[script]);
  return {
    id: 'package_scripts',
    label: '公開準備コマンド',
    target: required.join(', '),
    observed: missing.length === 0 ? '必要コマンドあり' : `不足: ${missing.join(', ')}`,
    passed: missing.length === 0,
  };
}

function releaseDocsCheck(): ReleaseCheck {
  const required = [
    'docs/pm/m6_public_alpha_release_plan.md',
    'docs/release/public_alpha_v0_1_page_copy.md',
    'docs/release/public_alpha_v0_1_feedback.md',
    'docs/release/asset_license_register.md',
    'docs/release/m6_human_substitute_check.md',
  ];
  const missing = required.filter((path) => !existsSync(path));
  return {
    id: 'release_docs',
    label: '公開準備ドキュメント',
    target: 'M6計画、公開文言、フィードバック、素材台帳、人間代替チェックがある',
    observed: missing.length === 0 ? '必要ドキュメントあり' : `不足: ${missing.join(', ')}`,
    passed: missing.length === 0,
  };
}

function indexMetaCheck(): ReleaseCheck {
  const html = readText('index.html');
  const required = [
    '<meta name="viewport"',
    'name="description"',
    'property="og:title"',
    'property="og:description"',
    'name="theme-color"',
  ];
  const missing = required.filter((term) => !html.includes(term));
  return {
    id: 'index_meta',
    label: '公開メタ情報',
    target: 'viewport、description、OG、theme-colorがある',
    observed: missing.length === 0 ? '必要metaあり' : `不足: ${missing.join(', ')}`,
    passed: missing.length === 0,
  };
}

function distCheck(): ReleaseCheck {
  const indexExists = existsSync('dist/index.html');
  const assetCount = existsSync('dist/assets')
    ? readdirSync('dist/assets').filter((file) => /\.(js|css)$/.test(file)).length
    : 0;
  return {
    id: 'dist_build',
    label: '静的ビルド成果物',
    target: 'dist/index.html と dist/assets のJS/CSSがある',
    observed: `index=${indexExists ? 'あり' : 'なし'} / assets=${assetCount}`,
    passed: indexExists && assetCount >= 2,
  };
}

function publicAssetCheck(): ReleaseCheck {
  const files = listFiles('public');
  const dotFiles = files.filter((path) => path.split('/').some((part) => part.startsWith('.')));
  const binaryPrototypeAssets = files.filter((path) => path.includes('/assets/prototype/') && /\.(png|jpg|jpeg|webp)$/i.test(path));
  const passed = dotFiles.length === 0 && binaryPrototypeAssets.length === 0;
  return {
    id: 'public_assets',
    label: '公開配布素材',
    target: 'Finderメタデータや出所未記録のプロトタイプ画像をpublicへ含めない',
    observed: passed
      ? `public files=${files.length}`
      : `dot=${dotFiles.join(', ') || 'なし'} / prototype=${binaryPrototypeAssets.join(', ') || 'なし'}`,
    passed,
  };
}

function lucideLicenseCheck(dependencies: Record<string, string>): ReleaseCheck {
  const packagePath = 'node_modules/lucide-react/package.json';
  const installed = existsSync(packagePath);
  const packageData = installed ? jsonFile(packagePath) as { license?: string; version?: string } : undefined;
  const passed = Boolean(dependencies['lucide-react']) && packageData?.license === 'ISC';
  return {
    id: 'lucide_license',
    label: 'アイコンライセンス',
    target: 'lucide-react が依存関係にあり、ローカルpackageでISC licenseを確認できる',
    observed: installed
      ? `version=${packageData?.version ?? 'unknown'} / license=${packageData?.license ?? 'unknown'}`
      : 'node_modulesにlucide-reactなし',
    passed,
  };
}

function releaseCopyPolicyCheck(): ReleaseCheck {
  const copy = readText('docs/release/public_alpha_v0_1_page_copy.md').split('## 使わない表現')[0] ?? '';
  const forbidden = [
    'Among Us',
    'アモングアス',
    '人狼系',
    '追放',
    '○○風',
    'みたいなゲーム',
  ];
  const found = forbidden.filter((term) => copy.includes(term));
  return {
    id: 'copy_policy',
    label: '公開文言ポリシー',
    target: '既存作品名や寄せすぎ表現を公開文言に含めない',
    observed: found.length === 0 ? '禁止語なし' : `検出: ${found.join(', ')}`,
    passed: found.length === 0,
  };
}

function fileContainsCheck({
  id,
  label,
  path,
  terms,
  target,
}: {
  id: string;
  label: string;
  path: string;
  terms: string[];
  target: string;
}): ReleaseCheck {
  const exists = existsSync(path);
  const text = exists ? readText(path) : '';
  const missing = terms.filter((term) => !text.includes(term));
  return {
    id,
    label,
    target,
    observed: !exists ? `${path} なし` : missing.length === 0 ? '必要記録あり' : `不足: ${missing.join(', ')}`,
    passed: exists && missing.length === 0,
  };
}

function externalReleaseBlockers(): string[] {
  const blockers: string[] = [];
  const rightsReview = readText('spy-houdai-specs/tasks/phase1_5_rights_review_tasks.md');
  if (!gitRemoteOutput()) {
    blockers.push('Git remoteが未設定。公開先リポジトリまたはデプロイ元を決める。');
  }
  if (!hasDeployConfig()) {
    blockers.push('デプロイ設定が未設定。GitHub Pages、Netlify、Vercel、itch.io等から選ぶ。');
  }
  if (readText('docs/release/public_alpha_v0_1_feedback.md').includes('要決定')) {
    blockers.push('フィードバック送信先が未決定。');
  }
  if (rightsReview.includes('| スパイ砲台 |  |')) {
    blockers.push('主要名称の商標検索記録が未入力。');
  } else if (rightsReview.includes('要公式確認')) {
    blockers.push('主要名称のJ-PlatPat公式商標検索が未完了。');
  }
  return blockers;
}

function hasDeployConfig(): boolean {
  const directFiles = [
    'vercel.json',
    'netlify.toml',
    'firebase.json',
    'wrangler.toml',
    '.github/workflows/deploy.yml',
    '.github/workflows/pages.yml',
  ];
  return directFiles.some((path) => existsSync(path));
}

function gitRemoteOutput(): string {
  try {
    return execSync('git remote -v', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const results: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        walk(path);
      } else {
        results.push(path.replaceAll('\\', '/'));
      }
    }
  };
  walk(root);
  return results;
}

function jsonFile(path: string): unknown {
  return JSON.parse(readText(path));
}

function readText(path: string): string {
  return readFileSync(path, 'utf8');
}

function parseArgs(argv: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = 'true';
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}
