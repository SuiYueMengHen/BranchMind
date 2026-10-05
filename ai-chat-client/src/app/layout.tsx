import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";

import ClientGlobals from "@/components/layout/ClientGlobals";

// 元数据配置
export const metadata: Metadata = {
  title: "Branch Mind · 学习有主线，问题有分支",
  description:
    "学习有主线，问题有分支。支持定制讲义、共享记忆与多端同步。",
  manifest: "/manifest.webmanifest",
  keywords: ["AI", "dialogue", "chat", "context", "topology", "tree"],
  authors: [{ name: "Branch Mind" }],
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <ClientGlobals />
        {children}
      </body>
    </html>
  );
}
