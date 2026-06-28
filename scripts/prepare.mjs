import { createWriteStream, existsSync, chmodSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

// Skip if running inside Docker (system yt-dlp is set via YTDLP_PATH env)
if (process.env.YTDLP_PATH) {
  console.log("[prepare] YTDLP_PATH already set, skipping download.");
  process.exit(0);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(ROOT, "bin");
const DEST = join(BIN, "yt-dlp");
const URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

await mkdir(BIN, { recursive: true });

if (existsSync(DEST)) {
  console.log("[prepare] yt-dlp already present, skipping.");
  process.exit(0);
}

process.stdout.write("[prepare] downloading yt-dlp_linux… ");
const res = await fetch(URL, { redirect: "follow" });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
await pipeline(Readable.fromWeb(res.body), createWriteStream(DEST));
chmodSync(DEST, 0o755);
console.log("done.");
