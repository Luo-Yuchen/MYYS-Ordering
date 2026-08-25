import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

/** 根据当前访问地址生成可用于聊天分享的完整站点元数据。 */
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "馒有意思｜每日现蒸馒头",
    description: "手机预约馒头，到店即取或邻里配送。每日现蒸，新鲜柔软。",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "馒有意思｜每日现蒸馒头",
      description: "每天现蒸，把柔软送到家。",
      images: [`${origin}/og-v2.png`],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "馒有意思｜每日现蒸馒头",
      description: "每天现蒸，把柔软送到家。",
      images: [`${origin}/og-v2.png`],
    },
  };
}

/** 提供全站中文页面结构与基础样式。 */
export default function RootLayout({
  children,
}: Readonly<{
  /** 页面内容。 */
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
