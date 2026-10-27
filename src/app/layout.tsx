import type { Metadata } from "next";
import "./globals.css";
import { Footer, Nav } from "@/components/Nav";
import { config } from "@/lib/config";

export const metadata: Metadata = {
  title: config.siteName,
  description: "剧本杀店家、DM、玩家的红榜与黑榜。先审后发，下架留痕。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
