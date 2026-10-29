'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Button,
  Label,
  RadioGroup,
  RadioGroupItem,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@myorg/shared/ui';
import {
  useAuditSpAccessMutation,
  useSpAccessApprovalDetailQuery,
  useSpAccessSftpBase64Query,
  type SpAccessDetailAccessItem,
  type SpAccessDetailTd,
} from '@myorg/modules/td-admin/data-access';
import { EMPTY_FIELD_VALUE, formatTimestamp } from './formatters';

/** 上游审批页 Token 行:仅展示 accessType 1(OpenAPI)与 5(Contract)。 */
const OPEN_API_ACCESS_TYPE = 1;
const CONTRACT_ACCESS_TYPE = 5;

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0);
}

function TokenPermissionCard({ token }: { token: SpAccessDetailTd }) {
  const displayName = firstNonEmpty(token.tdName, token.tokenName) ?? EMPTY_FIELD_VALUE;
  const blockchain = firstNonEmpty(token.blockchainName);
  const accessList = token.accessList ?? [];
  const openApiAccess = accessList.find((item) => Number(item.accessType) === OPEN_API_ACCESS_TYPE);
  const contractAccess = accessList.find((item) => Number(item.accessType) === CONTRACT_ACCESS_TYPE);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-semibold"
        >
          {Number.isFinite(Number(token.tokenType)) ? `T${Number(token.tokenType)}` : 'T'}
        </span>
        <span className="text-sm font-medium">
          {displayName}
          {blockchain ? (
            <span className="text-muted-foreground"> (Based on {blockchain})</span>
          ) : null}
        </span>
      </div>
      {[openApiAccess, contractAccess]
        .filter((access): access is SpAccessDetailAccessItem => Boolean(access))
        .map((access, index) => {
          const entries = (access.typeAndPermissionList ?? []).flatMap(
            (entry) => entry.walletTypeList?.map((wallet) => wallet.name) ?? [],
          );
          const shown = entries.slice(0, 6);
          const rest = entries.slice(6);
          return (
            <div key={index} className="mt-2 text-sm">
              <span className="font-medium">
                {(access.typeAndPermissionList ?? [])[0]?.accessConfName ?? EMPTY_FIELD_VALUE}
              </span>
              {': '}
              <span className="text-muted-foreground">
                {shown.join('、') || EMPTY_FIELD_VALUE}
              </span>
              {rest.length > 0 ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button type="button" variant="link" size="sm" className="h-auto p-0">
                        +{rest.length}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{rest.join('、')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </div>
          );
        })}
    </div>
  );
}

export function SpAccessApprovalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('modules.sp-access');
  const tc = useTranslations('common');

  // 上游契约:/sp-access/approval?id={id},basicInfo 入参字段名 spRecordId(approval.tsx:40-43)。
  const spRecordId = React.useMemo(() => {
    const raw = searchParams.get('id');
    if (!raw) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [searchParams]);

  const { data: detail, isLoading } = useSpAccessApprovalDetailQuery(spRecordId);
  const auditMutation = useAuditSpAccessMutation();
  const { mutate: submitAudit, isPending: auditPending } = auditMutation;

  const licensePreview = useSpAccessSftpBase64Query(
    detail?.busType && detail?.spId
      ? { busType: Number(detail.busType), busId: Number(detail.spId) }
      : null,
  );
  const licenseSrc =
    licensePreview.data && detail?.fileType
      ? `data:image/${detail.fileType};base64,${licensePreview.data}`
      : null;

  const [auditState, setAuditState] = React.useState('3');
  const [remarks, setRemarks] = React.useState('');
  const [remarksError, setRemarksError] = React.useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (auditPending || !spRecordId) return;
    if (!remarks.trim()) {
      setRemarksError(tc('PUB_Pleased').replace('****', tc('PUB_Comment')));
      return;
    }
    setRemarksError(null);
    submitAudit(
      {
        spRecordId,
        auditFlag: Number(auditState) === 3,
        auditRemark: remarks.trim(),
      },
      {
        onSuccess: () => {
          toast.success(tc('PUB_Success'));
          router.back();
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        {t('sp_access_0045')}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => router.back()}>
          {tc('PUB_GoBack')}
        </Button>
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          {t('sp_access_0002')} · {EMPTY_FIELD_VALUE}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{tc('PUB_Examine')}</h1>
        <Button variant="outline" onClick={() => router.back()}>
          {tc('PUB_GoBack')}
        </Button>
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b p-4 text-base font-semibold">{t('sp_access_0052')}</div>
        <dl className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="mb-1 text-sm text-muted-foreground">{t('sp_access_0000')}</dt>
            <dd className="text-sm font-medium">{detail.spName || EMPTY_FIELD_VALUE}</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm text-muted-foreground">{t('sp_access_0039')}</dt>
            <dd className="text-sm font-medium">{detail.contactName || EMPTY_FIELD_VALUE}</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm text-muted-foreground">{t('PUB_Email')}</dt>
            <dd className="text-sm font-medium">{detail.email || EMPTY_FIELD_VALUE}</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm text-muted-foreground">{t('PUB_Phone')}</dt>
            <dd className="text-sm font-medium">{detail.phone || EMPTY_FIELD_VALUE}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="mb-1 text-sm text-muted-foreground">{t('sp_access_0040')}</dt>
            <dd className="text-sm font-medium">{detail.spDesc || EMPTY_FIELD_VALUE}</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm text-muted-foreground">{t('sp_access_0041')}</dt>
            <dd className="text-sm font-medium">
              {licenseSrc ? (
                // 上游 antd Image w-80 h-44 预览(审批页为 base64 图片,非下载)
                <img
                  src={licenseSrc}
                  alt={t('sp_access_0041')}
                  className="h-44 w-80 rounded border object-cover"
                />
              ) : (
                EMPTY_FIELD_VALUE
              )}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm text-muted-foreground">{t('PUB_Status')}</dt>
            <dd className="text-sm font-medium">
              {Number.isFinite(Number(detail.state))
                ? t(`authorized_status_${Number(detail.state)}`)
                : EMPTY_FIELD_VALUE}
            </dd>
          </div>
          <div>
            <dt className="mb-1 text-sm text-muted-foreground">{t('PUB_Creater')}</dt>
            <dd className="text-sm font-medium">{detail.createUser || EMPTY_FIELD_VALUE}</dd>
          </div>
          <div>
            <dt className="mb-1 text-sm text-muted-foreground">{t('PUB_CreateTime')}</dt>
            <dd className="text-sm font-medium">
              {detail.createTime ? formatTimestamp(detail.createTime) : EMPTY_FIELD_VALUE}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b p-4 text-base font-semibold">{t('sp_access_0107')}</div>
        <div className="grid gap-4 p-4 md:grid-cols-2">
          {(detail.tdList ?? []).map((token, index) => (
            <TokenPermissionCard key={token.tdId ?? index} token={token} />
          ))}
          {(detail.tdList ?? []).length === 0 ? (
            <div className="text-sm text-muted-foreground">{EMPTY_FIELD_VALUE}</div>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <div className="mb-4 text-base font-semibold">{tc('PUB_Examine')}</div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>{tc('PUB_Examine')}</Label>
            <RadioGroup
              value={auditState}
              onValueChange={(value) => setAuditState(String(value))}
              className="flex items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="3" id="audit-approve" />
                <Label htmlFor="audit-approve" className="font-normal">
                  {tc('PUB_Approve')}
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="2" id="audit-reject" />
                <Label htmlFor="audit-reject" className="font-normal">
                  {tc('PUB_Reject')}
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="audit-remarks">{tc('PUB_Comment')}</Label>
            <Textarea
              id="audit-remarks"
              rows={4}
              value={remarks}
              onChange={(event) => {
                setRemarks(event.target.value);
                if (remarksError) setRemarksError(null);
              }}
              aria-invalid={remarksError ? true : undefined}
            />
            {remarksError ? <p className="text-sm text-destructive">{remarksError}</p> : null}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={auditPending}>
              {tc('PUB_Submit')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
