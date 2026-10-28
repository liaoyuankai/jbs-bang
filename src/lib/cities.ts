import type { DatabaseSync } from "node:sqlite";
import { config } from "./config";
import { listCities } from "./repo/subjects";

/** 直辖市、各省会和计划单列市、主要大城市，按大致的城市规模排；没有投稿的城市也能选到。 */
export const MAJOR_CITIES = [
  "北京", "上海", "广州", "深圳", "天津", "重庆",
  "成都", "杭州", "武汉", "西安", "南京", "苏州", "长沙", "郑州",
  "青岛", "沈阳", "大连", "宁波", "厦门", "福州", "济南", "合肥",
  "昆明", "南宁", "贵阳", "南昌", "太原", "石家庄", "哈尔滨", "长春",
  "无锡", "佛山", "东莞", "珠海", "温州", "常州", "泉州", "烟台", "徐州",
  "兰州", "呼和浩特", "乌鲁木齐", "银川", "西宁", "海口", "三亚", "拉萨",
] as const;

/** The site's default city first, then every major city, then any other city someone has posted about. */
export function cityOptions(db: DatabaseSync): string[] {
  return Array.from(new Set([config.defaultCity, ...MAJOR_CITIES, ...listCities(db, { publicOnly: true })]));
}
