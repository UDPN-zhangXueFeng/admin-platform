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
/* freeze — 紧急冻结 / 解冻                                            */
/* ------------------------------------------------------------------ */

const freezeColumns: MockColumn[] = [
  { key: 'id', label: '冻结编号' },
  { key: 'target', label: '冻结对象' },
  { key: 'type', label: '类型' },
  { key: 'reason', label: '原因' },
  { key: 'operator', label: '操作人' },
  { key: 'status', label: '状态' },
];

const freezeRows = [
  { id: 'FZ001', target: 'LP004 (示例 LP Delta)', type: '资金池', reason: '可疑交易', operator: '风控管理员', status: <Badge variant="destructive">已冻结</Badge> },
  { id: 'FZ002', target: 'BK004 (示例银行 D)', type: '账户', reason: '合规调查', operator: '风控管理员', status: <Badge variant="destructive">已冻结</Badge> },
  { id: 'FZ003', target: 'TX20260810004', type: '单笔交易', reason: '链上异常', operator: '风控管理员', status: <Badge variant="destructive">已冻结</Badge> },
  { id: 'FZ004', target: 'LP003 (示例 LP Gamma)', type: '资金池', reason: '临时风控', operator: '风控管理员', status: <Badge>已解冻</Badge> },
];

const freezeFields: MockField[] = [
  { key: 'id', label: '冻结编号' },
  { key: 'target', label: '冻结对象' },
  { key: 'type', label: '类型' },
  { key: 'reason', label: '原因' },
  { key: 'detail', label: '详细说明' },
  { key: 'operator', label: '操作人' },
  { key: 'frozenAt', label: '冻结时间' },
  { key: 'unfrozenAt', label: '解冻时间' },
  { key: 'status', label: '状态' },
];

const freezeData = {
  id: 'FZ001',
  target: 'LP004 (示例 LP Delta)',
  type: '资金池',
  reason: '可疑交易',
  detail: '检测到高频小额异常划转',
  operator: '风控管理员',
  frozenAt: '2026-08-09 22:00:00',
  unfrozenAt: '—',
  status: <Badge variant="destructive">已冻结</Badge>,
};

export function FreezeListPage() {
  return <MockListPage title="紧急冻结 / 解冻" columns={freezeColumns} rows={freezeRows} />;
}

export function FreezeDetailPage() {
  return <MockDetailPage title="冻结详情" fields={freezeFields} data={freezeData} />;
}

/* ------------------------------------------------------------------ */
/* monitor-rule — 监控规则                                             */
/* ------------------------------------------------------------------ */

const monitorRuleColumns: MockColumn[] = [
  { key: 'id', label: '规则编号' },
  { key: 'name', label: '规则名称' },
  { key: 'metric', label: '监控指标' },
  { key: 'threshold', label: '阈值' },
  { key: 'level', label: '告警等级' },
  { key: 'status', label: '状态' },
];

const monitorRuleRows = [
  { id: 'MR001', name: '单笔大额告警', metric: '交易金额', threshold: '> 100,000', level: <Badge variant="destructive">高</Badge>, status: <Badge>生效中</Badge> },
  { id: 'MR002', name: 'LP 低水位', metric: '资金池余额', threshold: '< 低水位阈值', level: <Badge variant="secondary">中</Badge>, status: <Badge>生效中</Badge> },
  { id: 'MR003', name: '高频交易', metric: '同 IP 频次', threshold: '> 50/min', level: <Badge variant="secondary">中</Badge>, status: <Badge>生效中</Badge> },
  { id: 'MR004', name: '汇率偏离', metric: '汇率偏差', threshold: '> 2%', level: <Badge variant="destructive">高</Badge>, status: <Badge variant="secondary">已停用</Badge> },
];

const monitorRuleFields: MockField[] = [
  { key: 'id', label: '规则编号' },
  { key: 'name', label: '规则名称' },
  { key: 'metric', label: '监控指标' },
  { key: 'threshold', label: '阈值' },
  { key: 'window', label: '统计窗口' },
  { key: 'action', label: '触发动作' },
  { key: 'level', label: '告警等级' },
  { key: 'updatedAt', label: '更新时间' },
  { key: 'status', label: '状态' },
];

