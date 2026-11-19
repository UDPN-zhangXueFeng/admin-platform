import { endOfDay, parseISO, startOfDay } from 'date-fns';
import {
  normalizeTextValue,
  resolveStatusCode,
  type ChartOfAccountsListFilters,
  type ChartOfAccountsStatusFilter,
} from '@myorg/modules/td-admin/data-access';

export const ALL_VALUE = 'all';

export interface ChartOfAccountsFilterForm {
  financialBookName?: string;
  bookId?: string;
  reserveAssetName?: string;
  currency?: string;
  tokenType?: string;
  createdOnFrom?: string;
  createdOnTo?: string;
  status?: string;
}

export const EMPTY_FORM: ChartOfAccountsFilterForm = {
  financialBookName: '',
  bookId: '',
  reserveAssetName: '',
  currency: ALL_VALUE,
  tokenType: ALL_VALUE,
  createdOnFrom: '',
  createdOnTo: '',
  status: ALL_VALUE,
};

export function formToFilters(
  form: ChartOfAccountsFilterForm,
  activeStatusCode: number,
  inactiveStatusCode: number
): ChartOfAccountsListFilters {
  const status = form.status === 'active' || form.status === 'inactive'
    ? (form.status satisfies ChartOfAccountsStatusFilter)
    : undefined;

  return {
    bookName: normalizeTextValue(form.financialBookName),
    bookNo: normalizeTextValue(form.bookId),
    reserveAssetName: normalizeTextValue(form.reserveAssetName),
    currencyCode: form.currency && form.currency !== ALL_VALUE ? form.currency : undefined,
    tokenType: form.tokenType && form.tokenType !== ALL_VALUE ? Number(form.tokenType) : undefined,
    status: resolveStatusCode(status, activeStatusCode, inactiveStatusCode),
    createTimeStart: form.createdOnFrom ? startOfDay(parseISO(form.createdOnFrom)).getTime() : undefined,
    createTimeEnd: form.createdOnTo ? endOfDay(parseISO(form.createdOnTo)).getTime() : undefined,
  };
}
