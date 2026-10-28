// Shared by server and client code: no node imports here.
export type ReportTargetKind = "entry" | "comment";

export const REPORT_REASONS = ["泄露联系方式或隐私", "人身攻击或辱骂", "内容不实", "广告或与剧本杀无关", "其他"] as const;
export const REPORT_DETAIL_MAX = 200;

export function isReportTargetKind(v: unknown): v is ReportTargetKind {
  return v === "entry" || v === "comment";
}

export function isReportReason(v: unknown): v is (typeof REPORT_REASONS)[number] {
  return typeof v === "string" && (REPORT_REASONS as readonly string[]).includes(v);
}
