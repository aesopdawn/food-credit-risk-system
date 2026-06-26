"use client";
import { useMemo, useState } from "react";
import { Card, Table, Tag, Segmented, Button, Popconfirm, Typography, App } from "antd";
import { SafetyCertificateOutlined, RollbackOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import Link from "next/link";
import AlertDisposeModal, { type DisposingAlert } from "./AlertDisposeModal";
import { reopenAlert } from "@/app/actions/alerts";

const { Text } = Typography;

type AlertRow = {
  id: string;
  level: string;
  reason: string;
  status: string;
  createdAt: string;
  dispositionType: string | null;
  disposition: string | null;
  handledBy: string | null;
  handledAt: string | null;
  enterprise: { id: string; name: string; industry: string; region: string };
};

const levelColor: Record<string, string> = { 高: "red", 中: "orange", 低: "blue" };

export default function AlertsView({ data, canWrite }: { data: AlertRow[]; canWrite: boolean }) {
  const { message } = App.useApp();
  const [status, setStatus] = useState<string>("全部");
  const [disposing, setDisposing] = useState<DisposingAlert | null>(null);

  const filtered = useMemo(
    () => (status === "全部" ? data : data.filter((d) => d.status === status)),
    [data, status],
  );
  const pendingCount = useMemo(() => data.filter((d) => d.status === "待处置").length, [data]);

  const onReopen = async (id: string) => {
    const res = await reopenAlert(id);
    if (res.ok) message.success("已撤销处置，预警退回待处置");
    else message.error(res.error);
  };

  const columns: ColumnsType<AlertRow> = [
    {
      title: "预警级别",
      dataIndex: "level",
      width: 90,
      render: (l: string) => <Tag color={levelColor[l]}>{l}</Tag>,
    },
    {
      title: "企业名称",
      dataIndex: ["enterprise", "name"],
      render: (name: string, r) => <Link href={`/enterprises/${r.enterprise.id}`}>{name}</Link>,
    },
    { title: "行业", dataIndex: ["enterprise", "industry"], width: 100 },
    { title: "区县", dataIndex: ["enterprise", "region"], width: 90 },
    { title: "预警原因", dataIndex: "reason" },
    {
      title: "处置状态",
      dataIndex: "status",
      width: 100,
      render: (s: string) => <Tag color={s === "待处置" ? "orange" : "green"}>{s}</Tag>,
    },
    {
      title: "处置情况",
      key: "disposition",
      width: 150,
      render: (_, r) =>
        r.status === "已处置" ? (
          <span>
            <Tag color={r.dispositionType === "系统自动核销" ? "default" : "blue"}>{r.dispositionType}</Tag>
            <span style={{ color: "#999", fontSize: 12 }}>{r.handledBy}</span>
          </span>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    { title: "预警时间", dataIndex: "createdAt", width: 110 },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_, r) => {
        if (!canWrite) return <Text type="secondary">—</Text>;
        if (r.status === "待处置") {
          return (
            <Button
              type="primary"
              size="small"
              icon={<SafetyCertificateOutlined />}
              onClick={() =>
                setDisposing({ id: r.id, level: r.level, reason: r.reason, enterpriseName: r.enterprise.name })
              }
            >
              处置
            </Button>
          );
        }
        return (
          <Popconfirm
            title="撤销处置？"
            description="预警将退回「待处置」，处置留痕被清除"
            okText="撤销"
            cancelText="取消"
            onConfirm={() => onReopen(r.id)}
          >
            <Button size="small" icon={<RollbackOutlined />}>
              撤销
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <>
      <Card
        title={`风险预警（待处置 ${pendingCount} 条 / 共 ${data.length} 条）`}
        extra={
          <Segmented
            options={["全部", "待处置", "已处置"]}
            value={status}
            onChange={(v) => setStatus(v as string)}
          />
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 12 }}
          size="middle"
          expandable={{
            // 仅已处置且有处置说明的行可展开，查看完整处置详情
            rowExpandable: (r) => r.status === "已处置" && !!r.disposition,
            expandedRowRender: (r) => (
              <div style={{ paddingInlineStart: 8 }}>
                <div>
                  <Text type="secondary">处置方式：</Text>
                  {r.dispositionType}
                  <Text type="secondary" style={{ marginInlineStart: 16 }}>
                    处置人：
                  </Text>
                  {r.handledBy}
                  <Text type="secondary" style={{ marginInlineStart: 16 }}>
                    处置时间：
                  </Text>
                  {r.handledAt}
                </div>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary">处置说明：</Text>
                  {r.disposition}
                </div>
              </div>
            ),
          }}
        />
      </Card>
      <AlertDisposeModal open={!!disposing} alert={disposing} onClose={() => setDisposing(null)} />
    </>
  );
}
