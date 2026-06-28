import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Conversor Online",
  description: "Converta vídeos do YouTube para MP4 gratuitamente e sem anúncios.",
  icons: { icon: "/logo.svg" },
};

const themeScript = `(function(){try{var s=localStorage.getItem('theme');if(s!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${geist.variable} h-full antialiased`}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full bg-neutral-100 dark:bg-[#0d0d0d]">
        {children}
      </body>
    </html>
  );
}
