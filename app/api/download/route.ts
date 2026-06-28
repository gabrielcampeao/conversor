import { NextRequest } from "next/server";
import { spawn } from "child_process";
import { Readable } from "stream";
import ffmpegStatic from "ffmpeg-static";
import { getYt, parseVideoId, isYouTubeUrl } from "@/app/lib/youtube";

export const maxDuration = 60;

const FFMPEG = ffmpegStatic ?? "ffmpeg";

const ALLOWED_FORMATS   = ["mp4", "mp3"] as const;
const ALLOWED_QUALITIES = [360, 480, 720, 1080, 1440, 2160];
const ALLOWED_BITRATES  = [64, 96, 128, 256, 320];

type Format = typeof ALLOWED_FORMATS[number];

function fail(msg: string, status = 500) {
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

  if (!url || url.length > 200 || !isYouTubeUrl(url)) return fail("URL inválida.", 400);
  if (!ALLOWED_FORMATS.includes(format as Format))     return fail("Formato inválido.", 400);
  if (!ALLOWED_QUALITIES.includes(quality))            return fail("Qualidade inválida.", 400);
  if (!ALLOWED_BITRATES.includes(bitrate))             return fail("Bitrate inválido.", 400);

  const id = parseVideoId(url);
  if (!id) return fail("ID do vídeo não encontrado.", 400);

  const safeTitle = title.slice(0, 200).replace(/[^\w\s-]/g, "").trim() || "video";

  try {
    const yt   = await getYt();
    const info = await yt.getBasicInfo(id, { client: "ANDROID" });

    if (format === "mp3") {
      let audioUrl: string | undefined;
      try {
        const fmt = info.chooseFormat({ type: "audio", quality: "best" });
        audioUrl = fmt.url;
      } catch {
        audioUrl = undefined;
      }

      if (!audioUrl) {
        const stream = await yt.download(id, { type: "audio", quality: "best", client: "ANDROID" });
        const ff = spawn(FFMPEG, [
          "-hide_banner", "-loglevel", "error",
          "-i", "pipe:0", "-vn", "-ab", `${bitrate}k`, "-f", "mp3", "pipe:1",
        ]);
        Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]).pipe(ff.stdin);
        ff.stderr.on("data", () => {});
        const readable = new ReadableStream<Uint8Array>({
          start(c) {
            ff.stdout.on("data", (d: Buffer) => c.enqueue(new Uint8Array(d)));
            ff.stdout.on("end", () => c.close());
            ff.stdout.on("error", (e) => c.error(e));
            ff.on("error", (e) => c.error(e));
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

      const ytRes = await fetch(audioUrl);
      if (!ytRes.ok) throw new Error(`CDN audio error: ${ytRes.status}`);

      const ff = spawn(FFMPEG, [
        "-hide_banner", "-loglevel", "error",
        "-i", "pipe:0", "-vn", "-ab", `${bitrate}k`, "-f", "mp3", "pipe:1",
      ]);

      Readable.fromWeb(ytRes.body as Parameters<typeof Readable.fromWeb>[0]).pipe(ff.stdin);
      ff.stderr.on("data", () => {});

      const readable = new ReadableStream<Uint8Array>({
        start(c) {
          ff.stdout.on("data", (d: Buffer) => c.enqueue(new Uint8Array(d)));
          ff.stdout.on("end", () => c.close());
          ff.stdout.on("error", (e) => c.error(e));
          ff.on("error", (e) => c.error(e));
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

    let videoUrl: string | undefined;
    try {
      const fmt = info.chooseFormat({ type: "video+audio", quality: `${quality}p`, format: "mp4" });
      videoUrl = fmt.url;
    } catch {
      try {
        const fmt = info.chooseFormat({ type: "video+audio", quality: "best", format: "mp4" });
        videoUrl = fmt.url;
      } catch {
        videoUrl = undefined;
      }
    }

    if (!videoUrl) {
      const stream = await yt.download(id, {
        type: "video+audio", quality: `${quality}p`, format: "mp4", client: "ANDROID",
      });
      return new Response(stream as ReadableStream<Uint8Array>, {
        headers: {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${safeTitle}.mp4"`,
          "Cache-Control": "no-cache",
        },
      });
    }

    const ytRes = await fetch(videoUrl);
    if (!ytRes.ok) throw new Error(`CDN video error: ${ytRes.status}`);

    return new Response(ytRes.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${safeTitle}.mp4"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[download]", msg);
    return fail(msg);
  }
}
