import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { Readable } from "stream";
import ffmpegStatic from "ffmpeg-static";
import { getYt, parseVideoId } from "@/app/lib/youtube";

export const maxDuration = 60;

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

function err(msg: string, status = 500) {
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

  if (!url || !isYouTubeUrl(url))         return err("URL inválida.", 400);
  if (!ALLOWED_FORMATS.includes(format as Format)) return err("Formato inválido.", 400);
  if (!ALLOWED_QUALITIES.includes(quality))        return err("Qualidade inválida.", 400);
  if (!ALLOWED_BITRATES.includes(bitrate))         return err("Bitrate inválido.", 400);

  const id = parseVideoId(url);
  if (!id) return err("ID do vídeo não encontrado.", 400);

  const safeTitle = title.replace(/[^\w\s\-]/g, "").trim() || "video";

  try {
    const yt   = await getYt();
    const info = await yt.getBasicInfo(id, "TV_EMBEDDED");

    if (format === "mp3") {
      const stream = await yt.download(id, {
        type: "audio",
        quality: "best",
        client: "TV_EMBEDDED",
      });

      const ff = spawn(FFMPEG, [
        "-hide_banner", "-loglevel", "error",
        "-i", "pipe:0",
        "-vn", "-ab", `${bitrate}k`,
        "-f", "mp3", "pipe:1",
      ]);

      Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]).pipe(ff.stdin);
      ff.stderr.on("data", () => {});

      const readable = new ReadableStream<Uint8Array>({
        start(controller) {
          ff.stdout.on("data", (c: Buffer) => controller.enqueue(new Uint8Array(c)));
          ff.stdout.on("end", () => controller.close());
          ff.stdout.on("error", (e) => controller.error(e));
          ff.on("error", (e) => controller.error(e));
        },
        cancel() { ff.kill("SIGTERM"); },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Disposition": `attachment; filename="${safeTitle}.mp3"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    const qualityLabel = `${quality}p` as Parameters<typeof info.chooseFormat>[0]["quality"];

    const stream = await yt.download(id, {
      type: "video+audio",
      quality: qualityLabel,
      format: "mp4",
      client: "TV_EMBEDDED",
    });

    return new Response(stream as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${safeTitle}.mp4"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (e: unknown) {
    console.error("[download]", e instanceof Error ? e.message : e);
    return err("Erro ao processar o vídeo. Tente novamente.");
  }
}
