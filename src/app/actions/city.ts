"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { CITY_COOKIE } from "@/lib/current-city";

export async function setCity(formData: FormData): Promise<void> {
  const city = String(formData.get("city") ?? "").trim().slice(0, 20);
  const returnTo = String(formData.get("returnTo") ?? "/");
  const store = await cookies();
  if (city) {
    store.set(CITY_COOKIE, city, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
      sameSite: "lax",
      secure: config.isProduction,
    });
  }
  redirect(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/");
}
