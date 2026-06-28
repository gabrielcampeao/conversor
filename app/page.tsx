"use client";

import { useState, useEffect } from "react";

interface VideoInfo {
  title: string;
  thumbnail: string;
  qualities: number[];
}

const BITRATES = [64, 96, 128, 256, 320];

function qualityLabel(h: number) {
  if (h >= 2160) return "4K";
  if (h >= 1440) return "2K";
  return `${h}p`;
}

function chip(active: boolean) {
  return `px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
    active
      ? "bg-violet-600 border-violet-600 text-white"
      : "border-neutral-200 dark:border-[#2a2a2a] text-neutral-500 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 dark:hover:border-violet-600"
  }`;
}

export default function Home() {
  const [dark, setDark]               = useState(true);
  const [url, setUrl]                 = useState("");
  const [loading, setLoading]         = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError]             = useState("");
  const [videoInfo, setVideoInfo]     = useState<VideoInfo | null>(null);
  const [format, setFormat]           = useState<"mp4" | "mp3">("mp4");
  const [quality, setQuality]         = useState(720);
  const [bitrate, setBitrate]         = useState(320);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle("dark");
    setDark(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  async function fetchInfo() {
    if (!url.trim()) return;
    setError("");
    setVideoInfo(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao buscar informações");
      const info = data as VideoInfo;
      setVideoInfo(info);
      setQuality(info.qualities.includes(720) ? 720 : info.qualities.at(-1)!);
      setFormat("mp4");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!videoInfo || downloading) return;
    setDownloading(true);
    const params = new URLSearchParams({
      url, title: videoInfo.title, format,
      quality: String(quality), bitrate: String(bitrate),
    });
    const a = document.createElement("a");
    a.href = `/api/download?${params}`;
    a.download = `${videoInfo.title}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 4000);
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-3 py-16 sm:py-10 sm:justify-center
      bg-neutral-100 dark:bg-[#0d0d0d]">

      <button
        onClick={toggleDark}
        title={dark ? "Modo claro" : "Modo escuro"}
        className="fixed top-3 right-3 z-50 w-9 h-9 flex items-center justify-center rounded-full
          bg-white dark:bg-[#1e1e1e] border border-neutral-200 dark:border-[#2a2a2a]
          text-neutral-400 dark:text-neutral-500
          hover:text-neutral-700 dark:hover:text-neutral-200 transition-all"
      >
        {dark ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="5" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2}
              d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>

      <div className="w-full max-w-xl flex flex-col gap-4 sm:gap-5
        bg-white dark:bg-[#141414] rounded-2xl
        border border-neutral-200 dark:border-[#232323]
        shadow-sm dark:shadow-none p-4 sm:p-6 md:p-8">

        <div className="text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white tracking-tight">
            Conversor Online
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-neutral-400 dark:text-neutral-600">
            Gratuito e sem anúncios. Cole o link do YouTube e baixe.
          </p>
        </div>

        <div className="flex rounded-xl overflow-hidden
          border border-neutral-200 dark:border-[#2a2a2a]
          focus-within:border-neutral-400 dark:focus-within:border-[#444] transition-colors">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(""); setVideoInfo(null); }}
            onKeyDown={(e) => e.key === "Enter" && fetchInfo()}
            placeholder="Cole o link aqui…"
            className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 sm:py-3 text-sm bg-transparent outline-none
              text-neutral-800 dark:text-neutral-100
              placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
          />
          <button
            onClick={fetchInfo}
            disabled={loading || !url.trim()}
            className="shrink-0 px-4 sm:px-5 text-sm font-semibold
              text-neutral-900 dark:text-white
              bg-neutral-100 hover:bg-neutral-200 dark:bg-[#2a2a2a] dark:hover:bg-[#333]
              disabled:opacity-40 transition-colors"
          >
            {loading ? "…" : "Buscar"}
          </button>
        </div>

        {error && (
          <div className="flex gap-2 items-start px-3 sm:px-4 py-3 rounded-xl
            text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/20
            border border-red-100 dark:border-red-900/30">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-xs sm:text-sm">{error}</span>
          </div>
        )}

        {videoInfo && (
          <div className="flex flex-col rounded-xl overflow-hidden border border-neutral-200 dark:border-[#232323]">

            {videoInfo.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={videoInfo.thumbnail} alt="" className="w-full object-cover max-h-40 sm:max-h-52" />
            )}

            <div className="flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 md:p-5 bg-neutral-50 dark:bg-[#1a1a1a]">

              <p className="text-xs sm:text-sm font-medium leading-snug line-clamp-2 text-neutral-800 dark:text-neutral-200">
                {videoInfo.title}
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase text-neutral-400 dark:text-neutral-600">
                  Formato
                </span>
                <div className="flex rounded-lg overflow-hidden border border-neutral-200 dark:border-[#2a2a2a] text-sm font-medium">
                  {(["mp4", "mp3"] as const).map((f, i) => (
                    <div key={f} className="flex-1 flex">
                      {i > 0 && <div className="w-px bg-neutral-200 dark:bg-[#2a2a2a]" />}
                      <button
                        onClick={() => setFormat(f)}
                        className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm transition-colors ${
                          format === f
                            ? "bg-violet-600 text-white"
                            : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-[#222]"
                        }`}
                      >
                        {f === "mp4" ? (
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        )}
                        {f.toUpperCase()}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {format === "mp3" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase text-neutral-400 dark:text-neutral-600">
                    Qualidade do Áudio
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {BITRATES.map((b) => (
                      <button key={b} onClick={() => setBitrate(b)} className={chip(bitrate === b)}>
                        {b} kbps
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {format === "mp4" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] sm:text-[11px] font-semibold tracking-widest uppercase text-neutral-400 dark:text-neutral-600">
                    Qualidade
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {videoInfo.qualities.map((h) => (
                      <button key={h} onClick={() => setQuality(h)} className={chip(quality === h)}>
                        {qualityLabel(h)}
                      </button>
                    ))}
                  </div>
                  {quality > 720 && (
                    <p className="text-xs text-neutral-400 dark:text-neutral-600">
                      Acima de 720p pode demorar um pouco mais.
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full py-2.5 sm:py-3 rounded-xl text-sm font-semibold text-white
                  bg-violet-600 hover:bg-violet-700 disabled:opacity-40
                  flex items-center justify-center gap-2 transition-colors"
              >
                {downloading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Iniciando download…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Baixar {format === "mp3" ? `MP3 ${bitrate}kbps` : `MP4 ${qualityLabel(quality)}`}
                  </>
                )}
              </button>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
