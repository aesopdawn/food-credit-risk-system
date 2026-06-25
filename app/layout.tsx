import type { Metadata } from "next";
import "./globals.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import AppShell from "@/components/AppShell";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "食品企业信用风险分类管理系统",
  description: "面向市场监管的食品企业信用风险 A/B/C/D 四级动态分类评级与智能研判系统",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSession();
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <AppShell user={user}>{children}</AppShell>
        </AntdRegistry>
      </body>
    </html>
  );
}
