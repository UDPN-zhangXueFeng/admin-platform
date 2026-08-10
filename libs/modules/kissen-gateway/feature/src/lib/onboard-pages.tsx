'use client';

import {
  MockDetailPage,
  MockFormPage,
  MockListPage,
  type MockColumn,
  type MockField,
} from './mock-components';

const columns: MockColumn[] = [
  { key: 'id', label: '申请编号' },
  { key: 'merchant', label: '商户名称' },
  { key: 'contact', label: '联系人' },
  { key: 'industry', label: '行业' },
  { key: 'status', label: '状态' },
  { key: 'createdAt', label: '申请时间' },
];

const mockRows = [
  { id: 'OB20260801', merchant: '示例支付有限公司', contact: '张伟', industry: '金融科技', status: '已通过', createdAt: '2026-08-01 09:12' },
  { id: 'OB20260802', merchant: '环球贸易科技', contact: '李娜', industry: '跨境贸易', status: '审核中', createdAt: '2026-08-03 14:30' },
  { id: 'OB20260803', merchant: '星河数字资产', contact: '王强', industry: '数字资产', status: '待补充', createdAt: '2026-08-05 10:05' },
  { id: 'OB20260804', merchant: '蓝海电商服务', contact: '赵敏', industry: '电子商务', status: '已驳回', createdAt: '2026-08-07 16:48' },
];

const detailFields: MockField[] = [
  { key: 'id', label: '申请编号' },
  { key: 'merchant', label: '商户名称' },
  { key: 'contact', label: '联系人' },
  { key: 'phone', label: '联系电话' },
  { key: 'email', label: '邮箱' },
  { key: 'industry', label: '行业' },
  { key: 'status', label: '状态' },
  { key: 'createdAt', label: '申请时间' },
];

const detailData = {
  id: 'OB20260801',
  merchant: '示例支付有限公司',
  contact: '张伟',
  phone: '138-0000-0001',
  email: 'zhangwei@example.com',
  industry: '金融科技',
  status: '已通过',
  createdAt: '2026-08-01 09:12',
};

const formFields: MockField[] = [
  { key: 'merchant', label: '商户名称' },
  { key: 'contact', label: '联系人' },
  { key: 'phone', label: '联系电话' },
  { key: 'email', label: '邮箱', type: 'text' },
  { key: 'industry', label: '行业', type: 'select', options: ['金融科技', '跨境贸易', '数字资产', '电子商务'] },
  { key: 'status', label: '状态', type: 'select', options: ['待补充', '审核中', '已通过', '已驳回'] },
];

export function OnboardListPage() {
  return (
    <MockListPage
      title="入网申请"
      description="商户接入网关的入网申请记录"
      columns={columns}
      rows={mockRows}
    />
  );
}

export function OnboardDetailPage() {
  return <MockDetailPage title="入网申请详情" fields={detailFields} data={detailData} />;
}

export function OnboardFormPage() {
  return <MockFormPage title="入网申请编辑" fields={formFields} />;
}
