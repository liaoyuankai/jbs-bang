export const SUBJECT_TYPES = ["shop", "dm", "player"] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const LISTS = ["red", "black"] as const;
export type ListKind = (typeof LISTS)[number];

export const CATEGORIES: Record<SubjectType, { red: string[]; black: string[] }> = {
  shop: {
    black: ["卡车放鸽", "临时换DM", "乱收费", "客服态度", "退款纠纷", "环境卫生", "强制消费", "其他"],
    red: ["服务好", "环境好", "氛围好", "拼车靠谱", "其他"],
  },
  dm: {
    black: ["场外骂人", "开本摆烂", "剧透", "骚扰越界", "偏袒卡玩家", "迟到放鸽", "其他"],
    red: ["开本认真", "演绎好", "带新人", "性格好", "其他"],
  },
  player: {
    black: ["放鸽跑车", "不补差价", "搅局剧透", "骚扰他人", "言语攻击", "其他"],
    red: ["打本认真", "不扫兴", "大方靠谱", "性格好", "其他"],
  },
};

export function isSubjectType(v: unknown): v is SubjectType {
  return typeof v === "string" && (SUBJECT_TYPES as readonly string[]).includes(v);
}

export function isListKind(v: unknown): v is ListKind {
  return typeof v === "string" && (LISTS as readonly string[]).includes(v);
}

export function typeLabel(t: SubjectType): string {
  return { shop: "店家", dm: "DM", player: "玩家" }[t];
}

export function listLabel(l: ListKind): string {
  return l === "red" ? "红榜" : "黑榜";
}
