import type { Metadata } from "next";
import "./globals.css";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "食品企业信用风险分类管理系统",
  description: "面向市场监管的食品企业信用风险 A/B/C/D 四级动态分类评级与智能研判系统",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <AppShell>{children}</AppShell>
        </AntdRegistry>
      </body>
    </html>
  );
}
