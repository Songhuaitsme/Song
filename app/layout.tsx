import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
export const metadata: Metadata = { title: { default: "SONG｜影像与文字", template: "%s｜SONG" }, description: "以摄影系列、随笔与收藏记录沿途看见的事物。", icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="zh-CN"><body>{children}<Toaster position="bottom-right"/></body></html>; }
