import { existsSync, chmodSync, writeFileSync } from "fs";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const DOWNLOAD_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
const TMP_BIN = "/tmp/yt-dlp";

let cached: string | null = null;

async function download(dest: string): Promise<void> {
  const res = await fetch(DOWNLOAD_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`yt-dlp download HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  writeFileSync(dest, Buffer.from(buf));
  chmodSync(dest, 0o755);
}

export async function ytdlpPath(): Promise<string> {
  if (cached) return cached;

  if (process.env.YTDLP_PATH) {
    cached = process.env.YTDLP_PATH;
    return cached;
  }

  const bundled = join(process.cwd(), "bin", "yt-dlp");
  if (existsSync(bundled)) {
    cached = bundled;
    return cached;
  }

  if (!existsSync(TMP_BIN)) {
    await download(TMP_BIN);
  }

  cached = TMP_BIN;
  return cached;
}

export async function ytdlpVersion(): Promise<string> {
  const bin = await ytdlpPath();
  const exec = promisify(execFile);
  const { stdout } = await exec(bin, ["--version"]);
  return stdout.trim();
}

// Flags que contornam bot detection e JS runtime no Vercel/AWS
export const YTDLP_FLAGS = [
  "--extractor-args", "youtube:player_client=android,ios,web_embedded",
  "--js-runtimes", "nodejs",
  "--no-warnings",
];
