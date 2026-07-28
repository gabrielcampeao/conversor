import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { ytdlpPath, YTDLP_FLAGS } from "@/app/lib/ytdlp";

export const maxDuration = 60;

const exec = promisify(execFile);

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

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || !isYouTubeUrl(url)) {
    return NextResponse.json({ error: "URL inválida. Cole um link do YouTube." }, { status: 400 });
  }

  try {
    const ytdlp = await ytdlpPath();
    const { stdout } = await exec(ytdlp, ["--dump-json", "--no-playlist", ...YTDLP_FLAGS, url], {
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
      title: data.title as string,
      thumbnail: (data.thumbnail ?? data.thumbnails?.[0]?.url ?? "") as string,
      qualities: qualities.length > 0 ? qualities : [720],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[info]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
