"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { checkRate, RATE_MESSAGES } from "@/lib/ratelimit";
import { castSiteVote, getSiteVote, isSiteVoteChoice, siteVoteTally, type SiteVoteChoice, type SiteVoteTally } from "@/lib/repo/site-votes";
import { getClientIp, getOrSetVid, ipHash, readVid } from "@/lib/visitor";

export type SiteVoteState = SiteVoteTally & { mine: SiteVoteChoice | null; error?: string };

export async function siteVoteStatusAction(): Promise<SiteVoteState> {
  const db = getDb();
  const vid = await readVid();
  return { ...siteVoteTally(db), mine: vid ? getSiteVote(db, vid) : null };
}

export async function siteVoteAction(choice: SiteVoteChoice): Promise<SiteVoteState> {
  const db = getDb();
  if (!isSiteVoteChoice(choice)) return { ...siteVoteTally(db), mine: null, error: "无效的选择" };
  const vid = await getOrSetVid();
  const ip = ipHash(await getClientIp());
  if (getSiteVote(db, vid) !== choice) {
    if (!checkRate(db, ip, "vote")) return { ...siteVoteTally(db), mine: getSiteVote(db, vid), error: RATE_MESSAGES.vote };
    castSiteVote(db, { vid, ipHash: ip, choice });
    revalidatePath("/admin/feedback");
  }
  return { ...siteVoteTally(db), mine: choice };
}
