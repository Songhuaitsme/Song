export type Photo = { id: string; seriesId: string; imageUrl: string; originalUrl: string; width: number; height: number; alt: string; caption: string; location: string; takenAt: string; sortOrder: number };
export type Series = { id: string; slug: string; title: string; description: string; coverUrl: string; published: boolean; sortOrder: number; photos: Photo[] };
export type Essay = { id: string; slug: string; title: string; excerpt: string; body: string; visibility: "public" | "private"; status: "draft" | "published"; publishedAt: string };
export type Favorite = { id: string; title: string; category: string; note: string; imageUrl: string; url: string; sortOrder: number; published: boolean };
export type SiteContent = { series: Series[]; essays: Essay[]; favorites: Favorite[] };

const photos: Photo[] = [
  { id: "photo-01", seriesId: "series-between-mist-and-city", imageUrl: "/photos/01-fog-clock.webp", originalUrl: "/photos/originals/01-fog-clock.jpg", width: 1467, height: 2200, alt: "雾气中的城市钟楼与高层建筑", caption: "雾把远处的楼擦去，只留下钟楼确认时间仍在经过。", location: "城市途中", takenAt: "", sortOrder: 1 },
  { id: "photo-02", seriesId: "series-between-mist-and-city", imageUrl: "/photos/02-rain-taxi.webp", originalUrl: "/photos/originals/02-rain-taxi.jpg", width: 2200, height: 1466, alt: "雨夜车窗外的黄色出租车与街边灯牌", caption: "雨水停在玻璃上，街道从现实退成了一层颜色。", location: "雨夜", takenAt: "", sortOrder: 2 },
  { id: "photo-03", seriesId: "series-between-mist-and-city", imageUrl: "/photos/03-night-bridge.webp", originalUrl: "/photos/originals/03-night-bridge.jpg", width: 1467, height: 2200, alt: "夜色中的桥梁、灯光与湿润路面", caption: "桥的另一侧被强光折叠，夜色则保持沉默。", location: "桥上", takenAt: "", sortOrder: 3 },
  { id: "photo-04", seriesId: "series-between-mist-and-city", imageUrl: "/photos/04-city-fragments.webp", originalUrl: "/photos/originals/04-city-fragments.jpg", width: 1467, height: 2200, alt: "城市建筑与道路交错形成的片段", caption: "高架、楼宇和光线，把城市切成短暂的几何。", location: "城中", takenAt: "", sortOrder: 4 },
  { id: "photo-05", seriesId: "series-between-mist-and-city", imageUrl: "/photos/05-river-boat.webp", originalUrl: "/photos/originals/05-river-boat.jpg", width: 1505, height: 2200, alt: "高架桥柱之间驶过江面的游船", caption: "船从庞大的桥柱之间经过，像一句被结构包围的小声旁白。", location: "江面", takenAt: "", sortOrder: 5 },
  { id: "photo-06", seriesId: "series-between-mist-and-city", imageUrl: "/photos/06-train-through-city.webp", originalUrl: "/photos/originals/06-train-through-city.jpg", width: 1468, height: 2200, alt: "列车穿过旧楼之间，远处可见现代高楼", caption: "列车从旧楼的缝隙里穿过，新城在更远处浮现。", location: "街巷", takenAt: "", sortOrder: 6 },
  { id: "photo-07", seriesId: "series-between-mist-and-city", imageUrl: "/photos/07-jiangnan-bridge.webp", originalUrl: "/photos/originals/07-jiangnan-bridge.png", width: 1088, height: 1445, alt: "烟雨山色前的江南石桥及水中倒影", caption: "山雾、屋瓦与桥的倒影，让旅程在水面慢下来。", location: "江南", takenAt: "", sortOrder: 7 },
];

export const defaultContent: SiteContent = {
  series: [{ id: "series-between-mist-and-city", slug: "between-mist-and-city", title: "在雾与城之间", description: "沿着雨、桥与穿城而过的轨道，收集城市暂时失焦的时刻。", coverUrl: "/photos/01-fog-clock.webp", published: true, sortOrder: 1, photos }],
  essays: [
    { id: "essay-rain-window", slug: "rain-on-the-window", title: "雨停在车窗上", excerpt: "有时拍照并不是为了保存一座城市，而是保存看向它时的那层玻璃。", body: "下雨的时候，城市会主动放弃一部分清晰。\n\n灯牌、出租车和行人的轮廓混在玻璃上，像尚未冲洗完成的底片。我喜欢这种不确定：它允许记忆晚一点再决定，什么应该留下。", visibility: "public", status: "published", publishedAt: "2026-10-09" },
    { id: "essay-private-draft", slug: "unpublished-note", title: "一封尚未寄出的短笺", excerpt: "这篇文字只留给自己。", body: "这里是一篇私藏随笔的示例。它不会出现在公开页面中，只有你登录工作室后才能阅读和修改。", visibility: "private", status: "published", publishedAt: "2026-10-09" },
  ],
  favorites: [
    { id: "favorite-01", title: "雨天的长镜头", category: "影像", note: "让画面多停留几秒，常常比解释更多。", imageUrl: "/photos/03-night-bridge.webp", url: "", sortOrder: 1, published: true },
    { id: "favorite-02", title: "在途中写下短句", category: "习惯", note: "只记下当时看见的颜色、声音和天气。", imageUrl: "/photos/05-river-boat.webp", url: "", sortOrder: 2, published: true },
  ],
};
