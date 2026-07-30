import { NextRequest, NextResponse } from "next/server";
import { getYt, parseVideoId, isYouTubeUrl, isSafeThumbnail } from "@/app/lib/youtube";

export const maxDuration = 60;

const STANDARD_HEIGHTS = [360, 480, 720, 1080, 1440, 2160];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || url.length > 200 || !isYouTubeUrl(url)) {
    return NextResponse.json({ error: "URL inválida. Cole um link do YouTube." }, { status: 400 });
  }

  const id = parseVideoId(url);
  if (!id) {
    return NextResponse.json({ error: "ID do vídeo não encontrado." }, { status: 400 });
  }

  try {
    const yt   = await getYt();
    const info = await yt.getBasicInfo(id, { client: "TV_EMBEDDED" });

    const available = new Set<number>();
    for (const f of info.streaming_data?.adaptive_formats ?? []) {
      if (f.has_video && f.height) available.add(f.height);
    }
    for (const f of info.streaming_data?.formats ?? []) {
      if (f.height) available.add(f.height);
    }

    const qualities = STANDARD_HEIGHTS.filter((h) =>
      [...available].some((fh) => fh >= h - 20 && fh <= h + 20)
    );

    const rawThumb = info.basic_info.thumbnail?.[0]?.url ?? "";
    const thumbnail = isSafeThumbnail(rawThumb) ? rawThumb : "";

    return NextResponse.json({
      title:     info.basic_info.title ?? "",
      thumbnail,
      qualities: qualities.length > 0 ? qualities : [720],
    });
  } catch (e: unknown) {
    console.error("[info]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Vídeo não disponível. Verifique o link e tente novamente." },
      { status: 500 }
    );
  }
}
