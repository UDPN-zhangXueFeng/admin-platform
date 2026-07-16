/**
 * Chart of Accounts 详情页数据转换（COA 树部分）。
 *
 * 1:1 迁移自源项目 `td-manage` 的 `view/utils.ts`，仅做一项适配：每个生成的
 * `CoaRow` 注入 `id = key` 以满足 shared DataTable 的 `{ id: string }` 契约。
 * Trial Balance / Operation Records 的转换不在用户范围内，未迁移。
 */
import { ACTIVE_STATUS_CODES } from '@myorg/modules/chart-of-accounts/util';
import type {
  BookAccountSaveReqVO,
  CoaAction,
  CoaDraftAccount,
  CoaRow,
  CoaStatus,
  CoaTreeNodeResp,
} from './chart-of-accounts-detail.model';

/** 安全转 number；`undefined`/`null`/非有限值返回 `undefined`。 */
export function toSafeNumber(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

/** 类型值（1/2 或字符串）→ assets/liabilities。 */
export function getAccountTypeByValue(
  type?: number | string,
  fallbackType?: string
): 'assets' | 'liabilities' | undefined {
  const numericType = toSafeNumber(type);
  if (numericType === 1) return 'assets';
  if (numericType === 2) return 'liabilities';

  const normalizedType = String(type || fallbackType || '')
    .trim()
    .toLowerCase();
  if (['assets', 'asset', 'as', 'a'].includes(normalizedType)) {
    return 'assets';
  }
  if (['liabilities', 'liability', 'lb', 'l'].includes(normalizedType)) {
    return 'liabilities';
  }

  return undefined;
}

export function getAccountTypeValue(
  accountType?: 'assets' | 'liabilities'
): number | undefined {
  if (accountType === 'assets') return 1;
  if (accountType === 'liabilities') return 2;
  return undefined;
}

export function getDirectionValue(
  accountType?: 'assets' | 'liabilities'
): number | undefined {
  if (accountType === 'assets') return 1;
  if (accountType === 'liabilities') return 2;
  return undefined;
}

export function getBalanceSideByDirectionValue(
  direction?: number | string,
  accountType?: 'assets' | 'liabilities'
): string {
  const numericDirection = toSafeNumber(direction);
  if (numericDirection === 1) return 'Dr';
  if (numericDirection === 2) return 'Cr';

  if (accountType === 'assets') return 'Dr';
  if (accountType === 'liabilities') return 'Cr';
  return '';
}

/** 后端状态码 → active/inactive（兼容 20/30 与 1/0）。 */
export function resolveCoaStatus(
  status?: number | string
): 'active' | 'inactive' {
  const numericStatus = toSafeNumber(status);
  if (numericStatus !== undefined) {
    return ACTIVE_STATUS_CODES.has(numericStatus) ? 'active' : 'inactive';
  }

  return 'active';
}

/** 从后端 payload（数组 / {rows|list|data}）提取 COA 树节点。 */
export function extractCoaTreeNodes(payload: unknown): CoaTreeNodeResp[] {
  if (Array.isArray(payload)) {
    return payload as CoaTreeNodeResp[];
  }

  if (payload && typeof payload === 'object') {
    const normalizedPayload = payload as {
      rows?: CoaTreeNodeResp[];
      list?: CoaTreeNodeResp[];
      data?: CoaTreeNodeResp[];
    };

    if (Array.isArray(normalizedPayload.rows)) {
      return normalizedPayload.rows;
    }
    if (Array.isArray(normalizedPayload.list)) {
      return normalizedPayload.list;
    }
    if (Array.isArray(normalizedPayload.data)) {
      return normalizedPayload.data;
    }
  }

  return [];
}

/** 根据状态 / 层级计算行可用操作。 */
function getCoaRowActions(
  status: CoaStatus,
  level?: number,
  isNewPostingDraft = false
): CoaAction[] {
  if (status === 'pending-submit') {
    return ['edit'];
  }

  const canAddSubAccount = (level ?? 0) < 2 && !isNewPostingDraft;
  const toggleAction: CoaAction = status === 'inactive' ? 'activate' : 'deactivate';

  return [
    ...(canAddSubAccount ? (['new-sub-account'] as const) : []),
    'edit',
    toggleAction,
  ];
}

/**
 * COA 树节点 → 扁平行（按 assets / liabilities 分段，section + items）。
 * 递归扁平化 children，depth 表示层级。
 */
export function buildCoaRowsFromTree(
  treeNodes: CoaTreeNodeResp[] = []
): CoaRow[] {
  type FlattenNode = { node: CoaTreeNodeResp; depth: number };
  const flattenNodes = (nodes: CoaTreeNodeResp[], depth = 0): FlattenNode[] =>
    nodes.flatMap((node) => [
      { node, depth },
      ...(node.children?.length ? flattenNodes(node.children, depth + 1) : []),
    ]);

  const flattened = flattenNodes(treeNodes);
  const sectionSequence: Array<'assets' | 'liabilities'> = [
    'assets',
    'liabilities',
  ];

  return sectionSequence.flatMap((sectionType) => {
    const nodesBySection = flattened.filter(
      ({ node }) =>
        getAccountTypeByValue(
          node.type,
          node.sectionType || node.accountType
        ) === sectionType
    );

    if (!nodesBySection.length) {
      return [];
    }

    const sectionKey = `section-${sectionType}`;
    const sectionRow: CoaRow = {
      id: sectionKey,
      key: sectionKey,
      rowType: 'section',
      sectionType,
      actions: ['new-primary-account'],
    };

    const itemRows: CoaRow[] = nodesBySection.map(({ node, depth }) => {
      const accountType = getAccountTypeByValue(
        node.type,
        node.sectionType || node.accountType
      );
      const status = resolveCoaStatus(node.status);
      const directionValue = toSafeNumber(node.direction);
      const typeValue = toSafeNumber(node.type);
      const rowKey = `book-account-${node.bookAccountId || node.accountCode || depth}`;

      return {
        id: rowKey,
        key: rowKey,
        rowType: 'item',
        sectionType,
        accountType,
        financeBookId: node.financeBookId,
        bookAccountId: node.bookAccountId,
        parentCode: node.parentCode,
        level: node.level,
        typeValue,
        directionValue,
        depth,
        accountCode: node.accountCode || '--',
        accountName: node.accountName || '--',
        description: node.remarks?.trim() || '--',
        balanceSide: getBalanceSideByDirectionValue(directionValue, accountType),
        allowPosting:
          typeof node.allowPosting === 'boolean'
            ? node.allowPosting
            : toSafeNumber(node.allowPosting) === 1,
        suspenseAccount:
          typeof node.suspenseAccount === 'boolean'
            ? node.suspenseAccount
            : toSafeNumber(node.suspenseAccount) === 1,
        status,
        actions: getCoaRowActions(status, depth),
      };
    });

    return [sectionRow, ...itemRows];
  });
}

/** 草稿账户的稳定 key。 */
export function getCoaDraftKey(payload: BookAccountSaveReqVO): string {
  return payload.bookAccountId
    ? `book-account-${payload.bookAccountId}`
    : `account-code-${payload.accountCode}`;
}

/** 草稿账户 → 保存请求 payload（去掉 draft 元字段）。 */
export function toCoaSavePayload(
  draftAccount: CoaDraftAccount
): BookAccountSaveReqVO {
  const payload: BookAccountSaveReqVO = {
    financeBookId: draftAccount.financeBookId,
    accountCode: draftAccount.accountCode,
    accountName: draftAccount.accountName,
    parentCode: draftAccount.parentCode,
    level: draftAccount.level,
    type: draftAccount.type,
    direction: draftAccount.direction,
    allowPosting: draftAccount.allowPosting,
    suspenseAccount: draftAccount.suspenseAccount,
    remarks: draftAccount.remarks,
  };

  if (draftAccount.bookAccountId) {
    payload.bookAccountId = draftAccount.bookAccountId;
  }

  return payload;
}

/**
 * 将草稿账户应用到 COA 行（编辑就地更新；新增插入到对应 section / 父账户之后）。
 * 新增子账户时，父账户自动取消 allowPosting（源项目逻辑）。
 */
export function applyCoaDraftAccounts(
  rows: CoaRow[],
  draftAccounts: CoaDraftAccount[]
): CoaRow[] {
  if (!draftAccounts.length) {
    return rows;
  }

  return draftAccounts.reduce<CoaRow[]>((currentRows, draftAccount) => {
    if (draftAccount.draftType === 'edit') {
      return currentRows.map((row) => {
        const isTargetById =
          draftAccount.bookAccountId &&
          row.bookAccountId === draftAccount.bookAccountId;
        const isTargetByCode =
          !draftAccount.bookAccountId &&
          row.accountCode === draftAccount.accountCode;

        if (row.rowType !== 'item' || (!isTargetById && !isTargetByCode)) {
          return row;
        }

        return {
          ...row,
          accountCode: draftAccount.accountCode,
          accountName: draftAccount.accountName,
          description: draftAccount.remarks?.trim() || '--',
          allowPosting: draftAccount.allowPosting === 1,
          suspenseAccount: draftAccount.suspenseAccount === 1,
          typeValue: draftAccount.type,
          directionValue: draftAccount.direction,
          status: 'pending-submit',
          balanceSide: getBalanceSideByDirectionValue(
            draftAccount.direction,
            row.accountType
          ),
        };
      });
    }

    const existedIndex = currentRows.findIndex(
      (row) => row.rowType === 'item' && row.accountCode === draftAccount.accountCode
    );
    const parentIndex = currentRows.findIndex(
      (row) => row.rowType === 'item' && row.accountCode === draftAccount.parentCode
    );

    if (draftAccount.draftType === 'new-primary-account') {
      const sectionType = getAccountTypeByValue(draftAccount.type);
      const sectionIndex = currentRows.findIndex(
        (row) => row.rowType === 'section' && row.sectionType === sectionType
      );

      if (sectionIndex === -1) {
        return currentRows;
      }

      const draftKey = `draft-${draftAccount.accountCode}`;
      const draftRow: CoaRow = {
        id: draftKey,
        key: draftKey,
        rowType: 'item',
        sectionType,
        accountType: sectionType,
        financeBookId: draftAccount.financeBookId,
        parentCode: draftAccount.parentCode,
        level: draftAccount.level,
        typeValue: draftAccount.type,
        directionValue: draftAccount.direction,
        depth: 0,
        accountCode: draftAccount.accountCode,
        accountName: draftAccount.accountName,
        description: draftAccount.remarks?.trim() || '--',
        balanceSide: getBalanceSideByDirectionValue(
          draftAccount.direction,
          sectionType
        ),
        allowPosting: draftAccount.allowPosting === 1,
        suspenseAccount: draftAccount.suspenseAccount === 1,
        status: 'pending-submit',
        actions: getCoaRowActions(
          'pending-submit',
          draftAccount.level,
          draftAccount.allowPosting === 1
        ),
      };

      if (existedIndex !== -1) {
        return currentRows.map((row, index) =>
          index === existedIndex ? { ...draftRow, key: row.key, id: row.key } : row
        );
      }

      const insertIndex = currentRows.findIndex((row, index) => {
        if (index <= sectionIndex) return false;
        return row.rowType === 'section';
      });
      const targetIndex = insertIndex === -1 ? currentRows.length : insertIndex;

      return [
        ...currentRows.slice(0, targetIndex),
        draftRow,
        ...currentRows.slice(targetIndex),
      ];
    }

    if (parentIndex === -1) {
      return currentRows;
    }

    const parentRow = currentRows[parentIndex];
    const accountType =
      parentRow.accountType || getAccountTypeByValue(draftAccount.type);
    const draftKey = `draft-${draftAccount.accountCode}`;
    const draftRow: CoaRow = {
      id: draftKey,
      key: draftKey,
      rowType: 'item',
      sectionType: parentRow.sectionType,
      accountType,
      financeBookId: draftAccount.financeBookId,
      parentCode: draftAccount.parentCode,
      level: draftAccount.level,
      typeValue: draftAccount.type,
      directionValue: draftAccount.direction,
      depth: (parentRow.depth || 0) + 1,
      accountCode: draftAccount.accountCode,
      accountName: draftAccount.accountName,
      description: draftAccount.remarks?.trim() || '--',
      balanceSide: getBalanceSideByDirectionValue(draftAccount.direction, accountType),
      allowPosting: draftAccount.allowPosting === 1,
      suspenseAccount: draftAccount.suspenseAccount === 1,
      status: 'pending-submit',
      actions: getCoaRowActions(
        'pending-submit',
        draftAccount.level,
        draftAccount.allowPosting === 1
      ),
    };

    if (existedIndex !== -1) {
      return currentRows.map((row, index) =>
        index === existedIndex ? { ...draftRow, key: row.key, id: row.key } : row
      );
    }

    const parentDepth = parentRow.depth || 0;
    const insertIndex = currentRows.findIndex((row, index) => {
      if (index <= parentIndex) return false;
      if (row.rowType === 'section') return true;
      return (row.depth || 0) <= parentDepth;
    });
    const targetIndex = insertIndex === -1 ? currentRows.length : insertIndex;

    // 新增子账户时，父账户不再允许过账
    const rowsWithUpdatedParent = currentRows.map((row, index) => {
      if (index === parentIndex && row.allowPosting !== false) {
        return { ...row, allowPosting: false };
      }
      return row;
    });

    return [
      ...rowsWithUpdatedParent.slice(0, targetIndex),
      draftRow,
      ...rowsWithUpdatedParent.slice(targetIndex),
    ];
  }, rows);
}
