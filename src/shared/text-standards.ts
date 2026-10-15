import type { CopyPage, FontChoice, SiteCopy, TextFormat } from "./site-copy";
import { storyCoverType } from "@/shared/story-cover-standard";

export const fontFamilies: Record<FontChoice, string> = {
  song: '"Songti SC","SimSun","STSong","Noto Serif SC",serif',
  sans: '"Inter","Noto Sans SC","Microsoft YaHei","PingFang SC",sans-serif',
  kai: '"KaiTi","STKaiti",serif',
  hei: '"Microsoft YaHei","PingFang SC",sans-serif',
};
export const colorPalette = [
  ["墨色", "#242824"], ["纯黑", "#000000"], ["深灰", "#454b45"],
  ["灰绿色", "#626961"], ["中灰", "#777777"], ["浅灰", "#a5aea2"],
  ["墨绿", "#3c554b"], ["棕色", "#a14d2b"], ["蓝色", "#365f83"],
  ["紫色", "#715a82"], ["白色", "#ffffff"],
] as const;
export const textRoles = ["brand", "navigation", "footer", "footerLink", "hero", "pageTitle", "sectionTitle", "itemTitle", "summary", "body", "label", "category", "caption", "link", "overlayTitle", "overlaySummary", "overlayLabel", "overlayLink"] as const;
export type TextRole = typeof textRoles[number];
export type StandardStyle = { font: FontChoice; size: number; color: string; bold: boolean };
export type TextStandards = {
  version: 2;
  styles: Record<string, StandardStyle>;
  overrides: Record<string, TextFormat>;
};
export type TextStandardDefinition = {
  page: CopyPage; role: TextRole; label: string; sample: string;
  baseSize: number; desktop: string; tablet: string; mobile: string;
  font: FontChoice; color: string; bold: boolean; initialSize: number;
};
const titleRoles = new Set<TextRole>(["hero", "pageTitle", "sectionTitle", "itemTitle", "overlayTitle"]);
export function roleDefault(role: TextRole): Pick<StandardStyle, "font" | "color" | "bold"> {
  return {
    font: titleRoles.has(role) || role === "body" ? "song" : "sans",
    color: role.startsWith("overlay") ? "#ffffff" : role === "link" || role === "footerLink" ? "#3c554b" : role === "category" ? "#a14d2b" : titleRoles.has(role) || role === "brand" || role === "body" ? "#242824" : "#626961",
    bold: role === "brand",
  };
}
function define(page: CopyPage, role: TextRole, label: string, sample: string, baseSize: number, desktop: string, mobile = desktop, tablet = desktop, initialSize = 0): TextStandardDefinition {
  return { page, role, label, sample, baseSize, desktop, tablet, mobile, initialSize, ...roleDefault(role) };
}
// Sizes describe the existing responsive CSS. Custom sizes scale this shape,
// rather than forcing a large desktop heading onto a phone.
export const standardDefinitions: TextStandardDefinition[] = [
  define("global", "brand", "品牌", "SONFORU", 19, "24.7px", "19px", "19px", 19),
  define("global", "navigation", "导航", "首页　摄影　随笔　收藏　关于", 20, "20px", "16px", "15px"),
  define("global", "link", "导航工作室入口", "工作室 ↗", 18, "18px", "16px", "13px"),
  define("global", "footer", "页脚版权", "© SONG / 影像与文字", 15, "15px"),
  define("global", "footerLink", "页脚入口", "工作室 ↗", 15, "15px"),
  define("home", "hero", "摄影主标题", "在雾与城之间", 90, "117px", "clamp(32px, 8.6vw, 46px)", "clamp(36px, 6vw, 54px)", 90),
  define("home", "sectionTitle", "随笔与收藏栏目标题", "希望世界像风一样穿过我", 50, "65px", "30px", "clamp(30px, 3.4vw, 54px)", 50),
  define("home", "itemTitle", "收藏条目标题", "雨天的长镜头", 25, "32.5px", "25px", "25px", 25),
  define("home", "summary", "简介、摘要与收藏说明", "沿着雨、桥与穿城而过的轨道。", 20, "26px", "16px", "20px", 20),
  define("home", "label", "栏目编号", "01 / 摄影", 15, "19.5px", "15px", "15px", 15),
  define("home", "category", "收藏分类", "影像 / 习惯", 13, "16.9px", "13px", "13px", 13),
  define("home", "link", "阅读链接", "阅读全文 →", 15, "19.5px", "15px", "15px", 15),
  define("series", "overlayTitle", "封面主标题（与摄影详情共用）", "在雾与城之间", storyCoverType.title.base, storyCoverType.title.desktop, storyCoverType.title.mobile, storyCoverType.title.tablet),
  define("series", "overlaySummary", "封面上的简介", "收集城市暂时失焦的时刻。", 17, "17px", "16px"),
  define("series", "overlayLabel", "封面标签与数量（与摄影详情共用）", "SONFORU / SERIES 01", storyCoverType.label.base, storyCoverType.label.desktop, storyCoverType.label.mobile, storyCoverType.label.tablet),
  define("series", "overlayLink", "封面上的阅读链接", "READ MORE", 12, "12px"),
  define("series", "sectionTitle", "列表栏目标题", "摄影故事", 28, "28px", "26px"),
  define("series", "itemTitle", "摄影条目标题", "海风经过以后", 40, "40px"),
  define("series", "summary", "列表简介", "沿着地点、光线与记忆继续观看。", 20, "20px"),
  define("series", "label", "署名、编号与数量", "SONG · SERIES 02", 15, "15px"),
  define("series", "link", "条目阅读链接", "READ MORE", 12, "12px"),
  define("story", "overlayTitle", "封面主标题（与摄影目录共用）", "在雾与城之间", storyCoverType.title.base, storyCoverType.title.desktop, storyCoverType.title.mobile, storyCoverType.title.tablet),
  define("story", "overlayLabel", "封面标签、数量与署名（与摄影目录共用）", "PHOTOGRAPHIC SERIES / SONG", storyCoverType.label.base, storyCoverType.label.desktop, storyCoverType.label.mobile, storyCoverType.label.tablet),
  define("story", "overlayLink", "全屏照片按钮", "关闭　上一张　下一张", 14, "14px"),
  define("story", "overlaySummary", "全屏照片说明", "01 / 在雨中停留片刻", 14, "14px"),
  define("story", "pageTitle", "私密内容页标题", "摄影系列", 64, "clamp(36px, 4.6vw, 64px)", "36px"),
  define("story", "summary", "系列简介", "让画面多停留几秒。", 17, "17px", "15.2px"),
  define("story", "caption", "图片注释", "桥下的光，慢慢经过水面。", 15.68, "15.68px", "14.4px"),
  define("story", "label", "地点、日期与结束标签", "重庆 · 2026 / END", 12, "12px", "11px"),
  define("story", "link", "返回目录", "返回系列目录", 12, "12px"),
  define("essays", "pageTitle", "页面主标题", "写下来的事", 84, "clamp(44px, 5.3vw, 84px)", "clamp(36px, 9vw, 50px)"),
  define("essays", "itemTitle", "随笔条目标题", "希望世界像风一样穿过我", 40, "40px"),
  define("essays", "summary", "页面简介", "关于观看、行走与偶然留下的片段。", 22, "22px", "18px"),
  define("essays", "caption", "随笔摘要", "有时拍照是为了保存当时的那层玻璃。", 18, "18px"),
  define("essays", "label", "编号、标签与日期", "NOTES / 2026-10-11", 16, "16px", "14px"),
  define("essay", "pageTitle", "随笔标题", "希望世界像风一样穿过我", 70, "70px", "clamp(36px, 9vw, 50px)"),
  define("essay", "summary", "随笔摘要", "只记下当时看见的颜色、声音和天气。", 25, "25px", "20px"),
  define("essay", "body", "长篇正文", "有时拍照并不是为了保存一座城市。", 25, "25px", "20px"),
  define("essay", "caption", "配图说明", "雨后的街道", 12.8, "12.8px"),
  define("essay", "label", "日期与标签", "2026-10-11 / NOTE", 12, "12px"),
  define("collection", "pageTitle", "页面主标题", "喜欢的东西", 84, "clamp(44px, 5.3vw, 84px)", "clamp(36px, 9vw, 50px)"),
  define("collection", "itemTitle", "收藏条目标题", "雨天的长镜头", 40, "clamp(30px, 2.6vw, 40px)", "28px"),
  define("collection", "summary", "简介与收藏说明", "值得反复回看的细节。", 22, "22px", "18px"),
  define("collection", "label", "栏目标签", "CABINET / 收藏", 16, "16px", "14px"),
  define("collection", "category", "分类与编号", "影像 · 01", 16, "16px", "14px"),
  define("collection", "link", "来源链接", "查看来源", 18, "18px", "16px"),
  define("about", "pageTitle", "关于页标题", "关于观看与生活", 84, "clamp(44px, 5.3vw, 84px)", "clamp(36px, 9vw, 50px)"),
  define("about", "body", "介绍正文", "用影像与文字，记下走过的地方。", 24, "24px", "20px"),
  define("about", "caption", "补充说明与联系方式", "欢迎来信。", 18, "18px"),
  define("about", "label", "栏目标签", "ABOUT / 关于", 16, "16px", "14px"),
  ...(["home", "series", "story", "essays", "essay", "collection", "about"] as const).map(page => define(page, "body", "新增文字段落", "记下今天的一点片段。", 17, "17px", "15.68px")).filter(item => item.page !== "essay" && item.page !== "about"),
];
export const standardId = (page: CopyPage, role: TextRole) => `${page}:${role}`;
export const scopedFormatKey = (page: CopyPage, role: TextRole, fieldKey: string) => `${standardId(page, role)}|${fieldKey}`;
export function findStandard(page: CopyPage, role: TextRole) { return standardDefinitions.find(item => item.page === page && item.role === role); }
export function defaultStandard(definition: TextStandardDefinition): StandardStyle {
  return { font: definition.font, size: definition.initialSize, color: definition.color, bold: definition.bold };
}
export function linkedStandardIds(key: string): string[] {
  const [page, role] = key.split(":");
  return (page === "series" || page === "story") && (role === "overlayTitle" || role === "overlayLabel")
    ? [`series:${role}`, `story:${role}`] : [key];
}
export function updateStandard(standards: TextStandards, key: string, style: StandardStyle): TextStandards {
  return { ...standards, styles: { ...standards.styles, ...Object.fromEntries(linkedStandardIds(key).map(id => [id, { ...style }])) } };
}
export function resolveStandard(standards: TextStandards, definition: TextStandardDefinition): StandardStyle {
  // Existing settings may contain different values for the two covers. The
  // directory is the shared source until either editor updates the linked pair.
  for (const id of linkedStandardIds(standardId(definition.page, definition.role))) {
    if (standards.styles[id]) return standards.styles[id];
  }
  return defaultStandard(definition);
}
export function enableTextStandards(copy: SiteCopy): SiteCopy {
  if (copy.textStandards) return copy;
  // Legacy typography/textFormats stay untouched as the archive. No write on read.
  return { ...copy, textStandards: { version: 2, styles: Object.fromEntries(standardDefinitions.map(def => [standardId(def.page, def.role), defaultStandard(def)])), overrides: {} } };
}
export const inheritedFormat = (): TextFormat => ({ font: "inherit", size: 0, bold: null, color: "inherit" });
export function followsStandard(format: TextFormat) { return format.font === "inherit" && format.size === 0 && format.bold === null && (!format.color || format.color === "inherit"); }
export function applyTextFormat(copy: SiteCopy, key: string, format: TextFormat, page?: CopyPage, role?: TextRole): SiteCopy {
  if (!copy.textStandards) return { ...copy, textFormats: { ...copy.textFormats, [key]: format } };
  if (!page || !role || !findStandard(page, role)) throw new Error("请刷新页面后编辑文字格式");
  const scopedKey = scopedFormatKey(page, role, key);
  const overrides = { ...copy.textStandards.overrides };
  if (followsStandard(format)) delete overrides[scopedKey];
  else overrides[scopedKey] = format;
  return { ...copy, textStandards: { ...copy.textStandards, overrides } };
}
export function standardSize(def: TextStandardDefinition, style: Pick<StandardStyle, "size">, device: "desktop" | "tablet" | "mobile"): string {
  const original = def[device];
  return style.size ? `calc((${original}) * ${style.size / def.baseSize})` : original;
}
export function previewPixels(def: TextStandardDefinition, style: Pick<StandardStyle, "size">, device: "desktop" | "tablet" | "mobile", width = device === "mobile" ? 390 : device === "tablet" ? 820 : 1440): number {
  const units = [...def[device].matchAll(/([\d.]+)(px|vw|rem)/g)].map(([, number, unit]) => Number(number) * (unit === "vw" ? width / 100 : unit === "rem" ? 16 : 1));
  const pixels = def[device].startsWith("clamp") ? Math.max(units[0], Math.min(units[1], units[2])) : units[0];
  return Math.round(pixels * (style.size ? style.size / def.baseSize : 1) * 100) / 100;
}
export function isHexColor(value: unknown): value is string { return typeof value === "string" && /^#[\da-f]{6}$/i.test(value); }
export function validateTextStandards(value: unknown, validateFormat: (value: unknown) => TextFormat): TextStandards {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("文字标准格式无效");
  const input = value as TextStandards;
  if (input.version !== 2 || !input.styles || typeof input.styles !== "object" || Array.isArray(input.styles) || !input.overrides || typeof input.overrides !== "object" || Array.isArray(input.overrides)) throw new Error("文字标准版本或格式无效");
  const styles: Record<string, StandardStyle> = {};
  for (const [key, style] of Object.entries(input.styles)) {
    if (!standardDefinitions.some(def => standardId(def.page, def.role) === key) || !style || typeof style !== "object" || !Object.hasOwn(fontFamilies, style.font) || !Number.isInteger(style.size) || (style.size !== 0 && (style.size < 10 || style.size > 120)) || !isHexColor(style.color) || typeof style.bold !== "boolean") throw new Error("文字标准无效：字号为 10–120 或 0，颜色为六位 HEX");
    styles[key] = { font: style.font, size: style.size, color: style.color.toLowerCase(), bold: style.bold };
  }
  if (Object.keys(input.overrides).length > 5000) throw new Error("单条文字格式过多");
  const overrides: Record<string, TextFormat> = {};
  for (const [key, style] of Object.entries(input.overrides)) {
    const [scope, field] = key.split("|");
    if (key.length > 500 || !standardDefinitions.some(def => standardId(def.page, def.role) === scope) || !field || !/^[-a-zA-Z0-9:|._]+$/.test(key) || !/^(copy|series|essay|favorite|photo|about):[^:]*:.+$/.test(key.slice(scope.length + 1))) throw new Error("单条文字格式目标无效");
    const validated = validateFormat(style);
    if (!followsStandard(validated)) overrides[key] = validated;
  }
  for (const role of ["overlayTitle", "overlayLabel"]) {
    const shared = styles[`series:${role}`] ?? styles[`story:${role}`];
    if (shared) for (const id of linkedStandardIds(`series:${role}`)) styles[id] = { ...shared };
  }
  return { version: 2, styles, overrides };
}
