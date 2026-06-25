"use client";
import { useState } from "react";
import { Card, Form, Input, Button, Typography, App, Divider, Tag } from "antd";
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { login } from "@/app/actions/auth";

const { Title, Text } = Typography;

const DEMO = [
  { role: "管理员", u: "admin", p: "admin123", color: "gold" },
  { role: "监管执法员", u: "inspector", p: "123456", color: "blue" },
  { role: "查询岗(只读)", u: "viewer", p: "123456", color: "default" },
];

export default function LoginForm() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const onFinish = async (v: { username: string; password: string }) => {
    setLoading(true);
    const res = await login({ username: v.username, password: v.password });
    setLoading(false);
    if (res.ok) {
      message.success("登录成功");
      const from = new URLSearchParams(window.location.search).get("from");
      window.location.assign(from && from.startsWith("/") ? from : "/");
    } else {
      message.error(res.error);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg,#e6f0ff 0%,#f0f2f5 60%)",
        padding: 16,
      }}
    >
      <Card style={{ width: 380, boxShadow: "0 10px 40px rgba(0,0,0,.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <SafetyCertificateOutlined style={{ fontSize: 38, color: "#1677ff" }} />
          <Title level={4} style={{ marginTop: 10, marginBottom: 2 }}>
            食品企业信用风险分类管理系统
          </Title>
          <Text type="secondary">市场监管 · 信用风险分类管理工作台</Text>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
          <Form.Item name="username" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" onPressEnter={() => form.submit()} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            登 录
          </Button>
        </Form>

        <Divider style={{ margin: "16px 0 12px" }} plain>
          <Text type="secondary" style={{ fontSize: 12 }}>演示账号（点击填充）</Text>
        </Divider>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {DEMO.map((d) => (
            <div
              key={d.u}
              onClick={() => form.setFieldsValue({ username: d.u, password: d.p })}
              style={{
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 6,
                background: "#fafafa",
                fontSize: 12,
              }}
            >
              <Tag color={d.color} style={{ marginInlineEnd: 0 }}>
                {d.role}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {d.u} / {d.p}
              </Text>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