const monitorRuleData = {
  id: 'MR001',
  name: '单笔大额告警',
  metric: '交易金额',
  threshold: '> 100,000',
  window: '单笔',
  action: '人工复核',
  level: <Badge variant="destructive">高</Badge>,
  updatedAt: '2026-08-01 10:00:00',
  status: <Badge>生效中</Badge>,
};

const monitorRuleFormFields: MockField[] = [
  { key: 'name', label: '规则名称' },
  { key: 'metric', label: '监控指标' },
  { key: 'threshold', label: '阈值' },
  { key: 'window', label: '统计窗口' },
  { key: 'action', label: '触发动作' },
];

export function MonitorRuleListPage() {
  return <MockListPage title="监控规则" columns={monitorRuleColumns} rows={monitorRuleRows} />;
}

export function MonitorRuleDetailPage() {
  return <MockDetailPage title="监控规则详情" fields={monitorRuleFields} data={monitorRuleData} />;
}

export function MonitorRuleFormPage() {
  return <MockFormPage title="监控规则编辑" fields={monitorRuleFormFields} />;
}

/* ------------------------------------------------------------------ */
/* monitor-hit — 命中记录                                              */
/* ------------------------------------------------------------------ */

const monitorHitColumns: MockColumn[] = [
  { key: 'id', label: '命中编号' },
  { key: 'ruleId', label: '规则' },
  { key: 'target', label: '命中对象' },
  { key: 'level', label: '告警等级' },
  { key: 'hitAt', label: '命中时间' },
  { key: 'status', label: '处置状态' },
];

const monitorHitRows = [
  { id: 'MH001', ruleId: 'MR001 单笔大额告警', target: 'TX20260810005', level: <Badge variant="destructive">高</Badge>, hitAt: '2026-08-10 08:45:00', status: <Badge variant="secondary">待处置</Badge> },
  { id: 'MH002', ruleId: 'MR002 LP 低水位', target: 'POOL003', level: <Badge variant="secondary">中</Badge>, hitAt: '2026-08-10 07:00:00', status: <Badge>已处置</Badge> },
  { id: 'MH003', ruleId: 'MR003 高频交易', target: 'IP 203.0.113.7', level: <Badge variant="secondary">中</Badge>, hitAt: '2026-08-09 23:30:00', status: <Badge>已处置</Badge> },
  { id: 'MH004', ruleId: 'MR001 单笔大额告警', target: 'TX20260809100', level: <Badge variant="destructive">高</Badge>, hitAt: '2026-08-09 15:20:00', status: <Badge variant="destructive">已挂起</Badge> },
];

const monitorHitFields: MockField[] = [
  { key: 'id', label: '命中编号' },
  { key: 'ruleId', label: '规则' },
  { key: 'target', label: '命中对象' },
  { key: 'actualValue', label: '实际值' },
  { key: 'threshold', label: '阈值' },
  { key: 'level', label: '告警等级' },
  { key: 'hitAt', label: '命中时间' },
  { key: 'handler', label: '处置人' },
  { key: 'status', label: '处置状态' },
];

const monitorHitData = {
  id: 'MH001',
  ruleId: 'MR001 单笔大额告警',
  target: 'TX20260810005',
  actualValue: '50,000',
  threshold: '> 100,000',
  level: <Badge variant="destructive">高</Badge>,
  hitAt: '2026-08-10 08:45:00',
  handler: '—',
  status: <Badge variant="secondary">待处置</Badge>,
};

export function MonitorHitListPage() {
  return <MockListPage title="命中记录" columns={monitorHitColumns} rows={monitorHitRows} />;
}

export function MonitorHitDetailPage() {
  return <MockDetailPage title="命中记录详情" fields={monitorHitFields} data={monitorHitData} />;
}
