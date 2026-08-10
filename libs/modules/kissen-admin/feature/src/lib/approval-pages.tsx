'use client';

import {
  MockListPage,
  MockDetailPage,
  type MockColumn,
  type MockField,
} from './mock-components';
import { Badge } from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* approval-center — 审批中心                                          */
/* ------------------------------------------------------------------ */

const approvalCenterColumns: MockColumn[] = [
  { key: 'id', label: '审批单号' },
  { key: 'type', label: '业务类型' },
  { key: 'applicant', label: '申请人' },
  { key: 'summary', label: '摘要' },
  { key: 'createdAt', label: '提交时间' },
  { key: 'status', label: '审批状态' },
];

const approvalCenterRows = [
  { id: 'AV202608001', type: '银行入网', applicant: '李四', summary: '示例银行 B 新增入网', createdAt: '2026-08-05 14:20:00', status: <Badge variant="secondary">待审批</Badge> },
  { id: 'AV202608002', type: '资金冻结', applicant: '风控管理员', summary: 'LP004 可疑交易冻结', createdAt: '2026-08-09 22:05:00', status: <Badge variant="secondary">待审批</Badge> },
  { id: 'AV202608003', type: '汇率配置', applicant: '运营管理员', summary: 'USDT/USD 加价率调整', createdAt: '2026-08-04 09:30:00', status: <Badge>已通过</Badge> },
  { id: 'AV202608004', type: '大额放行', applicant: '运营管理员', summary: 'TX20260810005 50,000 放行', createdAt: '2026-08-10 08:50:00', status: <Badge variant="destructive">已驳回</Badge> },
  { id: 'AV202608005', type: '角色变更', applicant: '系统管理员', summary: '风控组新增成员', createdAt: '2026-08-08 11:00:00', status: <Badge>已通过</Badge> },
];

const approvalCenterFields: MockField[] = [
  { key: 'id', label: '审批单号' },
  { key: 'type', label: '业务类型' },
  { key: 'applicant', label: '申请人' },
  { key: 'summary', label: '摘要' },
  { key: 'currentNode', label: '当前节点' },
  { key: 'approver', label: '当前审批人' },
  { key: 'createdAt', label: '提交时间' },
  { key: 'resolvedAt', label: '完结时间' },
  { key: 'status', label: '审批状态' },
];

const approvalCenterData = {
  id: 'AV202608001',
  type: '银行入网',
  applicant: '李四',
  summary: '示例银行 B 新增入网',
  currentNode: '运营复核',
  approver: '运营主管',
  createdAt: '2026-08-05 14:20:00',
  resolvedAt: '—',
  status: <Badge variant="secondary">待审批</Badge>,
};

export function ApprovalCenterListPage() {
  return <MockListPage title="审批中心" columns={approvalCenterColumns} rows={approvalCenterRows} />;
}

export function ApprovalCenterDetailPage() {
  return <MockDetailPage title="审批详情" fields={approvalCenterFields} data={approvalCenterData} />;
}
