import { NextResponse, type NextRequest } from "next/server";
import { isMaintenance, maintenanceAllows } from "@/lib/maintenance";

export function proxy(request: NextRequest) {
  if (!isMaintenance() || maintenanceAllows(request.nextUrl.pathname)) return NextResponse.next();
  // rewrite, not redirect: the address bar keeps the shared link, the page shows the maintenance notice
  return NextResponse.rewrite(new URL("/maintenance", request.url));
}

export const config = {
  // skip build assets and files with an extension (favicon, WeChat verification .txt in public/)
  matcher: ["/((?!_next/static|_next/image|.*\\.[A-Za-z0-9]+$).*)"],
};
