import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { searchSubjects } from "@/lib/repo/subjects";
import { isSubjectType } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 50);
  const type = url.searchParams.get("type");
  const city = url.searchParams.get("city")?.trim() || undefined;
  if (!q) return NextResponse.json([]);
  const results = searchSubjects(getDb(), q, {
    type: isSubjectType(type) ? type : undefined,
    city,
    limit: 10,
  }).map((s) => ({ id: s.id, type: s.type, name: s.name, city: s.city, shopName: s.shopName }));
  return NextResponse.json(results);
}
