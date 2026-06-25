"use client";
import { Layout, Menu, ConfigProvider, App as AntdApp, Avatar, Tag, Button, Space } from "antd";
import zhCN from "antd/locale/zh_CN";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DashboardOutlined,
  ProfileOutlined,
  AlertOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import ChatWidget from "./ChatWidget";
import { logout } from "@/app/actions/auth";
import { ROLE_LABELS, type SessionUser } from "@/lib/auth";

const { Header, Sider, Content } = Layout;

const MENU = [
  { key: "/", icon: <DashboardOutlined />, label: <Link href="/">监管总览</Link> },
  { key: "/enterprises", icon: <ProfileOutlined />, label: <Link href="/enterprises">企业信用名录</Link> },
  { key: "/alerts", icon: <AlertOutlined />, label: <Link href="/alerts">风险预警</Link> },
];

const ROLE_TAG_COLOR: Record<string, string> = { admin: "gold", inspector: "blue", viewer: "default" };

export default function AppShell({ children, user }: { children: React.ReactNode; user: SessionUser | null }) {
  const pathname = usePathname();
  const selected = pathname === "/" ? "/" : "/" + pathname.split("/")[1];

  // 登录页：不套用后台外壳（侧边栏 / 顶栏 / 对话助手）
  if (pathname === "/login") {
    return (
      <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#1677ff" } }}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: "#1677ff" } }}>
      <AntdApp>
        <Layout style={{ minHeight: "100vh" }}>
          <Sider theme="dark" breakpoint="lg" collapsedWidth="0" width={220}>
            <div
              style={{
                color: "#fff",
                padding: "18px 16px",
                fontWeight: 600,
                fontSize: 15,
                lineHeight: 1.4,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <SafetyCertificateOutlined style={{ fontSize: 22, color: "#1677ff" }} />
              <span>食品企业信用风险<br />分类管理系统</span>
            </div>
            <Menu theme="dark" mode="inline" selectedKeys={[selected]} items={MENU} />
          </Sider>
          <Layout>
            <Header
              style={{
                background: "#fff",
                paddingInline: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600 }}>市场监管 · 信用风险分类管理工作台</span>
              {user && (
                <Space size={8}>
                  <Avatar size="small" icon={<UserOutlined />} style={{ background: "#1677ff" }} />
                  <span style={{ fontWeight: 500 }}>{user.name}</span>
                  <Tag color={ROLE_TAG_COLOR[user.role]} style={{ marginInlineEnd: 0 }}>
                    {ROLE_LABELS[user.role]}
                  </Tag>
                  <Button size="small" icon={<LogoutOutlined />} onClick={() => logout()}>
                    退出
                  </Button>
                </Space>
              )}
            </Header>
            <Content style={{ margin: 24 }}>{children}</Content>
          </Layout>
        </Layout>
        <ChatWidget />
      </AntdApp>
    </ConfigProvider>
  );
}
