'use client';

import {
  MockListPage,
  MockDetailPage,
  MockFormPage,
  type MockColumn,
  type MockField,
} from './mock-components';
import { Badge } from '@myorg/shared/ui';

/* ------------------------------------------------------------------ */
/* bank-info — 银行资料与配置                                          */
/* ------------------------------------------------------------------ */

const bankInfoColumns: MockColumn[] = [
  { key: 'id', label: '银行编号' },
  { key: 'name', label: '银行名称' },
  { key: 'code', label: '清算编码' },
  { key: 'contact', label: '联系人' },
  { key: 'status', label: '状态' },
];

const bankInfoRows = [
  { id: 'BK001', name: '示例银行 A', code: 'CLRBK001', contact: '张三', status: <Badge>已启用</Badge> },
  { id: 'BK002', name: '示例银行 B', code: 'CLRBK002', contact: '李四', status: <Badge variant="secondary">待审核</Badge> },
  { id: 'BK003', name: '示例银行 C', code: 'CLRBK003', contact: '王五', status: <Badge>已启用</Badge> },
  { id: 'BK004', name: '示例银行 D', code: 'CLRBK004', contact: '赵六', status: <Badge variant="destructive">已停用</Badge> },
];

const bankInfoFields: MockField[] = [
  { key: 'id', label: '银行编号' },
  { key: 'name', label: '银行名称' },
  { key: 'code', label: '清算编码' },
  { key: 'contact', label: '联系人' },
  { key: 'phone', label: '联系电话' },
  { key: 'status', label: '状态' },
  { key: 'settleAccount', label: '结算账户' },
  { key: 'createdAt', label: '入网时间' },
];

const bankInfoData = {
  id: 'BK001',
  name: '示例银行 A',
  code: 'CLRBK001',
  contact: '张三',
  phone: '138-0000-0001',
  status: <Badge>已启用</Badge>,
  settleAccount: '6228 4800 0000 0001',
  createdAt: '2026-07-01 09:00:00',
};

const bankInfoFormFields: MockField[] = [
  { key: 'name', label: '银行名称' },
  { key: 'code', label: '清算编码' },
  { key: 'contact', label: '联系人' },
  { key: 'phone', label: '联系电话' },
  { key: 'settleAccount', label: '结算账户' },
];

export function BankInfoListPage() {
  return (
    <MockListPage
      title="银行资料与配置"
      description="管理入网银行的基础资料与清算配置"
      columns={bankInfoColumns}
      rows={bankInfoRows}
    />
  );
}

export function BankInfoDetailPage() {
  return <MockDetailPage title="银行详情" fields={bankInfoFields} data={bankInfoData} />;
}

export function BankInfoFormPage() {
  return <MockFormPage title="银行资料编辑" fields={bankInfoFormFields} />;
}

/* ------------------------------------------------------------------ */
/* bank-approval — 入网审核与启用                                      */
/* ------------------------------------------------------------------ */

const bankApprovalColumns: MockColumn[] = [
  { key: 'id', label: '申请编号' },
  { key: 'bankName', label: '银行名称' },
  { key: 'type', label: '申请类型' },
  { key: 'applicant', label: '申请人' },
  { key: 'status', label: '审核状态' },
];

const bankApprovalRows = [
  { id: 'AP202608001', bankName: '示例银行 B', type: '新增入网', applicant: '李四', status: <Badge variant="secondary">待审核</Badge> },
  { id: 'AP202608002', bankName: '示例银行 A', type: '信息变更', applicant: '张三', status: <Badge>已通过</Badge> },
  { id: 'AP202608003', bankName: '示例银行 C', type: '启用变更', applicant: '王五', status: <Badge variant="secondary">待审核</Badge> },
  { id: 'AP202608004', bankName: '示例银行 D', type: '停用申请', applicant: '赵六', status: <Badge variant="destructive">已驳回</Badge> },
];

const bankApprovalFields: MockField[] = [
  { key: 'id', label: '申请编号' },
  { key: 'bankName', label: '银行名称' },
  { key: 'type', label: '申请类型' },
  { key: 'applicant', label: '申请人' },
  { key: 'applyTime', label: '申请时间' },
  { key: 'reviewer', label: '审核人' },
  { key: 'reviewTime', label: '审核时间' },
  { key: 'status', label: '审核状态' },
];

const bankApprovalData = {
  id: 'AP202608001',
  bankName: '示例银行 B',
  type: '新增入网',
  applicant: '李四',
  applyTime: '2026-08-05 14:20:00',
  reviewer: '—',
  reviewTime: '—',
  status: <Badge variant="secondary">待审核</Badge>,
};

export function BankApprovalListPage() {
  return <MockListPage title="入网审核与启用" columns={bankApprovalColumns} rows={bankApprovalRows} />;
}

export function BankApprovalDetailPage() {
  return <MockDetailPage title="审核详情" fields={bankApprovalFields} data={bankApprovalData} />;
}

/* ------------------------------------------------------------------ */
/* gateway-register — Gateway 实例登记                                 */
/* ------------------------------------------------------------------ */

const gatewayRegisterColumns: MockColumn[] = [
  { key: 'id', label: '实例编号' },
  { key: 'name', label: '实例名称' },
  { key: 'region', label: '所属区域' },
  { key: 'endpoint', label: '接入地址' },
  { key: 'status', label: '状态' },
];

const gatewayRegisterRows = [
  { id: 'GW001', name: 'gateway-prod-cn', region: '华东 1', endpoint: 'https://gw-cn.example.com', status: <Badge>运行中</Badge> },
  { id: 'GW002', name: 'gateway-prod-hk', region: '香港', endpoint: 'https://gw-hk.example.com', status: <Badge>运行中</Badge> },
  { id: 'GW003', name: 'gateway-sg', region: '新加坡', endpoint: 'https://gw-sg.example.com', status: <Badge variant="secondary">待启用</Badge> },
  { id: 'GW004', name: 'gateway-us', region: '美西', endpoint: 'https://gw-us.example.com', status: <Badge variant="destructive">已停用</Badge> },
];

const gatewayRegisterFields: MockField[] = [
  { key: 'id', label: '实例编号' },
  { key: 'name', label: '实例名称' },
  { key: 'region', label: '所属区域' },
  { key: 'endpoint', label: '接入地址' },
  { key: 'version', label: '网关版本' },
  { key: 'bindBank', label: '绑定银行' },
  { key: 'createdAt', label: '登记时间' },
  { key: 'status', label: '状态' },
];

const gatewayRegisterData = {
  id: 'GW001',
  name: 'gateway-prod-cn',
  region: '华东 1',
  endpoint: 'https://gw-cn.example.com',
  version: '2.4.1',
  bindBank: '示例银行 A',
  createdAt: '2026-06-15 10:30:00',
  status: <Badge>运行中</Badge>,
};

const gatewayRegisterFormFields: MockField[] = [
  { key: 'name', label: '实例名称' },
  { key: 'region', label: '所属区域' },
  { key: 'endpoint', label: '接入地址' },
  { key: 'version', label: '网关版本' },
  { key: 'bindBank', label: '绑定银行' },
];

export function GatewayRegisterListPage() {
  return <MockListPage title="Gateway 实例登记" columns={gatewayRegisterColumns} rows={gatewayRegisterRows} />;
}

export function GatewayRegisterDetailPage() {
  return <MockDetailPage title="实例详情" fields={gatewayRegisterFields} data={gatewayRegisterData} />;
}

export function GatewayRegisterFormPage() {
  return <MockFormPage title="Gateway 实例登记" fields={gatewayRegisterFormFields} />;
}
