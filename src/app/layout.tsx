import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { BackTrap } from "@/components/BackTrap";
import { Footer, Nav } from "@/components/Nav";
import { NavProgress } from "@/components/NavProgress";
import { SubmitFab } from "@/components/SubmitFab";
import { WelcomeNotice } from "@/components/WelcomeNotice";
import { config } from "@/lib/config";
import { isMaintenance } from "@/lib/maintenance";

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
  const maintenance = isMaintenance();
  return (
    <html lang="zh-CN">
      <body className="min-h-screen">
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        <Nav />
        <main className="mx-auto max-w-2xl px-4 py-4 sm:py-5">{children}</main>
        <Footer />
        {!maintenance && <SubmitFab />}
        <BackTrap />
        {maintenance && <WelcomeNotice />}
      </body>
    </html>
  );
}
