import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Footer, Nav } from "@/components/Nav";
import { SubmitFab } from "@/components/SubmitFab";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: config.siteName,
  description: "剧本杀店家、DM、玩家的红榜与黑榜。匿名发布，即时公开，下架留痕。",
  appleWebApp: { capable: true, title: config.siteName, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-2xl px-4 py-4 sm:py-5">{children}</main>
        <Footer />
        <SubmitFab />
      </body>
    </html>
  );
}
