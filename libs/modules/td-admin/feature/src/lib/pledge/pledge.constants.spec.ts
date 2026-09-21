/**
 * pledge util 纯函数单测 —— 覆盖第 9 章三个易错点。
 *
 * 1) bookStatus 前端过滤（getBookStatus 推导 + applyBookStatusFilter 过滤/切片/total 重算）
 *    列表页核心难点①：bookStatus 是前端伪状态，后端不存，按 financeBookId 推导。
 *    筛选时拉全量（pageSize=1000）→ 前端 filter → 重算 slice 与 total=filteredRows.length。
 *    断言过滤态 total 用 filteredRows.length（而非后端 rawTotal），否则分页器条数对不上。
 *
 * 2) 状态机行操作（getReserveAssetRowActions）
 *    status 10/15 → [Details]；20 → [..,Deactivate,..]；50 → [..,Activate,..]。
 *    改状态机映射即改此函数，单测守护（按钮可见性真源）。
 *
 * 3) Drawer name→id 映射（buildNameToIdMap）
 *    filter typeof assetTypeId === 'number' + 空 categorieList 兜底返回空 Map。
 *
 * 纯函数 + 静态查表，无需 React / jest-dom（对齐 blockchain.constants.spec 风格）。
 */
import {
  ALL_VALUE,
  applyBookStatusFilter,
  BOOK_STATUS_OPTIONS,
  BOOK_STATUS_PAGE_SIZE,
  buildNameToIdMap,
  getBookStatus,
  getReserveAssetRowActions,
  PLEDGE_PERMISSIONS,
  type BookStatusValue,
} from './pledge.constants';

// ============================================================================
// 1) bookStatus 前端过滤
// ============================================================================

describe('getBookStatus（financeBookId → configured/not_setup 推导）', () => {
  it('returns configured when financeBookId is a truthy number', () => {
    expect(getBookStatus(1001)).toBe('configured');
    expect(getBookStatus(1)).toBe('configured');
  });

  it('returns not_setup when financeBookId is missing/0/empty', () => {
    expect(getBookStatus(undefined)).toBe('not_setup');
    expect(getBookStatus(0)).toBe('not_setup');
    expect(getBookStatus('')).toBe('not_setup');
  });

  it('treats a numeric string financeBookId as configured (truthy)', () => {
    expect(getBookStatus('99')).toBe('configured');
  });
});

