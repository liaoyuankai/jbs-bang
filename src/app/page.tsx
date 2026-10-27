import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM subjects").get() as { n: number };
  return <main className="p-6">subjects: {row.n}</main>;
}
