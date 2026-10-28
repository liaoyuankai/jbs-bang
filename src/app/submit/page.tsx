import { SubmitForm, type SubjectOption } from "@/components/SubmitForm";
import { config } from "@/lib/config";
import { getCurrentCity } from "@/lib/current-city";
import { getDb } from "@/lib/db";
import { getSubject, listCities } from "@/lib/repo/subjects";

export const dynamic = "force-dynamic";

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; name?: string }>;
}) {
  const sp = await searchParams;
  const db = getDb();
  const city = await getCurrentCity();
  const cities = Array.from(new Set([config.defaultCity, ...listCities(db, { publicOnly: true })]));
  let initialSubject: SubjectOption | null = null;
  if (sp.subject) {
    const s = getSubject(db, sp.subject);
    if (s) initialSubject = { id: s.id, type: s.type, name: s.name, city: s.city, shopName: s.shopName };
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">投稿</h1>
      <p className="text-sm text-stone-600">
        发布后立即公开，不需要注册，显示为「单方陈述」。写具体的事，不写联系方式，不写纯辱骂；被举报且查实的会下架。
      </p>
      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <SubmitForm initialSubject={initialSubject} initialName={sp.name?.slice(0, 50) ?? ""} city={city} cities={cities} />
      </div>
    </div>
  );
}
