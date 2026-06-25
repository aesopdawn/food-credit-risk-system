"use client";
import { useState } from "react";
import { Card, Descriptions, Tag, Row, Col, Progress, Timeline, Button, Typography, Alert, Space, List, Popconfirm, App } from "antd";
import { RobotOutlined, SafetyCertificateOutlined, PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { LEVEL_META, type RiskLevel, type ScoreResult } from "@/lib/scoring";
import { deleteRiskEvent, reRateAction } from "@/app/actions/events";
import RiskEventFormModal, { type EditingEvent } from "./RiskEventFormModal";
import EChart from "./EChart";

const { Paragraph, Text } = Typography;

const EVENT_META: Record<string, { label: string; color: string }> = {
  PENALTY: { label: "行政处罚", color: "red" },
  INSPECTION: { label: "抽查检查", color: "orange" },
  COMPLAINT: { label: "投诉举报", color: "volcano" },
  REPAIR: { label: "信用修复", color: "green" },
  LICENSE: { label: "许可资质", color: "blue" },
};

type EventVM = {
  id: string;
  type: string;
  title: string;
  severity: number;
  isVeto: boolean;
  source: string;
  occurredAt: string;
  remark?: string;
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
  events: EventVM[];
  ratingHistory: { computedAt: string; score: number; level: string }[];
  alerts: { id: string; level: string; reason: string; status: string }[];
};

export default function EnterpriseDetailView({ vm, canWrite }: { vm: VM; canWrite: boolean }) {
  const { message } = App.useApp();
  const [report, setReport] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [rerating, setRerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EditingEvent | null>(null);
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

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (e: EventVM) => {
    setEditing({
      id: e.id,
      type: e.type,
      title: e.title,
      severity: e.severity,
      isVeto: e.isVeto,
      source: e.source,
      occurredAt: e.occurredAt,
      remark: e.remark,
    });
    setModalOpen(true);
  };
  const onDelete = async (id: string) => {
    const res = await deleteRiskEvent(id, vm.id);
    if (res.ok) message.success(`已删除事件，最新评级：${res.level} 级（${res.score} 分）`);
    else message.error(res.error);
  };
  const onReRate = async () => {
    setRerating(true);
    const res = await reRateAction(vm.id);
    setRerating(false);
    if (res.ok) message.success(`已重新评级：${res.level} 级（${res.score} 分）`);
    else message.error(res.error);
  };

  const trendOption = {
    tooltip: { trigger: "axis" },
    grid: { left: 40, right: 16, top: 24, bottom: 28 },
    xAxis: { type: "category", data: vm.ratingHistory.map((r) => r.computedAt) },
    yAxis: { type: "value", min: 0, max: 100 },
    series: [
      {
        name: "综合得分",
        type: "line",
        smooth: true,
        symbolSize: 7,
        data: vm.ratingHistory.map((r) => r.score),
        areaStyle: { opacity: 0.12 },
        lineStyle: { color: "#1677ff" },
        itemStyle: { color: "#1677ff" },
        markLine: {
          silent: true,
          symbol: "none",
          lineStyle: { type: "dashed", color: "#bbb" },
          data: [
            { yAxis: 85, label: { formatter: "A 85" } },
            { yAxis: 70, label: { formatter: "B 70" } },
            { yAxis: 60, label: { formatter: "C 60" } },
          ],
        },
      },
    ],
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
          <Card
            title="信用风险评级"
            style={{ marginBottom: 16 }}
            extra={
              canWrite ? (
                <Button size="small" icon={<ReloadOutlined />} loading={rerating} onClick={onReRate}>
                  重新评级
                </Button>
              ) : undefined
            }
          >
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
            <Card title="各维度得分明细" size="small" style={{ marginBottom: 16 }}>
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

          {vm.ratingHistory.length > 0 && (
            <Card title="评级走势" size="small">
              <EChart option={trendOption} height={220} />
            </Card>
          )}
        </Col>

        <Col xs={24} md={15}>
          {vm.breakdown && vm.breakdown.topRisks.length > 0 && (
            <Card title="主要风险因素" size="small" style={{ marginBottom: 16 }}>
              <List size="small" dataSource={vm.breakdown.topRisks} renderItem={(t) => <List.Item>{t}</List.Item>} />
            </Card>
          )}
          <Card
            title={`涉企风险事件（${vm.events.length} 条）`}
            extra={
              canWrite ? (
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openAdd}>
                  录入事件
                </Button>
              ) : (
                <Tag>只读</Tag>
              )
            }
          >
            {vm.events.length === 0 ? (
              <Text type="secondary">暂无风险事件，可点击右上角「录入事件」添加</Text>
            ) : (
              <Timeline
                items={vm.events.map((e) => {
                  const m = EVENT_META[e.type] ?? { label: e.type, color: "gray" };
                  return {
                    color: m.color,
                    children: (
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <Space wrap>
                            <Tag color={m.color}>{m.label}</Tag>
                            <Text strong>{e.title}</Text>
                            {e.isVeto && <Tag color="red">一票否决</Tag>}
                          </Space>
                          {canWrite && (
                            <Space size={0}>
                              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(e)}>
                                编辑
                              </Button>
                              <Popconfirm
                                title="删除该事件？"
                                description="删除后将自动重新评级"
                                okText="删除"
                                cancelText="取消"
                                okButtonProps={{ danger: true }}
                                onConfirm={() => onDelete(e.id)}
                              >
                                <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                  删除
                                </Button>
                              </Popconfirm>
                            </Space>
                          )}
                        </div>
                        <div style={{ color: "#999", fontSize: 12, marginTop: 2 }}>
                          严重度 {e.severity} · {e.occurredAt} · 来源：{e.source}
                        </div>
                        {e.remark && <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>备注：{e.remark}</div>}
                      </div>
                    ),
                  };
                })}
              />
            )}
          </Card>
        </Col>
      </Row>

      <RiskEventFormModal open={modalOpen} enterpriseId={vm.id} editing={editing} onClose={() => setModalOpen(false)} />
    </div>
  );
}
