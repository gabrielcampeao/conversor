import { NextRequest } from "next/server";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import { createReadStream, unlink, stat } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import ffmpegStatic from "ffmpeg-static";
import { ytdlpPath, YTDLP_FLAGS } from "@/app/lib/ytdlp";

export const maxDuration = 60;

const execAsync = promisify(execFile);
const statAsync = promisify(stat);
const FFMPEG = ffmpegStatic ?? "ffmpeg";

const ALLOWED_FORMATS   = ["mp4", "mp3"] as const;
const ALLOWED_QUALITIES = [360, 480, 720, 1080, 1440, 2160];
const ALLOWED_BITRATES  = [64, 96, 128, 256, 320];

type Format = typeof ALLOWED_FORMATS[number];

function isYouTubeUrl(raw: string): boolean {
  try {
    const { hostname } = new URL(raw);
    return /^(www\.|m\.|music\.)?youtube\.com$|^youtu\.be$/.test(hostname);
  } catch {
    return false;
  }
}

function errResponse(msg: string, status = 500) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: NextRequest) {
  const url     = req.nextUrl.searchParams.get("url");
  const title   = req.nextUrl.searchParams.get("title") ?? "video";
  const format  = req.nextUrl.searchParams.get("format") ?? "mp4";
  const quality = parseInt(req.nextUrl.searchParams.get("quality") ?? "720");
  const bitrate = parseInt(req.nextUrl.searchParams.get("bitrate") ?? "320");

  if (!url || !isYouTubeUrl(url))
    return errResponse("URL inválida. Cole um link do YouTube.", 400);

  if (!ALLOWED_FORMATS.includes(format as Format))
    return errResponse("Formato inválido.", 400);

  if (!ALLOWED_QUALITIES.includes(quality))
    return errResponse("Qualidade inválida.", 400);

  if (!ALLOWED_BITRATES.includes(bitrate))
    return errResponse("Bitrate inválido.", 400);

  const safeTitle = title.replace(/[^\w\s\-]/g, "").trim() || "video";

  let YTDLP: string;
  try {
    YTDLP = await ytdlpPath();
  } catch (e) {
    console.error("[download] ytdlp resolve failed:", e);
    return errResponse("Serviço temporariamente indisponível.", 503);
  }

  function ytStream(args: string[]): ReadableStream<Uint8Array> {
    const proc = spawn(YTDLP, [...YTDLP_FLAGS, ...args]);
    proc.stderr.on("data", () => {});
    return new ReadableStream<Uint8Array>({
      start(controller) {
        proc.stdout.on("data", (c: Buffer) => controller.enqueue(new Uint8Array(c)));
        proc.stdout.on("end", () => controller.close());
        proc.stdout.on("error", (e) => controller.error(e));
        proc.on("error", (e) => controller.error(e));
      },
      cancel() { proc.kill("SIGTERM"); },
    });
  }

  if (format === "mp3") {
    const yt = spawn(YTDLP, [...YTDLP_FLAGS, "-f", "bestaudio", "--no-playlist", "-o", "-", url]);
    const ff = spawn(FFMPEG, [
      "-hide_banner", "-loglevel", "error",
      "-i", "pipe:0",
      "-vn", "-ab", `${bitrate}k`,
      "-f", "mp3", "pipe:1",
    ]);

    yt.stdout.pipe(ff.stdin);
    yt.stderr.on("data", () => {});
    ff.stderr.on("data", () => {});

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        ff.stdout.on("data", (c: Buffer) => controller.enqueue(new Uint8Array(c)));
        ff.stdout.on("end", () => controller.close());
        ff.stdout.on("error", (e) => controller.error(e));
        ff.on("error", (e) => controller.error(e));
      },
      cancel() { yt.kill("SIGTERM"); ff.kill("SIGTERM"); },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${safeTitle}.mp3"`,
        "Cache-Control": "no-cache",
      },
    });
  }

  if (quality <= 720) {
    const fmt = `best[height<=${quality}][ext=mp4]/best[height<=${quality}]/best[ext=mp4]/best`;
    return new Response(ytStream(["-f", fmt, "--no-playlist", "-o", "-", url]), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${safeTitle}.mp4"`,
        "Cache-Control": "no-cache",
      },
    });
  }

  const tmpPath = join(tmpdir(), `${randomUUID()}.mp4`);

  try {
    const fmt =
      `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]` +
      `/bestvideo[height<=${quality}]+bestaudio` +
      `/best[height<=${quality}]`;

    await execAsync(YTDLP, [...YTDLP_FLAGS, "-f", fmt, "--merge-output-format", "mp4", "--no-playlist", "-o", tmpPath, url], {
      maxBuffer: 2 * 1024 * 1024,
    });

    const { size } = await statAsync(tmpPath);
    const fileStream = createReadStream(tmpPath);

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        fileStream.on("data", (c: Buffer | string) =>
          controller.enqueue(new Uint8Array(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        );
        fileStream.on("end", () => { controller.close(); unlink(tmpPath, () => {}); });
        fileStream.on("error", (e) => { controller.error(e); unlink(tmpPath, () => {}); });
      },
      cancel() { fileStream.destroy(); unlink(tmpPath, () => {}); },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${safeTitle}.mp4"`,
        "Content-Length": size.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    unlink(tmpPath, () => {});
    return errResponse("Erro ao baixar em alta qualidade. Tente uma resolução menor.");
  }
}
