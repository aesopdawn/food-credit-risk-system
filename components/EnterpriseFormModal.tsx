"use client";
import { useEffect, useState } from "react";
import { Modal, Form, Input, InputNumber, Select, DatePicker, Button, Space, Row, Col, App } from "antd";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { createEnterprise, updateEnterprise, type EnterpriseInputType } from "@/app/actions/enterprises";

const INDUSTRIES = ["食品生产", "食品销售", "餐饮服务", "食品添加剂"];
const REGIONS = ["江岸区", "江汉区", "硚口区", "汉阳区", "武昌区", "洪山区", "青山区", "东西湖区"];
const STATUSES = ["在营", "注销", "吊销"];

export type EnterpriseFormInitial = {
  id: string;
  name: string;
  uscc: string;
  legalPerson: string;
  registeredCapital: number;
  establishedAt: string; // YYYY-MM-DD
  industry: string;
  region: string;
  businessScope: string;
  status: string;
};

function randomUscc(): string {
  const chars = "0123456789ABCDEFGHJKLMNPQRTUWXY";
  let s = "91";
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function EnterpriseFormModal({
  open,
  mode,
  initial,
  onClose,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial?: EnterpriseFormInitial | null;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      form.setFieldsValue({ ...initial, establishedAt: dayjs(initial.establishedAt) });
    } else {
      form.resetFields();
      form.setFieldsValue({ status: "在营", industry: "食品生产" });
    }
  }, [open, mode, initial, form]);

  const onOk = async () => {
    let v: Omit<EnterpriseInputType, "establishedAt"> & { establishedAt: dayjs.Dayjs };
    try {
      v = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    const payload: EnterpriseInputType = {
      name: v.name,
      uscc: v.uscc,
      legalPerson: v.legalPerson,
      registeredCapital: Number(v.registeredCapital),
      establishedAt: v.establishedAt.toISOString(),
      industry: v.industry,
      region: v.region,
      businessScope: v.businessScope,
      status: v.status,
    };

    if (mode === "edit" && initial) {
      const res = await updateEnterprise(initial.id, payload);
      setSubmitting(false);
      if (res.ok) {
        message.success("企业档案已更新");
        onClose();
      } else {
        message.error(res.error);
      }
    } else {
      const res = await createEnterprise(payload);
      setSubmitting(false);
      if (res.ok) {
        message.success("企业建档成功，已生成初始评级");
        onClose();
        router.push(`/enterprises/${res.id}`);
      } else {
        message.error(res.error);
      }
    }
  };

  return (
    <Modal
      title={mode === "edit" ? "编辑企业档案" : "新增企业"}
      open={open}
      onOk={onOk}
      onCancel={onClose}
      confirmLoading={submitting}
      okText={mode === "edit" ? "保存" : "建档"}
      cancelText="取消"
      width={620}
    >
      <Form form={form} layout="vertical" requiredMark style={{ marginTop: 8 }}>
        <Form.Item name="name" label="企业名称" rules={[{ required: true, message: "请填写企业名称" }]}>
          <Input maxLength={100} placeholder="如：湖滨硚口食品有限公司" />
        </Form.Item>

        <Form.Item label="统一社会信用代码" required>
          <Space.Compact style={{ width: "100%" }}>
            <Form.Item name="uscc" noStyle rules={[{ required: true, message: "请填写统一社会信用代码" }]}>
              <Input maxLength={18} placeholder="18 位统一社会信用代码" />
            </Form.Item>
            {mode === "create" && <Button onClick={() => form.setFieldValue("uscc", randomUscc())}>随机生成</Button>}
          </Space.Compact>
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="legalPerson" label="法定代表人" rules={[{ required: true, message: "请填写法定代表人" }]}>
              <Input maxLength={50} placeholder="如：王建国" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="registeredCapital" label="注册资本（万元）" rules={[{ required: true, message: "请填写注册资本" }]}>
              <InputNumber min={0} style={{ width: "100%" }} placeholder="如：500" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="industry" label="行业" rules={[{ required: true, message: "请选择行业" }]}>
              <Select options={INDUSTRIES.map((i) => ({ value: i, label: i }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="region" label="所在区县" rules={[{ required: true, message: "请选择所在区县" }]}>
              <Select showSearch options={REGIONS.map((r) => ({ value: r, label: r }))} placeholder="选择区县" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="establishedAt" label="成立日期" rules={[{ required: true, message: "请选择成立日期" }]}>
              <DatePicker style={{ width: "100%" }} disabledDate={(d) => d != null && d.isAfter(dayjs(), "day")} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="status" label="经营状态" rules={[{ required: true }]}>
              <Select options={STATUSES.map((s) => ({ value: s, label: s }))} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="businessScope" label="经营范围" rules={[{ required: true, message: "请填写经营范围" }]}>
          <Input.TextArea maxLength={500} rows={2} placeholder="如：食品销售；预包装食品、散装食品销售（具体以许可证为准）" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
