import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  formatM5PublicAlphaPreflightMarkdown,
  runM5PublicAlphaPreflight,
} from '../src/playtest/m5_public_alpha_preflight';

const args = parseArgs(process.argv.slice(2));
const games = numberArg(args.games, 100);
const seed = numberArg(args.seed, 20260627);
const command = `npm run playtest:m5 -- --games ${games}${seed === 20260627 ? '' : ` --seed ${seed}`}`;
const report = runM5PublicAlphaPreflight({ games, seed });
const markdown = formatM5PublicAlphaPreflightMarkdown(report, {
  date: args.date,
  command,
});

console.log(markdown);

if (args.write) {
  mkdirSync(dirname(args.write), { recursive: true });
  writeFileSync(args.write, `${markdown}\n`);
  console.log(`\nWrote ${args.write}`);
}

if (report.status === 'fail') {
  process.exitCode = 1;
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

function numberArg(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer argument: ${value}`);
  }
  return parsed;
}
