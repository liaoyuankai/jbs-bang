export const PII_MASK = "[已隐去联系方式]";

const ID_CARD = /\d{17}[\dXx]/g;
// 1[3-9]x xxxx xxxx with optional spaces or dashes between groups
const MOBILE = /1[3-9]\d[\s-]*\d{4}[\s-]*\d{4}/g;
// 微信 / vx / wx / weixin / wechat / 扣扣 / qq followed by a handle
const LABELED_HANDLE =
  /(微\s*信|v\s*x|w\s*x|weixin|wechat|扣\s*扣|q\s*q)\s*(?:号|是|：|:|\s)*([A-Za-z0-9_-]{5,20})/gi;
// any remaining run of 7+ digits is a phone/QQ number, never a price or a date
const LONG_DIGITS = /\d{7,}/g;

/** Replace phone numbers, ID numbers and WeChat/QQ handles with a mask. */
export function scrubPII(text: string): string {
  return text
    .replace(ID_CARD, PII_MASK)
    .replace(MOBILE, PII_MASK)
    .replace(LABELED_HANDLE, (_m, label: string) => `${label.replace(/\s+/g, "")}${PII_MASK}`)
    .replace(LONG_DIGITS, PII_MASK);
}

const LOW_VALUE = /^(点了|同意|赞同|支持|是的|确实|没错|附议|顶|对|同|\+1|1)+$/;

/** True for "+1"-style cells (点了 / 同意 / 支持) that carry no information of their own. */
export function isLowValue(text: string): boolean {
  const core = text.replace(/[\s!！。.、，,~～?？]+/g, "");
  return core.length > 0 && LOW_VALUE.test(core);
}
