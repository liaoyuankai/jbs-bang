import path from "node:path";

const DEV_SECRET = "dev-insecure-secret-change-me";
const PLACEHOLDER_SECRETS = new Set([DEV_SECRET, "change-me", "change-me-too", ""]);

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
    return process.env.SESSION_SECRET || DEV_SECRET;
  },
  get defaultCity(): string {
    return process.env.DEFAULT_CITY || "西安";
  },
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  /** Why the session secret is unacceptable on a production build, or null if it is fine. */
  get sessionSecretProblem(): string | null {
    if (!this.isProduction) return null;
    const s = process.env.SESSION_SECRET ?? "";
    if (PLACEHOLDER_SECRETS.has(s)) return "SESSION_SECRET 未设置或仍是占位值";
    if (s.length < 32) return "SESSION_SECRET 太短（至少 32 个字符）";
    return null;
  },
};
