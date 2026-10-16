import { SiteTypography } from "@/frontend/components/site-typography";
import { getSiteCopy } from "@/backend/content/content-store";
import { siteConfig } from "@/config/site";
import type { Metadata } from "next";
import "./globals.css";
import "../frontend/styles/responsive.css";
import "../frontend/styles/photo-story.css";
import "../frontend/styles/series-narrative-editor.css";
import "../frontend/styles/text-standards.css";
import { Toaster } from "@/frontend/components/ui/sonner";
export const metadata: Metadata = { title: { default: siteConfig.title, template: `%s｜${siteConfig.name}` }, description: siteConfig.description, icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" } };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { const copy = await getSiteCopy(); return <html lang={siteConfig.locale} data-text-standards={copy.textStandards ? "2" : undefined}><body><SiteTypography/>{children}<Toaster position="bottom-right"/></body></html>; }
