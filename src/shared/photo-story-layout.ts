type PhotoDimensions = { width: number; height: number };

export type StoryPhoto<T> = { photo: T; index: number; aspectRatio: number };
export type PhotoStoryRow<T> = { kind: "single" | "portrait" | "pair"; items: StoryPhoto<T>[] };

export function photoAspectRatio(photo: PhotoDimensions): number {
  return Number.isFinite(photo.width) && photo.width > 0 && Number.isFinite(photo.height) && photo.height > 0
    ? photo.width / photo.height : 1;
}

/** Group adjacent photos without changing their order or cropping their composition. */
export function buildPhotoStoryRows<T extends PhotoDimensions>(photos: readonly T[]): PhotoStoryRow<T>[] {
  const rows: PhotoStoryRow<T>[] = [];
  let pending: StoryPhoto<T> | undefined;
  const single = (item: StoryPhoto<T>): PhotoStoryRow<T> => ({ kind: item.aspectRatio < 1 ? "portrait" : "single", items: [item] });
  photos.forEach((photo, index) => {
    const item = { photo, index, aspectRatio: photoAspectRatio(photo) };
    if ((index === 0 && item.aspectRatio > 1) || item.aspectRatio >= 2) {
      if (pending) rows.push(single(pending));
      pending = undefined;
      rows.push(single(item));
    } else if (pending) {
      rows.push({ kind: "pair", items: [pending, item] });
      pending = undefined;
    } else pending = item;
  });
  if (pending) rows.push(single(pending));
  return rows;
}
