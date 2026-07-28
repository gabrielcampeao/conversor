import { existsSync, chmodSync, writeFileSync } from "fs";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const DOWNLOAD_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
const TMP_BIN     = "/tmp/yt-dlp";
const COOKIES_PATH = "/tmp/yt-cookies.txt";

let cachedBin: string | null = null;

async function download(dest: string): Promise<void> {
  const res = await fetch(DOWNLOAD_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`yt-dlp download HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  writeFileSync(dest, Buffer.from(buf));
  chmodSync(dest, 0o755);
}

export async function ytdlpPath(): Promise<string> {
  if (cachedBin) return cachedBin;

  if (process.env.YTDLP_PATH) {
    cachedBin = process.env.YTDLP_PATH;
    return cachedBin;
  }

  const bundled = join(process.cwd(), "bin", "yt-dlp");
  if (existsSync(bundled)) {
    cachedBin = bundled;
    return cachedBin;
  }

  if (!existsSync(TMP_BIN)) {
    await download(TMP_BIN);
  }

  cachedBin = TMP_BIN;
  return cachedBin;
}

export async function ytdlpVersion(): Promise<string> {
  const bin = await ytdlpPath();
  const exec = promisify(execFile);
  const { stdout } = await exec(bin, ["--version"]);
  return stdout.trim();
}

function cookieArgs(): string[] {
  const cookies = process.env.YOUTUBE_COOKIES;
  if (!cookies) return [];
  if (!existsSync(COOKIES_PATH)) {
    writeFileSync(COOKIES_PATH, cookies, "utf8");
  }
  return ["--cookies", COOKIES_PATH];
}

export function ytdlpArgs(): string[] {
  return [
    // usa o próprio node do Lambda como runtime JS (resolve o "No JS runtime" warning)
    "--js-runtimes", `nodejs:${process.execPath}`,
    // clientes mobile têm menos restrições de bot que o cliente web
    "--extractor-args", "youtube:player_client=android,ios,mweb",
    "--no-warnings",
    ...cookieArgs(),
  ];
}
