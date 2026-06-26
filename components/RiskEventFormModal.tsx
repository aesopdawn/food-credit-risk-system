"use client";
import { useEffect, useState } from "react";
import { Modal, Form, Select, Input, DatePicker, Switch, App } from "antd";
import dayjs from "dayjs";
import { addRiskEvent, updateRiskEvent, type EventInputType } from "@/app/actions/events";
import { EVENT_TYPES } from "@/lib/scoring";

export type EditingEvent = {
  id: string;
  type: string;
  title: string;
  severity: number;
  isVeto: boolean;
  source: string;
  occurredAt: string;
  remark?: string;
  repairTarget?: string;
};

const TYPE_OPTIONS = Object.entries(EVENT_TYPES).map(([value, label]) => ({ value, label }));
const SEVERITY_OPTIONS = [
  { value: 1, label: "1 · 轻微" },
  { value: 2, label: "2 · 较轻" },
  { value: 3, label: "3 · 一般" },
  { value: 4, label: "4 · 严重" },
  { value: 5, label: "5 · 特别严重" },
];
// 信用修复：用“修复力度”代替“严重程度”，恢复分值 = 力度 × 2
const REPAIR_STRENGTH_OPTIONS = [
  { value: 1, label: "1 · 轻微修复（+2 分）" },
  { value: 2, label: "2 · 部分修复（+4 分）" },
  { value: 3, label: "3 · 一般修复（+6 分）" },
  { value: 4, label: "4 · 较大修复（+8 分）" },
  { value: 5, label: "5 · 完全修复（+10 分）" },
];
const REPAIR_TARGET_OPTIONS = [
  { value: "PENALTY", label: "行政处罚" },
  { value: "INSPECTION", label: "抽查检查" },
  { value: "COMPLAINT", label: "投诉举报" },
];
const NEGATIVE_TYPES = ["PENALTY", "INSPECTION", "COMPLAINT"];

export default function RiskEventFormModal({
  open,
  enterpriseId,
  editing,
  onClose,
}: {
  open: boolean;
  enterpriseId: string;
  editing: EditingEvent | null;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        type: editing.type,
        title: editing.title,
        severity: editing.severity,
        isVeto: editing.isVeto,
        occurredAt: dayjs(editing.occurredAt),
        source: editing.source,
        remark: editing.remark,
        repairTarget: editing.repairTarget,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ type: "PENALTY", severity: 3, isVeto: false, occurredAt: dayjs() });
    }
  }, [open, editing, form]);

  const type = Form.useWatch("type", form);
  const isNegative = NEGATIVE_TYPES.includes(type);
  const isRepair = type === "REPAIR";

  const onOk = async () => {
    let v: {
      type: string;
      title: string;
      severity: number;
      isVeto?: boolean;
      occurredAt: dayjs.Dayjs;
      source: string;
      remark?: string;
      repairTarget?: string;
    };
    try {
      v = await form.validateFields();
    } catch {
      return; // 校验未通过，保持弹窗
    }
    setSubmitting(true);
    const payload: EventInputType = {
      enterpriseId,
      type: v.type as EventInputType["type"],
      title: v.title,
      severity: v.severity,
      isVeto: isNegative ? !!v.isVeto : false,
      occurredAt: v.occurredAt.toISOString(),
      source: v.source,
      remark: v.remark?.trim() || undefined,
      repairTarget: isRepair ? (v.repairTarget as EventInputType["repairTarget"]) : undefined,
    };
    const res = editing ? await updateRiskEvent(editing.id, payload) : await addRiskEvent(payload);
    setSubmitting(false);
    if (res.ok) {
      message.success(`已保存，企业最新评级：${res.level} 级（${res.score} 分）`);
      onClose();
    } else {
      message.error(res.error);
    }
  };

  return (
    <Modal
      title={editing ? "编辑涉企事件" : "录入涉企事件"}
      open={open}
      onOk={onOk}
      onCancel={onClose}
      confirmLoading={submitting}
      okText="保存并重新评级"
      cancelText="取消"
      width={520}
    >
      <Form form={form} layout="vertical" requiredMark style={{ marginTop: 8 }}>
        <Form.Item name="type" label="事件类型" rules={[{ required: true }]}>
          <Select options={TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="title" label="事由 / 标题" rules={[{ required: true, message: "请填写事由" }]}>
          <Input maxLength={200} placeholder={isRepair ? "如：已完成整改并通过复查" : "如：抽检发现菌落总数超标"} />
        </Form.Item>
        {isRepair && (
          <Form.Item
            name="repairTarget"
            label="修复对象"
            rules={[{ required: true, message: "请选择修复对象" }]}
            tooltip="信用修复会把分数加回到所选维度（封顶不超过该维度满分），不删除原扣分记录"
          >
            <Select options={REPAIR_TARGET_OPTIONS} placeholder="修复哪一类被扣分的问题" />
          </Form.Item>
        )}
        <Form.Item name="severity" label={isRepair ? "修复力度" : "严重程度"} rules={[{ required: true }]}>
          <Select options={isRepair ? REPAIR_STRENGTH_OPTIONS : SEVERITY_OPTIONS} />
        </Form.Item>
        <Form.Item name="occurredAt" label="发生时间" rules={[{ required: true, message: "请选择发生时间" }]}>
          <DatePicker style={{ width: "100%" }} disabledDate={(d) => d != null && d.isAfter(dayjs(), "day")} />
        </Form.Item>
        <Form.Item name="source" label="数据来源" rules={[{ required: true, message: "请填写数据来源" }]}>
          <Input maxLength={100} placeholder="如：国家食品安全抽检系统" />
        </Form.Item>
        {isNegative && (
          <Form.Item
            name="isVeto"
            label="一票否决"
            valuePropName="checked"
            tooltip="仅严重食品安全事故开启；开启后该企业将被直接定为 D 级"
          >
            <Switch checkedChildren="是" unCheckedChildren="否" />
          </Form.Item>
        )}
        <Form.Item name="remark" label="备注 / 处理结果">
          <Input.TextArea maxLength={500} rows={2} placeholder="选填，如：罚款2万元，文书号 鄂市监…" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
