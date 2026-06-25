"use client";
import { Row, Col, Card, Statistic, Tag, List } from "antd";
import { ShopOutlined, AlertOutlined, FileSearchOutlined, WarningOutlined } from "@ant-design/icons";
import Link from "next/link";
import EChart from "./EChart";
import { LEVEL_META, type RiskLevel } from "@/lib/scoring";

type Stats = {
  total: number;
  levelCounts: Record<string, number>;
  industryLevel: Record<string, Record<string, number>>;
  pendingAlerts: number;
  totalEvents: number;
  recentAlerts: {
    id: string;
    level: string;
    reason: string;
    status: string;
    createdAt: string | Date;
    enterprise: { id: string; name: string };
  }[];
};

const LEVELS: RiskLevel[] = ["A", "B", "C", "D"];

export default function DashboardView({ stats }: { stats: Stats }) {
  const pieOption = {
    tooltip: { trigger: "item" },
    legend: { bottom: 0 },
    series: [
      {
        name: "信用等级",
        type: "pie",
        radius: ["40%", "70%"],
        avoidLabelOverlap: false,
        label: { formatter: "{b}: {c} ({d}%)" },
        data: LEVELS.map((l) => ({
          value: stats.levelCounts[l] ?? 0,
          name: LEVEL_META[l].label,
          itemStyle: { color: LEVEL_META[l].color },
        })),
      },
    ],
  };

  const industries = Object.keys(stats.industryLevel);
  const barOption = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { data: LEVELS.map((l) => `${l} 级`) },
    grid: { left: 40, right: 16, top: 40, bottom: 30 },
    xAxis: { type: "category", data: industries },
    yAxis: { type: "value" },
    series: LEVELS.map((l) => ({
      name: `${l} 级`,
      type: "bar",
      stack: "total",
      itemStyle: { color: LEVEL_META[l].color },
      data: industries.map((ind) => stats.industryLevel[ind][l] ?? 0),
    })),
  };

  return (
    <div>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="纳管企业总数" value={stats.total} prefix={<ShopOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="D 级高风险企业"
              value={stats.levelCounts.D ?? 0}
              valueStyle={{ color: LEVEL_META.D.color }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="待处置预警"
              value={stats.pendingAlerts}
              valueStyle={{ color: "#faad14" }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="归集风险事件" value={stats.totalEvents} prefix={<FileSearchOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} md={10}>
          <Card title="信用等级分布">
            <EChart option={pieOption} height={300} />
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card title="各行业风险等级分布">
            <EChart option={barOption} height={300} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="最新风险预警" extra={<Link href="/alerts">查看全部</Link>}>
            <List
              dataSource={stats.recentAlerts}
              renderItem={(a) => (
                <List.Item
                  actions={[
                    <Tag key="s" color={a.status === "待处置" ? "orange" : "default"}>
                      {a.status}
                    </Tag>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Tag color={a.level === "高" ? "red" : a.level === "中" ? "orange" : "blue"}>{a.level}</Tag>}
                    title={<Link href={`/enterprises/${a.enterprise.id}`}>{a.enterprise.name}</Link>}
                    description={a.reason}
                  />
                  <span style={{ color: "#999" }}>{new Date(a.createdAt).toLocaleDateString("zh-CN")}</span>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
