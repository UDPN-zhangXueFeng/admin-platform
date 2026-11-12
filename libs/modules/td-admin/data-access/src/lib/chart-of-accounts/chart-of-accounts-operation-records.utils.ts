/**
 * Chart of Accounts 详情页 Operation Records 数据转换。
 *
 * 1:1 迁移自源项目 `td-manage` 的 `view/utils.ts`（操作类型映射 /
 * `buildOperationRecordRow` / 请求体拼装），并注入 `id = key` 以满足
 * shared DataTable 的 `{ id: string }` 契约。
 */
import { normalizeTextValue } from './chart-of-accounts.constants';
import { formatTimestamp, toPositiveNumber } from './chart-of-accounts-eod.utils';
import type {
  OperationFilterState,
  OperationRecordListParams,
  OperationRecordResp,
  OperationRecordRow,
  OperationRecordTypeParam,
  OperationType,
} from './chart-of-accounts-detail.model';

const OPERATION_TYPE_REQUEST_MAP: Record<OperationType, OperationRecordTypeParam> = {
  create: 'Create',
  update: 'Update',
  activate: 'Activate',
  deactivate: 'Deactivate',
};

const OPERATION_TYPE_RESPONSE_MAP: Record<number, OperationType> = {
  1: 'create',
  2: 'update',
  3: 'activate',
  4: 'deactivate',
};

/** 操作类型 → 后端 `recordType` 字符串枚举（Create / Update / Activate / Deactivate）。 */
export function getOperationRecordTypeParam(
  operationType?: OperationType
): OperationRecordTypeParam | undefined {
  return operationType ? OPERATION_TYPE_REQUEST_MAP[operationType] : undefined;
}

/** 后端 `recordType`（1/2/3/4）→ 操作类型。 */
export function resolveOperationTypeByRecordType(
  recordType?: number
): OperationType | undefined {
  if (recordType === undefined || recordType === null) return undefined;
  return OPERATION_TYPE_RESPONSE_MAP[recordType];
}

/** 后端操作记录 → 表格行（createdOn 用 kissen-admin 时间格式）。 */
export function buildOperationRecordRow(
  record: OperationRecordResp
): OperationRecordRow {
  const comments = normalizeTextValue(record.comments) || '--';
  const taskId = toPositiveNumber(record.taskId);
  const busCode =
    normalizeTextValue(record.busCode) || normalizeTextValue(record.businessCode);
  const key = String(
    record.financeBookRecordId ||
      `${record.financeBookId || 'book'}-${record.recordType || 'type'}-${
        record.createTime || 'time'
      }`
  );

  return {
    id: key,
    key,
    operationType: resolveOperationTypeByRecordType(record.recordType),
    createdBy: normalizeTextValue(record.operator) || '--',
    createdOn: formatTimestamp(record.createTime),
    comments,
    status: record.status,
    taskId,
    busCode,
    detailNotes: [comments],
  };
}

/**
 * 已应用筛选 + 分页 → 后端请求参数。
 * 空字符串 / 未选择的筛选项不进入请求（与源 `normalizeTextValue` 一致）。
 */
export function buildOperationRecordListParams(
  filters: OperationFilterState,
  pageNum: number,
  pageSize: number
): OperationRecordListParams {
  const [creationStartDate, creationEndDate] =
    filters.creationDateRange ?? [];

  return {
    recordType: getOperationRecordTypeParam(filters.operationType),
    createdBy: normalizeTextValue(filters.creatorName),
    createTimeStart: creationStartDate,
    createTimeEnd: creationEndDate,
    pageNum,
    pageSize,
  };
}
