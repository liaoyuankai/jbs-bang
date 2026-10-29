/**
 * 维护中：举报太多、站长一个人处理不过来，网站暂停开放。
 * 只留「联系站长」和后台，其余页面都显示维护页（src/proxy.ts），投稿、举报、评论、点赞在服务端一律拒绝。
 * 重新开放：把这里的默认值改成关闭，重新部署。测试里设 MAINTENANCE=0（vitest.config.ts）。
 */
export function isMaintenance(): boolean {
  return process.env.MAINTENANCE !== "0";
}

export const MAINTENANCE_MESSAGE = "网站维护中，暂停投稿、举报和评论。有事请点右上角「联系站长」。";

/** Paths that stay open during maintenance; everything else is rewritten to the maintenance page. */
export function maintenanceAllows(pathname: string): boolean {
  return (
    pathname === "/maintenance" ||
    pathname === "/feedback" ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}
