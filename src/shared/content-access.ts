import type { SiteContent } from "@/shared/content-model";

export const privateContentMessage = "我想这大概是独属于Songhua的一些，我想把她留给自己。";

// Send visitors only the metadata they can read. Private details must never
// reach the HTML, React payload, or client components.
export function visitorContent(content: SiteContent): SiteContent {
  const visible = (item: { access: string; deletedAt?: number | null }) =>
    item.deletedAt == null && (item.access === "public" || item.access === "private");

  return {
    ...content,
    series: content.series.filter(visible).map((item) => item.access === "private"
      ? { ...item, coverUrl: "", photos: [] }
      : item),
    essays: content.essays.filter(visible).map((item) => item.access === "private"
      ? { ...item, body: "" }
      : item),
    favorites: content.favorites.filter(visible).map((item) => item.access === "private"
      ? { ...item, note: "", imageUrl: "", url: "" }
      : item),
  };
}
