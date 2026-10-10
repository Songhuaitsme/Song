export type Photo = { id: string; seriesId: string; imageUrl: string; originalUrl: string; width: number; height: number; alt: string; caption: string; location: string; takenAt: string; sortOrder: number };
export type AccessLevel = "draft" | "private" | "public";
export type Series = { id: string; slug: string; title: string; description: string; coverUrl: string; access: AccessLevel; sortOrder: number; photos: Photo[] };
export type Essay = { id: string; slug: string; title: string; excerpt: string; body: string; access: AccessLevel; publishedAt: string; sortOrder: number };
export type Favorite = { id: string; title: string; category: string; note: string; imageUrl: string; url: string; access: AccessLevel; sortOrder: number };
export type SiteContent = { series: Series[]; essays: Essay[]; favorites: Favorite[] };

const mistCityPhotos: Photo[] = [
  { id: "photo-01", seriesId: "series-between-mist-and-city", imageUrl: "/photos/01-fog-clock.webp", originalUrl: "/photos/01-fog-clock.webp", width: 1467, height: 2200, alt: "雾气中的城市钟楼与高层建筑", caption: "雾把远处的楼擦去，只留下钟楼确认时间仍在经过。", location: "城市途中", takenAt: "", sortOrder: 1 },
  { id: "photo-02", seriesId: "series-between-mist-and-city", imageUrl: "/photos/02-rain-taxi.webp", originalUrl: "/photos/02-rain-taxi.webp", width: 2200, height: 1466, alt: "雨夜车窗外的黄色出租车与街边灯牌", caption: "雨水停在玻璃上，街道从现实退成了一层颜色。", location: "雨夜", takenAt: "", sortOrder: 2 },
  { id: "photo-03", seriesId: "series-between-mist-and-city", imageUrl: "/photos/03-night-bridge.webp", originalUrl: "/photos/03-night-bridge.webp", width: 1467, height: 2200, alt: "夜色中的桥梁、灯光与湿润路面", caption: "桥的另一侧被强光折叠，夜色则保持沉默。", location: "桥上", takenAt: "", sortOrder: 3 },
  { id: "photo-04", seriesId: "series-between-mist-and-city", imageUrl: "/photos/04-city-fragments.webp", originalUrl: "/photos/04-city-fragments.webp", width: 1467, height: 2200, alt: "城市建筑与道路交错形成的片段", caption: "高架、楼宇和光线，把城市切成短暂的几何。", location: "城中", takenAt: "", sortOrder: 4 },
  { id: "photo-05", seriesId: "series-between-mist-and-city", imageUrl: "/photos/05-river-boat.webp", originalUrl: "/photos/05-river-boat.webp", width: 1505, height: 2200, alt: "高架桥柱之间驶过江面的游船", caption: "船从庞大的桥柱之间经过，像一句被结构包围的小声旁白。", location: "江面", takenAt: "", sortOrder: 5 },
  { id: "photo-06", seriesId: "series-between-mist-and-city", imageUrl: "/photos/06-train-through-city.webp", originalUrl: "/photos/06-train-through-city.webp", width: 1468, height: 2200, alt: "列车穿过旧楼之间，远处可见现代高楼", caption: "列车从旧楼的缝隙里穿过，新城在更远处浮现。", location: "街巷", takenAt: "", sortOrder: 6 },
  { id: "photo-07", seriesId: "series-between-mist-and-city", imageUrl: "/photos/07-jiangnan-bridge.webp", originalUrl: "/photos/07-jiangnan-bridge.webp", width: 1088, height: 1445, alt: "烟雨山色前的江南石桥及水中倒影", caption: "山雾、屋瓦与桥的倒影，让旅程在水面慢下来。", location: "江南", takenAt: "", sortOrder: 7 },
];

function seriesPhotos(
  seriesId: string,
  prefix: string,
  dimensions: Array<[number, number]>,
  notes: Array<[string, string, string, string]>,
): Photo[] {
  return notes.map(([alt, caption, location, takenAt], index) => {
    const imageUrl = `/photos/${prefix}-${String(index + 1).padStart(2, "0")}.webp`;
    return {
      id: `${seriesId}-photo-${String(index + 1).padStart(2, "0")}`,
      seriesId,
      imageUrl,
      originalUrl: imageUrl,
      width: dimensions[index][0],
      height: dimensions[index][1],
      alt,
      caption,
      location,
      takenAt,
      sortOrder: index + 1,
    };
  });
}

