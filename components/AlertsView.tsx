"use client";
import { useMemo, useState } from "react";
import { Card, Table, Tag, Segmented } from "antd";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";

type AlertRow = {
  id: string;
  level: string;
  reason: string;
  status: string;
  createdAt: string;
  enterprise: { id: string; name: string; industry: string; region: string };
};

const levelColor: Record<string, string> = { 高: "red", 中: "orange", 低: "blue" };

export default function AlertsView({ data }: { data: AlertRow[] }) {
  const [status, setStatus] = useState<string>("全部");

  const filtered = useMemo(
    () => (status === "全部" ? data : data.filter((d) => d.status === status)),
    [data, status],
  );

  const columns: ColumnsType<AlertRow> = [
    {
      title: "预警级别",
      dataIndex: "level",
      width: 100,
      render: (l: string) => <Tag color={levelColor[l]}>{l}</Tag>,
    },
    {
      title: "企业名称",
      dataIndex: ["enterprise", "name"],
      render: (name: string, r) => <Link href={`/enterprises/${r.enterprise.id}`}>{name}</Link>,
    },
    { title: "行业", dataIndex: ["enterprise", "industry"], width: 110 },
    { title: "区县", dataIndex: ["enterprise", "region"], width: 100 },
    { title: "预警原因", dataIndex: "reason" },
    {
      title: "处置状态",
      dataIndex: "status",
      width: 110,
      render: (s: string) => <Tag color={s === "待处置" ? "orange" : "green"}>{s}</Tag>,
    },
    { title: "预警时间", dataIndex: "createdAt", width: 120 },
  ];

  return (
    <Card
      title={`风险预警（共 ${filtered.length} 条）`}
      extra={
        <Segmented
          options={["全部", "待处置", "已处置"]}
          value={status}
          onChange={(v) => setStatus(v as string)}
        />
      }
    >
      <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 12 }} size="middle" />
    </Card>
  );
}
