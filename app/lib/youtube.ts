import { Innertube } from "youtubei.js";

let client: Innertube | null = null;

export async function getYt(): Promise<Innertube> {
  if (!client) client = await Innertube.create({ generate_session_locally: true });
  return client;
}

export function isYouTubeUrl(raw: string): boolean {
  try {
    const { hostname } = new URL(raw);
    return /^(www\.|m\.|music\.)?youtube\.com$|^youtu\.be$/.test(hostname);
  } catch {
    return false;
  }
}

export function parseVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const id = /youtu\.be/.test(u.hostname)
      ? u.pathname.slice(1).split("?")[0]
      : u.searchParams.get("v");
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function isSafeThumbnail(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && /^(i\.ytimg\.com|img\.youtube\.com)$/.test(hostname);
  } catch {
    return false;
  }
}
