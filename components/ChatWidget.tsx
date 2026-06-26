"use client";
import { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Button, Drawer, Input, Avatar, Tag, Empty, Spin } from "antd";
import { RobotOutlined, SendOutlined, UserOutlined, CommentOutlined } from "@ant-design/icons";
import Markdown from "./Markdown";

const SUGGESTIONS = [
  "列出所有 D 级高风险企业",
  "目前各信用等级各有多少家企业？",
  "餐饮服务行业有哪些较高风险(C级)企业？",
  "帮我分析一下整体信用风险情况",
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <>
      <Button
        type="primary"
        shape="round"
        size="large"
        icon={<CommentOutlined />}
        onClick={() => setOpen(true)}
        style={{ position: "fixed", right: 28, bottom: 28, zIndex: 1000, boxShadow: "0 6px 16px rgba(0,0,0,.2)" }}
      >
        AI 智能研判助手
      </Button>

      <Drawer
        title={
          <span>
            <RobotOutlined style={{ color: "#1677ff", marginRight: 8 }} />
            AI 智能研判助手
          </span>
        }
        open={open}
        onClose={() => setOpen(false)}
        width={440}
        styles={{ body: { display: "flex", flexDirection: "column", padding: 0 } }}
      >
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {messages.length === 0 && (
            <div style={{ marginTop: 24 }}>
              <Empty description="向我提问，我会查询系统数据后作答" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              <div style={{ marginTop: 16 }}>
                {SUGGESTIONS.map((s) => (
                  <Tag
                    key={s}
                    color="blue"
                    style={{ cursor: "pointer", marginBottom: 8, padding: "4px 8px", whiteSpace: "normal" }}
                    onClick={() => send(s)}
                  >
                    {s}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            const text = m.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { text: string }).text)
              .join("");
            const usingTool = m.parts.some((p) => p.type.startsWith("tool-"));
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", marginBottom: 14, gap: 8 }}>
                <Avatar
                  size="small"
                  icon={isUser ? <UserOutlined /> : <RobotOutlined />}
                  style={{ background: isUser ? "#1677ff" : "#52c41a", flexShrink: 0 }}
                />
                <div
                  style={{
                    background: isUser ? "#1677ff" : "#f5f5f5",
                    color: isUser ? "#fff" : "#000",
                    padding: "8px 12px",
                    borderRadius: 8,
                    maxWidth: 320,
                    whiteSpace: isUser ? "pre-wrap" : undefined,
                    wordBreak: "break-word",
                  }}
                >
                  {!isUser && usingTool && !text && (
                    <Tag color="processing" style={{ marginBottom: text ? 6 : 0 }}>
                      🔍 正在查询系统数据…
                    </Tag>
                  )}
                  {/* 用户消息纯文本；助手消息渲染 Markdown */}
                  {isUser ? text : text && <Markdown>{text}</Markdown>}
                </div>
              </div>
            );
          })}

          {busy && messages[messages.length - 1]?.role === "user" && (
            <div style={{ paddingLeft: 36 }}>
              <Spin size="small" /> <span style={{ color: "#999" }}>思考中…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ borderTop: "1px solid #f0f0f0", padding: 12, display: "flex", gap: 8 }}>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例如：为什么 XX 公司是 C 级？"
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <Button type="primary" icon={<SendOutlined />} disabled={busy} onClick={() => send(input)} />
        </div>
      </Drawer>
    </>
  );
}
