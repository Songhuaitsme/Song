import { SiteTypography } from "@/frontend/components/site-typography";
import { siteConfig } from "@/config/site";
import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/frontend/components/ui/sonner";
export const metadata: Metadata = { title: { default: siteConfig.title, template: `%s｜${siteConfig.name}` }, description: siteConfig.description, icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang={siteConfig.locale}><body><SiteTypography/>{children}<Toaster position="bottom-right"/></body></html>; }
