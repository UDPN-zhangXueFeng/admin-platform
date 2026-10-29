'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

/**
 * G3：查询加载失败统一反馈（reserve/contract/keyService/COA template/timezone）。
 * 源: tokenized-deposit-form-content.tsx 658-674（纯代码搬移）。
 */
export function useTdQueryErrorToast(
  reserveQueryError: boolean,
  contractQueryError: boolean,
  keyServiceError: boolean,
  coaQueryError: boolean,
) {
  const t = useTranslations('modules.tokenized-deposit');
  /** G3：查询失败 toast 节流（任一查询失败弹一次，全部恢复后重置）。 */
  const queryErrorToastedRef = React.useRef(false);

  React.useEffect(() => {
    const failed = [
      reserveQueryError,
      contractQueryError,
      keyServiceError,
      coaQueryError,
    ].some(Boolean);
    if (failed) {
      if (!queryErrorToastedRef.current) {
        queryErrorToastedRef.current = true;
        toast.error(t('td_query_load_failed'));
      }
    } else if (queryErrorToastedRef.current) {
      queryErrorToastedRef.current = false;
    }
  }, [reserveQueryError, contractQueryError, keyServiceError, coaQueryError, t]);
}
