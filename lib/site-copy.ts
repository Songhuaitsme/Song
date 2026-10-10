export const copyFields = [
  ["global","brand","品牌字样","SONFORU"],
  ["global","navSeries","导航：摄影","摄影"],["global","navEssays","导航：随笔","随笔"],["global","navCollection","导航：收藏","收藏"],["global","navAbout","导航：关于","关于"],["global","studio","工作室入口","工作室"],["global","copyright","页脚版权文字","SONFORU © 2026"],
  ["home","homeImageLabel","封面图片标签","SERIES 01"],["home","homeSeriesLabel","摄影栏目标签","01 / 摄影系列"],["home","enterSeries","进入系列按钮","进入系列"],["home","homeEssayLabel","随笔栏目标签","02 / 随笔"],["home","readEssay","阅读随笔按钮","阅读全文"],["home","homeCollectionLabel","收藏栏目标签","03 / 收藏"],["home","homeCollectionTitle","收藏栏目标题","最近留下的东西"],["home","homeEmptyLabel","空页面标签","SONG / 影像与文字"],["home","homeEmptyTitle","空页面标题","内容正在整理中"],["home","homeEmptyDescription","空页面说明","公开内容会在这里出现。"],
  ["series","seriesLabel","摄影首图标签","SONFORU / SERIES 01"],["series","readSeries","摄影阅读按钮","READ MORE"],["series","photoUnit","照片数量单位","张照片"],["series","seriesListTitle","摄影列表标题","摄影故事"],["series","seriesListIntro","摄影列表说明","沿着地点、光线与记忆继续观看。"],["series","seriesAuthor","摄影署名","SONG"],["series","seriesNumberLabel","系列编号前缀","SERIES"],["series","photographs","英文照片单位","PHOTOGRAPHS"],["series","seriesEmpty","摄影空列表说明","暂时没有公开的摄影系列。"],
  ["story","storyLabel","系列详情标签","SONFORU / PHOTOGRAPHIC SERIES"],["story","storyLede","系列详情简介标签","摄影系列"],["story","storyEnd","系列结束标签","END"],["story","returnSeries","返回目录按钮","返回系列目录"],["story","photoClose","全屏：关闭","关闭"],["story","photoPrev","全屏：上一张","上一张"],["story","photoNext","全屏：下一张","下一张"],
  ["essays","essayLabel","随笔栏目标签","NOTES / 随笔"],["essays","essayTitle","随笔页标题","写下来的事"],["essays","essayIntro","随笔页说明","关于观看、行走与偶然留下的片段。"],["essays","essayEmpty","随笔空列表说明","暂时没有公开的随笔。"],["essay","essayDetailLabel","随笔详情日期标签","NOTE"],
  ["collection","collectionLabel","收藏栏目标签","CABINET / 收藏"],["collection","collectionTitle","收藏页标题","喜欢的东西"],["collection","collectionIntro","收藏页说明","书、影像、习惯，以及值得反复回看的细节。"],["collection","collectionSource","收藏来源按钮","查看来源"],["collection","collectionEmpty","收藏空列表说明","暂时没有公开的收藏。"],["about","aboutLabel","关于栏目标签","ABOUT / 关于"],
] as const;
export type CopyKey = typeof copyFields[number][1];
export const pageGroups = [ ["global","导航与页脚"],["home","首页"],["series","摄影目录"],["story","摄影详情"],["essays","随笔目录"],["essay","随笔详情"],["collection","收藏"],["about","关于"] ] as const;
export type CopyPage = typeof pageGroups[number][0];
export type CopyRow = { id: string; text: string };
export const fontOptions = [["song","宋体"],["sans","黑体"],["kai","楷体"],["hei","微软雅黑"]] as const;
export type FontChoice = typeof fontOptions[number][0];
export type TypeSettings = { titleFont:FontChoice; bodyFont:FontChoice; titleSize:number; bodySize:number };
export type SiteCopy = { typography?:Partial<Record<CopyPage,TypeSettings>>; values: Record<CopyKey,string>; extras: Partial<Record<CopyPage,CopyRow[]>> };
export const defaultSiteCopy: SiteCopy = { values: Object.fromEntries(copyFields.map((field)=>[field[1],field[3]])) as Record<CopyKey,string>, extras: {} };
export function validateSiteCopy(record: Record<string,unknown>): SiteCopy {
  const values = record.values;
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("页面文字格式无效");
  const result = structuredClone(defaultSiteCopy);
  for (const [,key] of copyFields) {
    const value = (values as Record<string,unknown>)[key];
    if(value === undefined) continue;
    if(typeof value !== "string" || value.length>5000)throw new Error("页面文字内容过长或格式无效");
    result.values[key]=value.trim();
  }
  if(record.extras !== undefined) {
    if(!record.extras || typeof record.extras !== "object" || Array.isArray(record.extras))throw new Error("新增段落格式无效");
    for(const [page] of pageGroups) {
      const rows=(record.extras as Record<string,unknown>)[page];if(rows===undefined)continue;
      if(!Array.isArray(rows)||rows.length>100)throw new Error("每个页面最多添加 100 段文字");
      const ids=new Set<string>();
      result.extras[page]=rows.map((row)=>{
        if(!row||typeof row!=="object"||typeof row.id!=="string"||!row.id||row.id.length>100||ids.has(row.id)||typeof row.text!=="string"||row.text.length>10000)throw new Error("新增段落格式无效");
        ids.add(row.id);return {id:row.id,text:row.text.trim()};
      });
    }
  }
  if(record.typography !== undefined) {
    if(!record.typography || typeof record.typography !== "object" || Array.isArray(record.typography))throw new Error("字体设置格式无效");
    result.typography={};
    for(const [page] of pageGroups){
      const setting=(record.typography as Record<string,unknown>)[page];if(setting===undefined)continue;
      if(!setting||typeof setting!=="object"||Array.isArray(setting))throw new Error("字体设置格式无效");
      const t=setting as TypeSettings;
      if(!fontOptions.some(([key])=>key===t.titleFont)||!fontOptions.some(([key])=>key===t.bodyFont)||!Number.isInteger(t.titleSize)||!Number.isInteger(t.bodySize)||(t.titleSize!==0&&(t.titleSize<12||t.titleSize>120))||(t.bodySize!==0&&(t.bodySize<10||t.bodySize>40)))throw new Error("字号范围：标题 12–120，正文 10–40；0 为默认字号");
      result.typography[page]={titleFont:t.titleFont,bodyFont:t.bodyFont,titleSize:t.titleSize,bodySize:t.bodySize};
    }
  }
  return result;
}
