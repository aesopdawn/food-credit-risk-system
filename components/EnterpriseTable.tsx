"use client";
import { useMemo, useState } from "react";
import { Card, Table, Tag, Select, Input, Space, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import { LEVEL_META, type RiskLevel } from "@/lib/scoring";
import type { EnterpriseListItem } from "@/lib/data";
import EnterpriseFormModal from "./EnterpriseFormModal";

const levelTag = (level: string) => {
  const meta = LEVEL_META[level as RiskLevel];
  return meta ? <Tag color={meta.color}>{level} 级</Tag> : <Tag>{level}</Tag>;
};

export default function EnterpriseTable({ data, canWrite }: { data: EnterpriseListItem[]; canWrite: boolean }) {
  const [level, setLevel] = useState<string>();
  const [industry, setIndustry] = useState<string>();
  const [keyword, setKeyword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const industries = useMemo(() => Array.from(new Set(data.map((d) => d.industry))), [data]);

  const filtered = useMemo(
    () =>
      data.filter(
        (d) =>
          (!level || d.level === level) &&
          (!industry || d.industry === industry) &&
          (!keyword || d.name.includes(keyword) || d.uscc.includes(keyword)),
      ),
    [data, level, industry, keyword],
  );

  const columns: ColumnsType<EnterpriseListItem> = [
    {
      title: "企业名称",
      dataIndex: "name",
      render: (name: string, r) => <Link href={`/enterprises/${r.id}`}>{name}</Link>,
    },
    { title: "行业", dataIndex: "industry", width: 110 },
    { title: "区县", dataIndex: "region", width: 100 },
    { title: "法定代表人", dataIndex: "legalPerson", width: 110 },
    {
      title: "信用等级",
      dataIndex: "level",
      width: 100,
      sorter: (a, b) => a.level.localeCompare(b.level),
      render: levelTag,
    },
    {
      title: "综合得分",
      dataIndex: "score",
      width: 100,
      sorter: (a, b) => (a.score ?? 0) - (b.score ?? 0),
      render: (s: number | null) => (s == null ? "-" : s.toFixed(1)),
    },
    { title: "风险事件", dataIndex: "events", width: 90, align: "center" },
    {
      title: "经营状态",
      dataIndex: "status",
      width: 100,
      render: (s: string) => <Tag color={s === "在营" ? "green" : "red"}>{s}</Tag>,
    },
  ];

  return (
    <>
      <Card
        title={`企业信用名录（共 ${filtered.length} 家）`}
        extra={
          canWrite ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新增企业
            </Button>
          ) : undefined
        }
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            allowClear
            placeholder="信用等级"
            style={{ width: 130 }}
            value={level}
            onChange={setLevel}
            options={(["A", "B", "C", "D"] as const).map((l) => ({ value: l, label: `${l} 级` }))}
          />
          <Select
            allowClear
            placeholder="行业"
            style={{ width: 150 }}
            value={industry}
            onChange={setIndustry}
            options={industries.map((i) => ({ value: i, label: i }))}
          />
          <Input.Search
            placeholder="搜索企业名称 / 信用代码"
            style={{ width: 260 }}
            allowClear
            onChange={(e) => setKeyword(e.target.value)}
          />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 12, showSizeChanger: false }}
          size="middle"
        />
      </Card>

      <EnterpriseFormModal open={createOpen} mode="create" onClose={() => setCreateOpen(false)} />
    </>
  );
}
