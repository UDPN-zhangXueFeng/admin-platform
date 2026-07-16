'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import { WorkflowStatusTag } from '@myorg/modules/workflow/ui';
import {
  useWorkflowDetailQuery,
} from '@myorg/modules/workflow/data-access';

/** `stablecoin` 是默认活动项目（见 configs/stablecoin.json）。 */
const PROJECT_ID = 'stablecoin';

function parseId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * WorkflowViewPage — 工作流详情只读页。
 *
 * 迁移自 td-manage `src/pages/sys/workflow/view.tsx`（186 行）。
 * - id 从 useSearchParams 取（路由 /sys/workflow/view?id=X）。注意路由 query key 为 `id`
 *   （旧页 query.id），与 role 的 roleId 不同——保留旧契约。
 * - 基础信息描述列表：workflowName / businessName / workflowNodes（节点数）/
 *   withdrawType / previousStepType / escalationType（三项开关 1=Yes/2=No）/ createdDate / status。
 * - 流程节点：垂直 Steps（发起人占位 + detail.nodes[] 审批人 + End）。
 *
 * source 旧页用 antd Steps progressDot vertical；此处自渲染带圆点的垂直步骤列表，
 * 零新依赖（参考 role 自渲染思路）。
 */
export function WorkflowViewPage() {
  const t = useTranslations('modules.workflow');
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = parseId(searchParams.get('id'));

  const { data: detail, isLoading } = useWorkflowDetailQuery(PROJECT_ID, id);

  if (!id) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">{t('invalidId')}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/sys/workflow')}
        >
          {t('action.back')}
        </Button>
      </div>
    );
  }

  const yesNo = (v?: number) =>
    v === 1 ? t('yes') : v === 2 ? t('no') : '—';
  const fmtDate = (ts?: number) => {
    const n = Number(ts);
    if (!Number.isFinite(n) || !n) return '—';
    return new Date(n).toLocaleString();
  };

  const nodes = detail?.nodes ?? [];

  return (
    <div className="space-y-4">
      {/* 基础信息描述列表 */}
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-6 text-base font-semibold">{t('view.title')}</div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <DescItem label={t('field.workflowName')} value={detail?.workflowName} loading={isLoading} />
          <DescItem label={t('field.businessName')} value={detail?.businessName} loading={isLoading} />
          <DescItem
            label={t('field.nodes')}
            value={detail?.workflowNodes != null ? String(detail.workflowNodes) : undefined}
            loading={isLoading}
          />
          <DescItem label={t('field.withdraw')} value={yesNo(detail?.withdrawType)} />
          <DescItem label={t('field.revert')} value={yesNo(detail?.previousStepType)} />
          <DescItem label={t('field.escalate')} value={yesNo(detail?.escalationType)} />
          <DescItem label={t('field.createdDate')} value={fmtDate(detail?.createdDate)} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('field.status')}</label>
            <div>
              {detail ? (
                <WorkflowStatusTag
                  status={detail.status}
                  activeLabel={t('status.active')}
                  inactiveLabel={t('status.inactive')}
                />
              ) : (
                '—'
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 流程节点 Steps（垂直点状） */}
      <section className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <div className="mb-4 text-sm font-semibold">{t('process.title')}</div>
        <ol className="relative space-y-6 pl-6">
          {/* 发起人占位（旧页固定首项） */}
          <StepItem
            title={t('process.initiator')}
            description={`${t('field.escalate')}: ${t('process.authorizedUser')}`}
          />
          {/* 审批节点 */}
          {nodes.map((node, idx) => (
            <StepItem
              key={`${node.stepOrder}-${idx}`}
              title={`${t('process.approver')} ${idx + 1}`}
              description={`${t('field.assignees')}: ${node.stepUsers
                .map((u) => u.userName)
                .join(' / ')}`}
            />
          ))}
          {/* End */}
          <StepItem title={t('process.end')} />
        </ol>
      </section>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/sys/workflow')}>
          {t('action.back')}
        </Button>
      </div>
    </div>
  );
}

function DescItem({
  label,
  value,
  loading,
}: {
  label: string;
  value?: string;
  loading?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <div className="text-sm">{loading ? '—' : value || '—'}</div>
    </div>
  );
}

function StepItem({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <li className="relative">
      {/* 圆点 */}
      <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-theme ring-4 ring-theme/20" />
      <div className="text-sm font-medium">{title}</div>
      {description ? (
        <div className="text-sm text-muted-foreground">{description}</div>
      ) : null}
    </li>
  );
}
