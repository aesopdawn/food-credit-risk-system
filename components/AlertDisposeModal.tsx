"use client";
import { useEffect, useState } from "react";
import { Modal, Form, Select, Input, Switch, Divider, Tag, Typography, App } from "antd";
import { disposeAlert, type DisposeInputType } from "@/app/actions/alerts";
import { DISPOSITION_TYPES } from "@/lib/alert-constants";
import { EVENT_TYPES } from "@/lib/scoring";

const { Text } = Typography;

export type DisposingAlert = {
  id: string;
  level: string;
  reason: string;
  enterpriseName: string;
};

const DISPOSITION_OPTIONS = DISPOSITION_TYPES.map((v) => ({ value: v, label: v }));
const EVENT_OPTIONS = Object.entries(EVENT_TYPES).map(([value, label]) => ({ value, label }));
const SEVERITY_OPTIONS = [
  { value: 1, label: "1 · 轻微" },
  { value: 2, label: "2 · 较轻" },
  { value: 3, label: "3 · 一般" },
  { value: 4, label: "4 · 严重" },
  { value: 5, label: "5 · 特别严重" },
];

// 处置方式 → 建议同步登记的事件类型（仅作默认值，用户可改）
const SUGGESTED_EVENT: Record<string, string> = {
  现场核查: "INSPECTION",
  责令整改: "INSPECTION",
  约谈告诫: "INSPECTION",
  督促信用修复: "REPAIR",
  记录归档: "INSPECTION",
};

const levelColor: Record<string, string> = { 高: "red", 中: "orange", 低: "blue" };

export default function AlertDisposeModal({
  open,
  alert,
  onClose,
}: {
  open: boolean;
  alert: DisposingAlert | null;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ dispositionType: "现场核查", followUpEnabled: false, followUpSeverity: 2 });
  }, [open, form]);

  const dispositionType = Form.useWatch("dispositionType", form);
  const followUpEnabled = Form.useWatch("followUpEnabled", form);

  // 切换处置方式时，同步建议的事件类型
  useEffect(() => {
    if (dispositionType) form.setFieldValue("followUpType", SUGGESTED_EVENT[dispositionType] ?? "INSPECTION");
  }, [dispositionType, form]);

  const onOk = async () => {
    let v: {
      dispositionType: (typeof DISPOSITION_TYPES)[number];
      disposition: string;
      followUpEnabled?: boolean;
      followUpType?: string;
      followUpTitle?: string;
      followUpSeverity?: number;
    };
    try {
      v = await form.validateFields();
    } catch {
      return; // 校验未过，保持弹窗
    }
    if (!alert) return;
    setSubmitting(true);
    const payload: DisposeInputType = {
      alertId: alert.id,
      dispositionType: v.dispositionType,
      disposition: v.disposition,
      followUp:
        v.followUpEnabled && v.followUpType && v.followUpTitle
          ? {
              type: v.followUpType as NonNullable<DisposeInputType["followUp"]>["type"],
              title: v.followUpTitle,
              severity: v.followUpSeverity ?? 2,
            }
          : undefined,
    };
    const res = await disposeAlert(payload);
    setSubmitting(false);
    if (res.ok) {
      message.success(
        res.reRated ? `预警已处置，企业最新评级：${res.level} 级（${res.score} 分）` : "预警已处置",
      );
      onClose();
    } else {
      message.error(res.error);
    }
  };

  return (
    <Modal
      title="处置风险预警"
      open={open}
      onOk={onOk}
      onCancel={onClose}
      confirmLoading={submitting}
      okText="确认处置"
      cancelText="取消"
      width={560}
      destroyOnHidden
    >
      {alert && (
        <div style={{ background: "#fafafa", borderRadius: 8, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>
            <Tag color={levelColor[alert.level]}>{alert.level}风险</Tag>
            <Text strong>{alert.enterpriseName}</Text>
          </div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            预警原因：{alert.reason}
          </Text>
        </div>
      )}
      <Form form={form} layout="vertical" requiredMark>
        <Form.Item name="dispositionType" label="处置方式" rules={[{ required: true }]}>
          <Select options={DISPOSITION_OPTIONS} />
        </Form.Item>
        <Form.Item name="disposition" label="处置说明 / 处置结果" rules={[{ required: true, message: "请填写处置说明" }]}>
          <Input.TextArea maxLength={500} rows={3} placeholder="如：已现场核查，企业已完成整改，相关问题已闭环处理" />
        </Form.Item>

        <Divider style={{ margin: "4px 0 12px" }} />
        <Form.Item
          name="followUpEnabled"
          label="同步登记一条监管措施事件"
          valuePropName="checked"
          tooltip="开启后，本次监管措施将作为一条涉企事件写回该企业，并自动触发重新评级（闭环回流）"
          style={{ marginBottom: followUpEnabled ? undefined : 0 }}
        >
          <Switch checkedChildren="开" unCheckedChildren="关" />
        </Form.Item>

        {followUpEnabled && (
          <>
            <Form.Item name="followUpType" label="事件类型" rules={[{ required: true, message: "请选择事件类型" }]}>
              <Select options={EVENT_OPTIONS} />
            </Form.Item>
            <Form.Item name="followUpTitle" label="措施事由" rules={[{ required: true, message: "请填写措施事由" }]}>
              <Input maxLength={200} placeholder="如：复查菌落总数合格 / 已完成信用修复" />
            </Form.Item>
            <Form.Item name="followUpSeverity" label="严重程度" rules={[{ required: true }]}>
              <Select options={SEVERITY_OPTIONS} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
