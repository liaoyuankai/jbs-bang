import fs from "node:fs";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import { config } from "@/lib/config";
import { contentTypeFor, evidencePath } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ entryId: string; n: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { entryId, n } = await params;
  const file = evidencePath(config.dataDir, entryId, Number(n));
  if (!file) return new Response("not found", { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: {
      "content-type": contentTypeFor(file),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
