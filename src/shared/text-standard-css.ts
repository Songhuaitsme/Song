import { pageGroups, resolveTextColor, type SiteCopy, type TextFormat } from "@/shared/site-copy";
import { fontFamilies, standardDefinitions, standardId, resolveStandard, standardSize, type StandardStyle } from "@/shared/text-standards";

const legacySize = (size: number) => `calc(${size}px * var(--text-size-scale, 1))`;
function formatCss(style: TextFormat): string {
  return `${style.font !== "inherit" ? `font-family:${fontFamilies[style.font]}!important;` : ""}${style.size ? `font-size:${legacySize(style.size)}!important;` : ""}${resolveTextColor(style.color) ? `color:${resolveTextColor(style.color)}!important;` : ""}${style.bold !== null ? `font-weight:${style.bold ? 700 : 400}!important;` : ""}`;
}
const roleSelector = (page: string, role: string) => `html body main[data-copy-page] [data-text-page="${page}"][data-text-role="${role}"]`;
const properties = (style: StandardStyle) => `font-family:${fontFamilies[style.font]}!important;color:${style.color}!important;font-weight:${style.bold ? 700 : 400}!important;`;
export function buildTypographyCss(copy: SiteCopy): string {
  if (!copy.textStandards) {
    let css = "";
    for (const [page] of pageGroups) {
      const t = copy.typography?.[page];
      if (!t) continue;
      const title = page === "global" ? '.site-header .wordmark' : `[data-copy-page="${page}"] :is(h1,h2,h3,h4,h5,h6)`;
      const body = page === "global" ? '.site-header nav,.site-header nav a,.site-footer,.site-footer a' : `[data-copy-page="${page}"] :is(p,figcaption,small,.text-link,.eyebrow,.section-number,.essay-body,.series-feature-link,.photography-card-link,.story-end)`;
      css += `${title}{${formatCss({font:t.titleFont,size:t.titleSize,color:t.titleColor,bold:t.titleBold??null})}}${body}{${formatCss({font:t.bodyFont,size:t.bodySize,color:t.bodyColor,bold:t.bodyBold??null})}}`;
    }
    for (const [key, style] of Object.entries(copy.textFormats ?? {})) css += `[data-text-format="${encodeURIComponent(key)}"],[data-text-format="${encodeURIComponent(key)}"] .essay-body p{${formatCss(style)}}`;
    return css;
  }
  const standards = copy.textStandards;
  let css = "";
  for (const def of standardDefinitions) {
    const style = resolveStandard(standards, def);
    const selector = roleSelector(def.page, def.role);
    css += `${selector}{${properties(style)}font-size:${standardSize(def, style, "desktop")}!important;}`;
    css += `@media(max-width:900px){${selector}{font-size:${standardSize(def, style, "tablet")}!important;}}`;
    css += `@media(max-width:760px){${selector}{font-size:${standardSize(def, style, "mobile")}!important;}}`;
  }
  css += `html body main[data-copy-page] a:is(:hover,:focus-visible,[aria-current="page"])[data-text-role="navigation"],html body main[data-copy-page] a:is(:hover,:focus-visible,[aria-current="page"])[data-text-role="navigation"] [data-text-role="navigation"],html body main[data-copy-page] a:is(:hover,:focus-visible)[data-text-role="link"],html body main[data-copy-page] a:is(:hover,:focus-visible)[data-text-role="link"] [data-text-role="link"]{color:var(--ink)!important;}`;
  for (const [key, override] of Object.entries(standards.overrides)) {
    const scope = key.slice(0, key.indexOf("|"));
    const def = standardDefinitions.find(item => standardId(item.page, item.role) === scope);
    if (!def) continue;
    const selector = `html body main[data-copy-page] [data-text-page="${def.page}"][data-text-role="${def.role}"][data-scoped-format="${encodeURIComponent(key)}"]`;
    // Body overrides reach prose paragraphs, while captions keep their own role.
    const targets = `${selector},${selector} .essay-body p[data-text-role="body"]`;
    const base = `${override.font !== "inherit" ? `font-family:${fontFamilies[override.font]}!important;` : ""}${resolveTextColor(override.color) ? `color:${resolveTextColor(override.color)}!important;` : ""}${override.bold !== null ? `font-weight:${override.bold ? 700 : 400}!important;` : ""}`;
    css += `${targets}{${base}${override.size ? `font-size:${standardSize(def, override, "desktop")}!important;` : ""}}`;
    if (override.size) {
      css += `@media(max-width:900px){${targets}{font-size:${standardSize(def, override, "tablet")}!important;}}`;
      css += `@media(max-width:760px){${targets}{font-size:${standardSize(def, override, "mobile")}!important;}}`;
    }
  }
  return css;
}
