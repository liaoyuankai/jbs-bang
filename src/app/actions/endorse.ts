"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { isMaintenance } from "@/lib/maintenance";
import { endorse } from "@/lib/repo/endorsements";
import { getEntry } from "@/lib/repo/entries";
import { getOrSetVid } from "@/lib/visitor";

export async function endorseAction(entryId: string): Promise<void> {
  if (isMaintenance()) return;
  const db = getDb();
  const entry = getEntry(db, entryId);
  if (!entry || entry.status !== "published") return;
  const vid = await getOrSetVid();
  endorse(db, entryId, vid);
  revalidatePath(`/e/${entryId}`);
  revalidatePath(`/s/${entry.subjectId}`);
  revalidatePath("/");
}
