import { Innertube } from "youtubei.js";

let client: Innertube | null = null;

export async function getYt(): Promise<Innertube> {
  if (!client) client = await Innertube.create({ generate_session_locally: true });
  return client;
}

export function parseVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (/youtu\.be/.test(u.hostname)) return u.pathname.slice(1).split("?")[0];
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}
