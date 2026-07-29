import { NextResponse } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import { ytdlpVersion } from "@/app/lib/ytdlp";

export const maxDuration = 60;

export async function GET() {
  const bundled = join(process.cwd(), "bin", "yt-dlp");

  const info: Record<string, unknown> = {
    cwd: process.cwd(),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    env_YTDLP_PATH: process.env.YTDLP_PATH ?? null,
    bundled_exists: existsSync(bundled),
    tmp_exists: existsSync("/tmp/yt-dlp"),
  };

  try {
    info.ytdlp_version = await ytdlpVersion();
    info.ytdlp_ok = true;
  } catch (e: unknown) {
    info.ytdlp_ok = false;
    info.ytdlp_error = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(info);
}
