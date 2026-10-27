import path from "node:path";

// Read env lazily so tests and scripts can set variables before first use.
export const config = {
  get siteName(): string {
    return process.env.SITE_NAME || "剧本杀口碑榜";
  },
  get dataDir(): string {
    return process.env.DATA_DIR || path.join(process.cwd(), "data");
  },
  get adminPassword(): string {
    return process.env.ADMIN_PASSWORD || "";
  },
  get sessionSecret(): string {
    return process.env.SESSION_SECRET || "dev-insecure-secret-change-me";
  },
  get defaultCity(): string {
    return process.env.DEFAULT_CITY || "西安";
  },
};
