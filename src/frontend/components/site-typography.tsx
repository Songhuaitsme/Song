import { getSiteCopy } from "@/backend/content/content-store";
import { buildTypographyCss } from "@/shared/text-standard-css";
import { storyCoverCss } from "@/shared/story-cover-standard";

export async function SiteTypography() {
  return <style data-site-typography>{storyCoverCss + buildTypographyCss(await getSiteCopy())}</style>;
}
