import type { AccessLevel } from "@/lib/default-content";

const labels: Record<AccessLevel, string> = { draft: "草稿", private: "私藏", public: "公开" };

export function AccessBadge({ access }: { access: AccessLevel }) {
  return <span className={`access-badge access-${access}`}>{labels[access]}</span>;
}
