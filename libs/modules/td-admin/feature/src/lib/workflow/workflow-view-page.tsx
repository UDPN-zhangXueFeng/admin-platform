'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Card, PageHeader, Timeline, type TimelineItem } from '@myorg/shared/ui';
import { useRouter } from '@myorg/shared/util-i18n';

import { WorkflowStatusTag } from '.';
import {
  useWorkflowDetailQuery,
} from '@myorg/modules/td-admin/data-access';
import { formatAdminTimestamp } from '../format-admin-time';

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
 */
export function WorkflowViewPage() {
  const t = useTranslations('modules.workflow');
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = parseId(searchParams.get('id'));

  const { data: detail, isLoading, isError } = useWorkflowDetailQuery(PROJECT_ID, id);

  if (!id) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('view.title')} backLabel={t('action.back')} onBack={() => router.push('/sys/workflow')} />
        <Card className="p-6"><p className="text-sm text-muted-foreground">{t('invalidId')}</p></Card>
      </div>
    );
  }

  const yesNo = (v?: number) =>
    v === 1 ? t('yes') : v === 2 ? t('no') : '—';
  const fmtDate = (ts?: number) => {
    const n = Number(ts);
    if (!Number.isFinite(n) || !n) return '—';
    return formatAdminTimestamp(n);
  };

  const nodes = detail?.nodes ?? [];
  const timelineItems: TimelineItem[] = [
    {
      key: 'initiator',
      title: t('process.initiator'),
      description: `${t('field.assignees')}: ${t('process.authorizedUser')}`,
      status: 'neutral',
    },
    ...nodes.map((node, idx): TimelineItem => ({
      key: `${node.stepOrder}-${idx}`,
      title: `${t('process.approver')} ${idx + 1}/${node.stepUsers.length}`,
      description: (
        <div className="space-y-0.5">
          <div>{`${t('field.assignees')}: ${node.stepUsers.map((u) => u.userName).join(' / ')}`}</div>
          <div>{`${t('field.executionMode')}: ${t('field.executionModeValue')}`}</div>
        </div>
      ),
      status: 'neutral',
    })),
    { key: 'end', title: t('process.end'), status: 'neutral' },
  ];

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <PageHeader className="mb-6" title={t('view.title')} backLabel={t('action.back')} onBack={() => router.push('/sys/workflow')} />
        {isError ? (
          <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {t('loadFailed')}
          </div>
        ) : null}
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
      </Card>

      {/* 流程节点 Steps（垂直点状） */}
      <Card className="p-6">
        <div className="mb-4 text-sm font-semibold">{t('process.title')}</div>
        <Timeline items={timelineItems} ariaLabel={t('process.title')} />
      </Card>

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

