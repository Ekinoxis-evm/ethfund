import { execFile } from "node:child_process";
import { config } from "./config.js";

/**
 * Invoke the polymarket-cli with `-o json` and return parsed JSON.
 * Throws on non-zero exit, unparseable output, or an `{"error": ...}` payload.
 */
export function runCli<T = unknown>(args: string[]): Promise<T> {
  const fullArgs = ["-o", "json", ...args];
  return new Promise<T>((resolvePromise, reject) => {
    execFile(
      config.cliBin,
      fullArgs,
      { maxBuffer: 32 * 1024 * 1024, timeout: 30_000 },
      (err, stdout, stderr) => {
        if (err && !stdout) {
          reject(
            new Error(
              `polymarket-cli failed (${config.cliBin} ${fullArgs.join(" ")}): ${err.message}${
                stderr ? `\n${stderr}` : ""
              }`,
            ),
          );
          return;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(stdout);
        } catch {
          reject(
            new Error(
              `polymarket-cli returned non-JSON for [${fullArgs.join(" ")}]: ${stdout.slice(0, 300)}`,
            ),
          );
          return;
        }
        if (
          parsed &&
          typeof parsed === "object" &&
          "error" in parsed &&
          typeof (parsed as { error: unknown }).error === "string"
        ) {
          reject(new Error(`polymarket-cli error: ${(parsed as { error: string }).error}`));
          return;
        }
        resolvePromise(parsed as T);
      },
    );
  });
}
