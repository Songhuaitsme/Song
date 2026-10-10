import { getSiteCopy } from "@/lib/content-store";
import { pageGroups, type FontChoice } from "@/lib/site-copy";
const fonts:Record<FontChoice,string>={song:'"Songti SC","SimSun","STSong","Noto Serif SC",serif',sans:'"Noto Sans SC","Microsoft YaHei",sans-serif',kai:'"KaiTi","STKaiti",serif',hei:'"Microsoft YaHei","PingFang SC",sans-serif'};
export async function SiteTypography(){
 const copy=await getSiteCopy();let css="";
 for(const [page] of pageGroups){const t=copy.typography?.[page];if(!t)continue;
 const title=page==="global"?'.site-header .wordmark':`[data-copy-page="${page}"] :is(h1,h2,h3,h4,h5,h6)`;
 const body=page==="global"?'.site-header nav,.site-header nav a,.site-footer,.site-footer a':`[data-copy-page="${page}"] :is(p,figcaption,small,.text-link,.eyebrow,.section-number,.essay-body,.series-feature-link,.photography-card-link,.story-end)`;
 css+=`${title}{font-family:${fonts[t.titleFont]}!important;${t.titleSize?`font-size:${t.titleSize}px!important;`:""}}${body}{font-family:${fonts[t.bodyFont]}!important;${t.bodySize?`font-size:${t.bodySize}px!important;`:""}}`;
 }
 return <style>{css}</style>;
}
