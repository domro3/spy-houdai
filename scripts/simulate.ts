import { formatSimulationSummary, runSimulation } from '../src/sim/simulation';

const args = parseArgs(process.argv.slice(2));
const summary = runSimulation({
  games: numberArg(args.games, 30),
  players: numberArg(args.players, 5),
  seed: numberArg(args.seed, 20260627),
});

if (args.json === 'true') {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(formatSimulationSummary(summary));
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
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric argument: ${value}`);
  }
  return parsed;
}
