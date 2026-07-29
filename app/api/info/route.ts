import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";

const exec  = promisify(execFile);
const YTDLP = process.env.YTDLP_PATH ?? "yt-dlp";

export const maxDuration = 60;

interface YtFormat {
  height?: number;
  vcodec?: string;
}

const STANDARD_HEIGHTS = [360, 480, 720, 1080, 1440, 2160];

function isYouTubeUrl(raw: string): boolean {
  try {
    const { hostname } = new URL(raw);
    return /^(www\.|m\.|music\.)?youtube\.com$|^youtu\.be$/.test(hostname);
  } catch {
    return false;
  }
}

function parseVideoId(url: string): string | null {
  try {
    const u  = new URL(url);
    const id = /youtu\.be/.test(u.hostname)
      ? u.pathname.slice(1).split("?")[0]
      : u.searchParams.get("v");
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || url.length > 200 || !isYouTubeUrl(url)) {
    return NextResponse.json({ error: "URL inválida. Cole um link do YouTube." }, { status: 400 });
  }

  if (!parseVideoId(url)) {
    return NextResponse.json({ error: "ID do vídeo não encontrado." }, { status: 400 });
  }

  try {
    const { stdout } = await exec(YTDLP, ["--dump-json", "--no-playlist", url], {
      maxBuffer: 10 * 1024 * 1024,
    });

    const data = JSON.parse(stdout.trim().split("\n").find((l) => l.startsWith("{"))!);

    const available = new Set<number>(
      (data.formats as YtFormat[])
        .filter((f) => f.vcodec && f.vcodec !== "none" && typeof f.height === "number")
        .map((f) => f.height as number)
    );

    const qualities = STANDARD_HEIGHTS.filter((h) =>
      [...available].some((fh) => fh >= h - 20 && fh <= h + 20)
    );

    return NextResponse.json({
      title:     data.title as string,
      thumbnail: (data.thumbnail ?? data.thumbnails?.[0]?.url ?? "") as string,
      qualities: qualities.length > 0 ? qualities : [720],
    });
  } catch {
    return NextResponse.json(
      { error: "Vídeo não disponível. Verifique o link e tente novamente." },
      { status: 500 }
    );
  }
}
