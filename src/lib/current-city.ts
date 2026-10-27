import { cookies } from "next/headers";
import { config } from "./config";

export const CITY_COOKIE = "city";

export async function getCurrentCity(): Promise<string> {
  const store = await cookies();
  const v = store.get(CITY_COOKIE)?.value?.trim();
  return v && v.length <= 20 ? v : config.defaultCity;
}
