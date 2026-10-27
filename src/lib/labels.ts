import type { DatabaseSync } from "node:sqlite";
import type { Entry } from "./types";

export type ConfidenceLabel =
  | "已撤下"
  | "平台核验"
  | "多方印证"
  | "历史存档·单方陈述"
  | "单方陈述"
  | "历史存档"
  | "多方好评"
  | "好评";

export const MULTI_SOURCE_MIN = 3;

function independentReporters(db: DatabaseSync, entry: Entry): number {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT vid) AS n FROM entries
       WHERE subject_id = ? AND list = ? AND category = ? AND status = 'published'`,
    )
    .get(entry.subjectId, entry.list, entry.category) as { n: number };
  return row.n;
}

/** The trust label shown next to an entry. Order matters: removal and verification win over counting. */
export function confidenceLabel(db: DatabaseSync, entry: Entry): ConfidenceLabel {
  if (entry.status === "removed") return "已撤下";
  if (entry.verified) return "平台核验";
  if (entry.list === "red") {
    if (entry.source === "import") return "历史存档";
    return independentReporters(db, entry) >= MULTI_SOURCE_MIN ? "多方好评" : "好评";
  }
  if (entry.source === "import") return "历史存档·单方陈述";
  return independentReporters(db, entry) >= MULTI_SOURCE_MIN ? "多方印证" : "单方陈述";
}

export function labelTone(label: ConfidenceLabel): "neutral" | "good" | "strong" | "muted" {
  switch (label) {
    case "平台核验":
    case "多方印证":
      return "strong";
    case "多方好评":
    case "好评":
      return "good";
    case "已撤下":
    case "历史存档":
    case "历史存档·单方陈述":
      return "muted";
    default:
      return "neutral";
  }
}