const fishLanternPhotos = seriesPhotos(
  "series-fish-lantern-night",
  "fish-lantern",
  Array.from({ length: 6 }, () => [1500, 2000]),
  [
    ["夜色中鱼灯游过荷塘与白墙村落", "灯火先在水面醒来，鱼群随后游进夜色。", "古村夜游", "2026-10-07"],
    ["人群举着鱼灯穿过古村街巷", "一尾尾亮起的鱼，把街巷变成缓慢流动的河。", "古村街巷", "2026-10-07"],
    ["鱼灯、桥与白墙在夜色中相映", "桥是一道停顿，灯影从它的两侧继续讲述。", "荷塘边", "2026-10-07"],
    ["鱼灯表演与烟火的夜间片段", "火光腾起时，鱼灯仍沿着人的脚步向前。", "鱼灯会", "2026-10-07"],
    ["烟火与成群鱼灯照亮村落", "短暂的焰火落下，留在屋檐间的是更温柔的红。", "村落夜色", "2026-10-07"],
    ["鱼灯倒映在黑色水面", "水把鱼灯收成另一场安静的游行。", "水岸", "2026-10-07"],
  ],
);

const coastPhotos = seriesPhotos(
  "series-coast-afterglow",
  "coast",
  Array.from({ length: 6 }, () => [1500, 2000]),
  [
    ["粉蓝暮色下的沙滩、海面与远处索道", "傍晚把喧闹留在岸上，把颜色交给海面。", "海岸", "2026-10-07"],
    ["海湾、灯塔与远处港口的蓝色片段", "灯塔站在海风里，替远处的船保留一个坐标。", "海湾", "2026-10-07"],
    ["浅滩上的海鸟与层叠潮线", "潮水退后，海鸟接管了沙洲的边界。", "浅滩", "2026-10-07"],
    ["橙色落日映照潮汐与沙岸", "最后一束暖光贴着海平线，也贴着回程的脚步。", "暮色海岸", "2026-10-07"],
    ["伸向海面的栈道与晚归人群", "栈道把陆地延长了一小段，人们在那里等待天色变暗。", "海边栈道", "2026-10-07"],
    ["从海边道路到城市轮廓的黄昏片段", "离开海岸之后，夕光仍在道路和楼影之间同行。", "沿海途中", "2026-10-07"],
  ],
);

const mountainWaterPhotos = seriesPhotos(
  "series-mountain-water",
  "mountain-water",
  Array.from({ length: 3 }, () => [1500, 2000]),
  [
    ["瀑布、清潭与溪石的山中片段", "水从岩壁落下，又在掌心与石缝之间恢复透明。", "山中溪谷", "2026-10-07"],
    ["索道、松树与山峰在薄雾中交错", "抬头时，索道从松枝和峰影之间轻轻划过。", "山间", "2026-10-07"],
    ["层叠山峰、松树与云雾", "群峰在云层后反复出现，远近像呼吸一样改变。", "山巅", "2026-10-07"],
  ],
);

const whiteWallPhotos = seriesPhotos(
  "series-white-walls-distant-hills",
  "white-wall",
  Array.from({ length: 4 }, () => [1500, 2000]),
  [
    ["河道两侧的白墙民居与远山", "白墙沿着水慢慢展开，远山把村落收进清晨。", "山村水岸", "2026-10-07"],
    ["薄雾、拱桥与水中倒影", "雾压低了山的声音，只留下桥和倒影彼此回应。", "村落湖畔", "2026-10-07"],
    ["稻田之间通向群山的笔直道路", "道路穿过成熟的田野，向云下尚未抵达的地方延伸。", "田野", "2026-10-07"],
    ["河谷、山林与白色村舍", "河道从屋舍之间退去，山林仍守着日常的边缘。", "河谷村落", "2026-10-07"],
  ],
);

