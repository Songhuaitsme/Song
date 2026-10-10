// Frameworks may supply either decoded or percent-encoded route parameters.
export function decodeContentSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function contentPath(section: "essays" | "series", slug: string): string {
  return `/${section}/${encodeURIComponent(slug)}`;
}
