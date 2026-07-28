import { existsSync, chmodSync, createWriteStream } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
const TMP  = "/tmp/yt-dlp";

let cached: string | null = null;

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

  if (existsSync(TMP)) {
    cached = TMP;
    return cached;
  }

  const res = await fetch(URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`yt-dlp download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as import("stream/web").ReadableStream), createWriteStream(TMP));
  chmodSync(TMP, 0o755);
  cached = TMP;
  return cached;
}
