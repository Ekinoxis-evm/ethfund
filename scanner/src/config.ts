import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));

/** All pairs the grouping understands; v1 ships only 4H-vs-1H by default. */
export const ALL_PAIRS = [
  "4H-vs-1H",
  "1H-vs-15M",
  "15M-vs-5M",
  "4H-vs-15M",
  "4H-vs-5M",
  "1H-vs-5M",
] as const;
export type Pair = (typeof ALL_PAIRS)[number];

export interface CliFlags {
  once: boolean;
  dryRun: boolean;
  pairs?: string;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { once: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--once") flags.once = true;
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--write") flags.dryRun = false;
    else if (a === "--pairs") flags.pairs = argv[++i];
    else if (a?.startsWith("--pairs=")) flags.pairs = a.slice("--pairs=".length);
  }
  return flags;
}

function num(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

const flags = parseFlags(process.argv.slice(2));

// Default CLI binary path: relative to the scanner package, into polia/.
const defaultBin = resolve(
  __dirname,
  "../../polia/polymarket-cli/target/release/polymarket",
);

const pairsRaw = flags.pairs ?? process.env.PAIRS ?? "4H-vs-1H";
const pairs = pairsRaw
  .split(",")
  .map((p) => p.trim())
  .filter((p): p is Pair => (ALL_PAIRS as readonly string[]).includes(p));

export const config = {
  cliBin: process.env.POLYMARKET_CLI_BIN
    ? resolve(process.cwd(), process.env.POLYMARKET_CLI_BIN)
    : defaultBin,

  // thresholds (spec §13)
  minSpread: num("MIN_SPREAD", 0.05),
  minLiquidity: num("MIN_LIQUIDITY", 5000),
  minVolume: num("MIN_VOLUME", 20000),
  maxBidAsk: num("MAX_BIDASK", 0.02),
  scanIntervalMs: num("SCAN_INTERVAL_MS", 5000),

  pairs: pairs.length ? pairs : (["4H-vs-1H"] as Pair[]),
  useClob: (process.env.USE_CLOB ?? "false").toLowerCase() === "true",

  // integrations
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  alertFrom: process.env.ALERT_FROM ?? "",
  alertTo: (process.env.ALERT_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  flags,
} as const;

export type Config = typeof config;
