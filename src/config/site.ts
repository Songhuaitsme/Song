export const siteConfig = {
  name: "Song",
  title: "Song｜影像与文字",
  description: "以摄影系列、随笔与收藏记录沿途看见的事物。",
  locale: "zh-CN",
  copyright: "Song © 2026",
  codeManagedCopy: {
    brand: "Song",
    navAbout: "Song",
    enterSeries: "More",
  },
  features: {
    ownerPreview: true,
    mediaLibrary: true,
    bidirectionalSync: true,
  },
} as const;

export type SiteConfig = typeof siteConfig;
