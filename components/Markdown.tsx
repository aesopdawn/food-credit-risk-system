"use client";
// 共用 Markdown 渲染组件（AI 研判报告 / 对话助手）。样式见 app/globals.css 的 .md-body。
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={className ? `md-body ${className}` : "md-body"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