const companionPhotos = seriesPhotos(
  "series-companions",
  "companions",
  [[2200,1650],[1650,2200],[1464,2200],[2200,1466],[1465,2200],[1651,2200],[1467,2200],[2200,1466]],
  [
    ["鱼灯下合影的两位同行者", "热闹的灯会里，镜头先记住了举灯的人。", "旅途中", "2026-09-24"],
    ["海边被轻轻抚摸的柴犬", "风从海面过来，它比我们更早听见。", "海边", "2026-10-06"],
    ["落日海面前的人物剪影", "落日把人收成剪影，也把一个瞬间留得更久。", "海岸", "2026-10-06"],
    ["暮色海滩上独自行走的人", "潮线之外，她沿着余光慢慢走远。", "暮色海岸", "2026-10-06"],
    ["海边举起相机拍摄的同行者", "有人看海，有人把看海的人留在画面里。", "海边", "2026-10-06"],
    ["面向粉色海面的拍摄者", "同一片晚霞，在不同镜头里拥有不同的停留方式。", "海岸", "2026-10-07"],
    ["山峰前举起双杖的旅行者", "抵达高处之后，身体替喜悦做了一个感叹号。", "山中", "2026-10-07"],
    ["林间手持双杖微笑的人", "旅程也有轻松的一面，藏在停下来回望的几秒里。", "林间步道", "2026-10-07"],
  ],
);

export const defaultContent: SiteContent = {
  series: [
    { id: "series-fish-lantern-night", slug: "fish-lantern-night", title: "鱼灯照夜", description: "鱼灯从白墙黛瓦与荷塘之间游过。人群、火光和水中倒影共同组成一场只在夜里发生的迁徙。", coverUrl: "/photos/fish-lantern-02.webp", access: "public", sortOrder: 1, photos: fishLanternPhotos },
    { id: "series-between-mist-and-city", slug: "between-mist-and-city", title: "在雾与城之间", description: "沿着雨、桥与穿城而过的轨道，收集城市暂时失焦的时刻。", coverUrl: "/photos/01-fog-clock.webp", access: "public", sortOrder: 2, photos: mistCityPhotos },
    { id: "series-coast-afterglow", slug: "coast-afterglow", title: "海风经过以后", description: "从粉蓝色的傍晚走向橙红的潮线，记录海岸在一天将尽时逐渐安静下来的过程。", coverUrl: "/photos/coast-04.webp", access: "public", sortOrder: 3, photos: coastPhotos },
    { id: "series-mountain-water", slug: "following-water-into-the-mountains", title: "循水入山", description: "从瀑布与清潭出发，沿松枝、索道和云层向上，观看水与山如何交换彼此的形状。", coverUrl: "/photos/mountain-water-03.webp", access: "public", sortOrder: 4, photos: mountainWaterPhotos },
    { id: "series-white-walls-distant-hills", slug: "white-walls-distant-hills", title: "白墙与远山", description: "河道、稻田、薄雾和白色屋舍连成一条缓慢的路，村落在群山之间保留着安静的尺度。", coverUrl: "/photos/white-wall-02.webp", access: "public", sortOrder: 5, photos: whiteWallPhotos },
    { id: "series-companions", slug: "companions", title: "同行者", description: "从鱼灯夜游到海边日落、山中步道，镜头回到一起出发的人，也回到旅途中那些没有排练的瞬间。", coverUrl: "/photos/companions-03.webp", access: "public", sortOrder: 6, photos: companionPhotos },
  ],
  essays: [
    { id: "essay-rain-window", slug: "rain-on-the-window", title: "雨停在车窗上", excerpt: "有时拍照并不是为了保存一座城市，而是保存看向它时的那层玻璃。", body: "下雨的时候，城市会主动放弃一部分清晰。\n\n灯牌、出租车和行人的轮廓混在玻璃上，像尚未冲洗完成的底片。我喜欢这种不确定：它允许记忆晚一点再决定，什么应该留下。", access: "public", publishedAt: "2026-10-09", sortOrder: 1 },
    { id: "essay-private-draft", slug: "unpublished-note", title: "一封尚未寄出的短笺", excerpt: "这篇文字只留给自己。", body: "这里是一篇私藏随笔的示例。它不会出现在公开页面中，只有你登录工作室后才能阅读和修改。", access: "private", publishedAt: "2026-10-09", sortOrder: 2 },
  ],
  favorites: [
    { id: "favorite-01", title: "雨天的长镜头", category: "影像", note: "让画面多停留几秒，常常比解释更多。", imageUrl: "/photos/03-night-bridge.webp", url: "", access: "public", sortOrder: 1 },
    { id: "favorite-02", title: "在途中写下短句", category: "习惯", note: "只记下当时看见的颜色、声音和天气。", imageUrl: "/photos/05-river-boat.webp", url: "", access: "public", sortOrder: 2 },
  ],
};
