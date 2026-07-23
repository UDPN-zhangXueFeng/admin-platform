'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

import {
  ApprovalDetailGrid,
  ApprovalStatusBadge,
  type ApprovalDetailSection,
} from '@myorg/modules/approval-manage/ui';
import { downloadFile } from '@myorg/modules/approval-manage/data-access';
import { formatTimestamp } from '@myorg/modules/approval-manage/util';

/**
 * InterestFeeApproval — 利息费用/Posting 审核详情（迁移自 td-manage
 * `src/pages/approval-manage/components/interest-fee.tsx`，146 行）。
 *
 * 只读展示组件（含文件下载交互），接收 `detailInfo`（=approvedDetail.businessContent）。
 *
 * 迁移要点（§7 步骤 9）：
 * - **文件下载 Blob**：复用 data-access `downloadFile`（已封装 sftp/download Blob +
 *   Content-Disposition 文件名解析 + a.click 触发，见 data-access approval-manage.api.ts）。
 * - **Spin→加载态**：源 antd <Spin spinning> 包裹整个详情；迁移改为下载按钮行内加载态
 *   （下载中禁用按钮 + 图标旋转），不遮挡整页（更符合目标库 Skeleton/spinner 模式）。
 * - **message→sonner toast**：源 antd message.success（`PUB_Success` 模板 `****`→`PUB_Download`）
 *   → sonner toast.success（同 statements 模式，§6.4）。
 *
 * **i18n**：扁平 key；动态前缀（interest_list_feeType_）T14 统一补全。
 *
 * **降级（§8）**：downloadFile 内部读 NEXT_PUBLIC_FILE_ID，未配置时 fetch 失败抛错，
 * 此处 try/catch 提示下载不可用（不崩）。
 */

type DetailInfo = Record<string, unknown>;

/** 安全取数值。 */
function toNum(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export interface InterestFeeApprovalProps {
  /** approvedDetail.businessContent（dispatcher 透传，宽松类型）。 */
  detailInfo?: DetailInfo;
}

export function InterestFeeApproval({ detailInfo }: InterestFeeApprovalProps) {
  const t = useTranslations('modules.approval-manage');
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = React.useCallback(() => {
    if (!detailInfo) return;
    setDownloading(true);
    downloadFile({
      busId: String(detailInfo.busId ?? ''),
      busType: String(detailInfo.busType ?? ''),
    })
      .then(() => {
        // 源 message.success(PUB_Success 模板 **** → PUB_Download)，迁移 sonner toast。
        toast.success(
          t('PUB_Success').replace('****', t('PUB_Download')),
        );
      })
      .catch(() => {
        // 降级：下载失败（如 NEXT_PUBLIC_FILE_ID 未配置）提示不可用，不崩。
        toast.error(t('PUB_DownloadFailed'));
      })
      .finally(() => setDownloading(false));
  }, [detailInfo, t]);

  const sections: ApprovalDetailSection[] = React.useMemo(() => {
    if (!detailInfo) return [];

    const feeType = toNum(detailInfo.feeType);
    const status = toNum(detailInfo.status);

    return [
      {
        list: [
          {
            label: t('interest_0018'),
            value: t('PUB_Post'),
          },
        ],
      },
      {
        title: t('interest_0009'),
        list: [
          {
            label: t('interest_0062'),
            value: <span className="font-bold">{String(detailInfo.tokenName ?? '')}</span>,
          },
          { label: t('PUB_Blockchain'), value: String(detailInfo.blockchainName ?? '') },
          {
            label: t('interest_0075'),
            value: (
              <span className="font-bold">
                {`${detailInfo.postRealityCount ?? ''} ${detailInfo.symbol ?? ''}`}
              </span>
            ),
          },
          {
            label: t('interest_0067'),
            value: formatTimestamp(toNum(detailInfo.postTime)),
          },
          {
            label: t('interest_0080'),
            value: (
              <span className="font-bold">
                {feeType !== undefined
                  ? t(`interest_list_feeType_${feeType}` as never)
                  : null}
              </span>
            ),
          },
          {
            label: t('interest_0092'),
            value: (
              <div className="flex cursor-pointer items-center">
                <span className="mr-2">{String(detailInfo.fileName ?? '')}</span>
                <Download
                  onClick={downloading ? undefined : handleDownload}
                  className={`h-5 w-5 cursor-pointer text-theme ${
                    downloading ? 'animate-spin pointer-events-none opacity-50' : ''
                  }`}
                />
              </div>
            ),
            showBorder: true,
          },
          { label: t('PUB_Creater'), value: String(detailInfo.createUserName ?? '') },
          {
            label: t('PUB_CreateTime'),
            value: formatTimestamp(toNum(detailInfo.createTime)),
            showBorder: true,
          },
          {
            label: t('PUB_Status'),
            value: status !== undefined ? <ApprovalStatusBadge family="task" status={status} /> : null,
            showBorder: true,
          },
        ],
      },
    ];
  }, [detailInfo, t, downloading, handleDownload]);

  return <ApprovalDetailGrid sections={sections} />;
}
