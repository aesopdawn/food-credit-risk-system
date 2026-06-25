"use client";
import { useState } from "react";
import { Card, Descriptions, Tag, Row, Col, Progress, Timeline, Button, Typography, Alert, Space, List } from "antd";
import { RobotOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { LEVEL_META, type RiskLevel, type ScoreResult } from "@/lib/scoring";

const { Paragraph, Title, Text } = Typography;

const EVENT_META: Record<string, { label: string; color: string }> = {
  PENALTY: { label: "行政处罚", color: "red" },
  INSPECTION: { label: "抽查检查", color: "orange" },
  COMPLAINT: { label: "投诉举报", color: "volcano" },
  REPAIR: { label: "信用修复", color: "green" },
  LICENSE: { label: "许可资质", color: "blue" },
};

type VM = {
  id: string;
  name: string;
  uscc: string;
  legalPerson: string;
  registeredCapital: number;
  establishedAt: string;
  industry: string;
  region: string;
  businessScope: string;
  status: string;
  level: string;
  score: number | null;
  computedAt: string | null;
  breakdown: ScoreResult | null;
  events: { id: string; type: string; title: string; severity: number; isVeto: boolean; source: string; occurredAt: string }[];
  alerts: { id: string; level: string; reason: string; status: string }[];
};

export default function EnterpriseDetailView({ vm }: { vm: VM }) {
  const [report, setReport] = useState<string>();
  const [loading, setLoading] = useState(false);
  const meta = LEVEL_META[vm.level as RiskLevel];

  const genReport = async () => {
    setLoading(true);
    setReport(undefined);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vm.id }),
      });
      const data = await res.json();
      setReport(data.report ?? data.error ?? "生成失败");
    } catch {
      setReport("请求失败，请检查 DeepSeek API Key 是否已配置");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions
          title={vm.name}
          column={{ xs: 1, sm: 2, md: 3 }}
          items={[
            { key: "uscc", label: "统一社会信用代码", children: vm.uscc },
            { key: "lp", label: "法定代表人", children: vm.legalPerson },
            { key: "cap", label: "注册资本", children: `${vm.registeredCapital} 万元` },
            { key: "ind", label: "行业", children: vm.industry },
            { key: "reg", label: "所在区县", children: vm.region },
            { key: "est", label: "成立日期", children: vm.establishedAt },
            { key: "st", label: "经营状态", children: <Tag color={vm.status === "在营" ? "green" : "red"}>{vm.status}</Tag> },
            { key: "scope", label: "经营范围", children: vm.businessScope, span: 3 },
          ]}
        />
      </Card>

      <Row gutter={16}>
        <Col xs={24} md={9}>
          <Card title="信用风险评级" style={{ marginBottom: 16 }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <Tag color={meta?.color} style={{ fontSize: 22, padding: "8px 20px", borderRadius: 8 }}>
                {vm.level} 级
              </Tag>
              <div style={{ marginTop: 12, fontSize: 28, fontWeight: 700 }}>
                {vm.score?.toFixed(1) ?? "-"} <span style={{ fontSize: 14, color: "#999" }}>分</span>
              </div>
              <Text type="secondary">{meta?.desc}</Text>
            </div>
            <Alert
              type={vm.level === "D" ? "error" : vm.level === "C" ? "warning" : "info"}
              showIcon
              icon={<SafetyCertificateOutlined />}
              message="分级监管建议"
              description={meta?.supervision}
            />
            {vm.breakdown?.veto && (
              <Alert style={{ marginTop: 12 }} type="error" showIcon message="该企业触发一票否决（严重食品安全事故），直接定为 D 级" />
            )}
            <div style={{ marginTop: 16 }}>
              <Button type="primary" icon={<RobotOutlined />} loading={loading} onClick={genReport} block>
                AI 生成信用风险研判报告
              </Button>
            </div>
            {report && (
              <Card size="small" style={{ marginTop: 12, background: "#fafafa" }} title="AI 研判报告">
                <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{report}</Paragraph>
              </Card>
            )}
          </Card>

          {vm.breakdown && (
            <Card title="各维度得分明细" size="small">
              {vm.breakdown.breakdown.map((dim) => (
                <div key={dim.key} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{dim.name}</span>
                    <span>
                      {dim.score} / {dim.full}
                    </span>
                  </div>
                  <Progress
                    percent={Math.round((dim.score / dim.full) * 100)}
                    showInfo={false}
                    strokeColor={dim.score / dim.full > 0.7 ? "#52c41a" : dim.score / dim.full > 0.4 ? "#faad14" : "#f5222d"}
                  />
                  {dim.deductions.length > 0 && (
                    <div style={{ fontSize: 12, color: "#999" }}>
                      {dim.deductions.map((x, i) => (
                        <div key={i}>
                          · {x.title}（-{x.points}{x.occurredAt ? `，${x.occurredAt}` : ""}）
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          )}
        </Col>

        <Col xs={24} md={15}>
          {vm.breakdown && vm.breakdown.topRisks.length > 0 && (
            <Card title="主要风险因素" size="small" style={{ marginBottom: 16 }}>
              <List size="small" dataSource={vm.breakdown.topRisks} renderItem={(t) => <List.Item>{t}</List.Item>} />
            </Card>
          )}
          <Card title={`涉企风险事件（${vm.events.length} 条）`}>
            {vm.events.length === 0 ? (
              <Text type="secondary">暂无风险事件</Text>
            ) : (
              <Timeline
                items={vm.events.map((e) => {
                  const m = EVENT_META[e.type] ?? { label: e.type, color: "gray" };
                  return {
                    color: m.color,
                    children: (
                      <div>
                        <Space>
                          <Tag color={m.color}>{m.label}</Tag>
                          <Text strong>{e.title}</Text>
                          {e.isVeto && <Tag color="red">一票否决</Tag>}
                        </Space>
                        <div style={{ color: "#999", fontSize: 12, marginTop: 4 }}>
                          严重度 {e.severity} · {e.occurredAt} · 来源：{e.source}
                        </div>
                      </div>
                    ),
                  };
                })}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