describe('applyBookStatusFilter（前端过滤 + 伪分页重算）', () => {
  /** 造 6 行：3 configured / 3 not_setup，financeBookId 有无决定 bookStatus。 */
  const rows: Array<{ id: string; bookStatus: BookStatusValue }> = [
    { id: 'a', bookStatus: 'configured' },
    { id: 'b', bookStatus: 'configured' },
    { id: 'c', bookStatus: 'configured' },
    { id: 'd', bookStatus: 'not_setup' },
    { id: 'e', bookStatus: 'not_setup' },
    { id: 'f', bookStatus: 'not_setup' },
  ];

  it('passes rows through unchanged when bookStatus is ALL_VALUE (no filtering)', () => {
    const res = applyBookStatusFilter(rows, ALL_VALUE, 1, 10, 999);
    expect(res.displayRows).toHaveLength(6);
    // 关键：非过滤态 total 取后端 rawTotal（后端已分页）。
    expect(res.total).toBe(999);
  });

  it('passes rows through unchanged when bookStatus is undefined', () => {
    const res = applyBookStatusFilter(rows, undefined, 1, 10, 42);
    expect(res.displayRows).toHaveLength(6);
    expect(res.total).toBe(42);
  });

  it('filters to configured rows and recompute total = filteredRows.length (not rawTotal)', () => {
    const res = applyBookStatusFilter(rows, 'configured', 1, 10, 1000);
    expect(res.displayRows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    // 关键断言：过滤态 total 必须是过滤后条数 3，而非后端全量 rawTotal 1000。
    expect(res.total).toBe(3);
  });

  it('re-slices the filtered set by pageNum/pageSize (page 2 of configured)', () => {
    const res = applyBookStatusFilter(rows, 'configured', 2, 2, 1000);
    expect(res.displayRows.map((r) => r.id)).toEqual(['c']); // [a,b,c] 切 [2,4) → c
    expect(res.total).toBe(3); // total 仍是过滤后总数
  });

  it('returns empty slice but correct total when page exceeds filtered set', () => {
    const res = applyBookStatusFilter(rows, 'not_setup', 5, 10, 1000);
    expect(res.displayRows).toEqual([]);
    expect(res.total).toBe(3); // 3 个 not_setup，第 5 页无数据但 total 仍为 3
  });

  it('uses the custom getBookStatusValue extractor (decoupled from row shape)', () => {
    // 行结构无 bookStatus 字段，靠 financeBookId 推导（模拟页面 allRows 的来源）。
    const rawRows = [
      { financeBookId: 5 },
      {},
      { financeBookId: 0 },
      { financeBookId: 7 },
    ];
    const res = applyBookStatusFilter(
      rawRows,
      'configured',
      1,
      10,
      100,
      (r) => getBookStatus(r.financeBookId),
    );
    expect(res.displayRows).toHaveLength(2); // financeBookId 5 / 7 → configured
    expect(res.total).toBe(2);
  });

  it('BOOK_STATUS_PAGE_SIZE is 1000 (全量拉取阈值，与源 customFetch 一致)', () => {
    expect(BOOK_STATUS_PAGE_SIZE).toBe(1000);
    expect(BOOK_STATUS_OPTIONS.map((o) => o.value)).toContain('configured');
    expect(BOOK_STATUS_OPTIONS.map((o) => o.value)).toContain('not_setup');
  });
});

// ============================================================================
// 2) 状态机行操作
// ============================================================================

describe('getReserveAssetRowActions（status → 按钮集状态机）', () => {
  it('status 10 (Processing) → only Details (terminal state)', () => {
    expect(getReserveAssetRowActions(10)).toEqual(['Details']);
  });

  it('status 15 (Rejected) → only Details (terminal state)', () => {
    expect(getReserveAssetRowActions(15)).toEqual(['Details']);
  });

  it('status 20 (Active) → Add/Edit/Deactivate/Details/NewTransaction', () => {
    expect(getReserveAssetRowActions(20)).toEqual([
      'AddAssetCategory',
      'Edit',
      'Deactivate',
      'Details',
      'NewTransaction',
    ]);
  });

  it('status 50 (Inactive) → Add/Edit/Activate/Details/NewTransaction', () => {
    expect(getReserveAssetRowActions(50)).toEqual([
      'AddAssetCategory',
      'Edit',
      'Activate',
      'Details',
      'NewTransaction',
    ]);
  });

  it('Active exposes Deactivate but not Activate; Inverse for Inactive', () => {
    expect(getReserveAssetRowActions(20)).toContain('Deactivate');
    expect(getReserveAssetRowActions(20)).not.toContain('Activate');
    expect(getReserveAssetRowActions(50)).toContain('Activate');
    expect(getReserveAssetRowActions(50)).not.toContain('Deactivate');
  });

  it('unknown/undefined status falls back to Details (conservative, never hides detail entry)', () => {
    expect(getReserveAssetRowActions(undefined)).toEqual(['Details']);
    expect(getReserveAssetRowActions(99)).toEqual(['Details']);
    expect(getReserveAssetRowActions(0)).toEqual(['Details']);
  });

  it('returns a stable mapping (same status → same content, deterministic lookup)', () => {
    // 页面靠 .includes(key) 决定按钮可见性，映射必须确定且可重复查表。
    expect([...getReserveAssetRowActions(20)]).toEqual([
      ...getReserveAssetRowActions(20),
    ]);
    expect(getReserveAssetRowActions(20).includes('Deactivate')).toBe(true);
    expect(getReserveAssetRowActions(20).includes('Activate')).toBe(false);
  });
});

// ============================================================================
// 3) Drawer name→id 映射
// ============================================================================

describe('buildNameToIdMap（assetTypeName → assetTypeId 映射）', () => {
  it('maps name→id for valid items (typeof assetTypeId === number)', () => {
    const list = [
      { assetTypeName: 'Cash', assetTypeId: 11 },
      { assetTypeName: 'Bond', assetTypeId: 22 },
    ];
    const map = buildNameToIdMap(list);
    expect(map.get('Cash')).toBe(11);
    expect(map.get('Bond')).toBe(22);
    expect(map.size).toBe(2);
  });

  it('skips items whose assetTypeId is not a number (null/undefined/string)', () => {
    const list = [
      { assetTypeName: 'Valid', assetTypeId: 5 },
      { assetTypeName: 'NoId', assetTypeId: undefined },
      { assetTypeName: 'NullId', assetTypeId: null },
      { assetTypeName: 'StrId', assetTypeId: '99' },
    ];
    const map = buildNameToIdMap(list);
    expect(map.size).toBe(1);
    expect(map.get('Valid')).toBe(5);
    expect(map.has('NoId')).toBe(false);
    expect(map.has('StrId')).toBe(false);
  });

  it('skips items whose assetTypeName is empty/missing', () => {
    const list = [
      { assetTypeName: '', assetTypeId: 1 },
      { assetTypeName: undefined, assetTypeId: 2 },
      { assetTypeName: 'Keep', assetTypeId: 3 },
    ];
    const map = buildNameToIdMap(list);
    expect(map.size).toBe(1);
    expect(map.get('Keep')).toBe(3);
  });

  it('returns an empty Map for undefined/null/empty categorieList (兜底)', () => {
    expect(buildNameToIdMap(undefined).size).toBe(0);
    expect(buildNameToIdMap(null).size).toBe(0);
    expect(buildNameToIdMap([]).size).toBe(0);
  });

  it('supports custom name/id extractors (decoupled from AssetCategory shape)', () => {
    const list = [
      { name: 'Cash', id: 11 },
      { name: 'Bond', id: 22 },
    ];
    const map = buildNameToIdMap(
      list,
      (item) => item.name,
      (item) => item.id,
    );
    expect(map.get('Cash')).toBe(11);
    expect(map.get('Bond')).toBe(22);
  });
});

// ============================================================================
// 权限码（11 挂载 + 1 死代码 txnDrawerDetail 登记）
// ============================================================================

describe('PLEDGE_PERMISSIONS（11 挂载权限码 + 1 死代码登记）', () => {
  const codes = Object.values(PLEDGE_PERMISSIONS);

  it('exposes exactly the 12 documented permission keys (11 active + txnDrawerDetail dead code)', () => {
    expect(Object.keys(PLEDGE_PERMISSIONS).sort()).toEqual(
      [
        'reserveAssetAdd',
        'newTransaction',
        'importTransactions',
        'adjustment',
        'txnDetails',
        'newTransactionRow',
        'reserveAssetEdit',
        'activate',
        'deactivate',
        'reserveAssetDetails',
        'addAssetCategory',
        'txnDrawerDetail',
      ].sort(),
    );
  });

  it('every code is a non-empty md5-style hash (空码会让按钮对所有人可见)', () => {
    for (const code of codes) {
      expect(typeof code).toBe('string');
      expect(code.length).toBe(32); // md5 hex
    }
  });

  it('all 12 codes are mutually distinct (重复码会让权限校验撞车)', () => {
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.length).toBe(12);
  });
});
