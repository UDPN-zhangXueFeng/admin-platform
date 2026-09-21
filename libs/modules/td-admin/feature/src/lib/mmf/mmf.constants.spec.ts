/**
 * mmf 常量与状态映射单测。
 *
 * 覆盖验收（mmf.md 第9章）：
 *   - 状态色映射：ACCRUAL(3) / SETTLEMENT(6) / SETTLEMENT_WALLET_RECORD(4)
 *     每个状态码映射到与源码一致的 tone（orange/processing/success/error）。
 *   - 5 个 limit 权限码（MMF_PERMISSIONS）非空且互不重复（控制按钮可见性）。
 *   - BADGE_VARIANT_MAP：antd 色名 → Badge variant 映射。
 *   - statusToneClass：未知 tone 回落 default。
 *
 * 纯函数 + 静态查表，无需 React / jest-dom。
 */
import {
  ACCRUAL_STATUS_COLOR,
  ACCRUAL_STATUS_OPTIONS,
  BADGE_VARIANT_MAP,
  MMF_PERMISSIONS,
  SETTLEMENT_STATUS_COLOR,
  SETTLEMENT_STATUS_OPTIONS,
  SETTLEMENT_WALLET_RECORD_STATUS_COLOR,
  SETTLEMENT_WALLET_RECORD_STATUS_OPTIONS,
  statusToneClass,
} from './mmf.constants';

describe('mmf status colour mappings', () => {
  it('maps the 3 accrual status codes to their source tones', () => {
    expect(ACCRUAL_STATUS_COLOR[5]).toBe('orange');
    expect(ACCRUAL_STATUS_COLOR[10]).toBe('processing');
    expect(ACCRUAL_STATUS_COLOR[35]).toBe('success');
  });

  it('maps the 6 settlement status codes to their source tones', () => {
    expect(SETTLEMENT_STATUS_COLOR[5]).toBe('orange');
    expect(SETTLEMENT_STATUS_COLOR[10]).toBe('processing');
    expect(SETTLEMENT_STATUS_COLOR[15]).toBe('error');
    expect(SETTLEMENT_STATUS_COLOR[20]).toBe('processing');
    expect(SETTLEMENT_STATUS_COLOR[35]).toBe('success');
    expect(SETTLEMENT_STATUS_COLOR[40]).toBe('error');
  });

  it('maps the 4 settlement wallet-record status codes to their source tones', () => {
    expect(SETTLEMENT_WALLET_RECORD_STATUS_COLOR[20]).toBe('orange');
    expect(SETTLEMENT_WALLET_RECORD_STATUS_COLOR[30]).toBe('processing');
    expect(SETTLEMENT_WALLET_RECORD_STATUS_COLOR[35]).toBe('success');
    expect(SETTLEMENT_WALLET_RECORD_STATUS_COLOR[40]).toBe('error');
  });

  it('keeps the status option lists in sync with each colour map (no orphan keys)', () => {
    // 每个 options 的 value 必须能在对应 COLOR map 中找到色值，
    // 否则筛选下拉会出现一个无法渲染 Badge 的状态。
    for (const opt of ACCRUAL_STATUS_OPTIONS) {
      expect(ACCRUAL_STATUS_COLOR[opt.value]).toBeDefined();
    }
    for (const opt of SETTLEMENT_STATUS_OPTIONS) {
      expect(SETTLEMENT_STATUS_COLOR[opt.value]).toBeDefined();
    }
    for (const opt of SETTLEMENT_WALLET_RECORD_STATUS_OPTIONS) {
      expect(SETTLEMENT_WALLET_RECORD_STATUS_COLOR[opt.value]).toBeDefined();
    }
  });

  it('resolves tones into Badge variants deterministically (migration from antd Tag color)', () => {
    // processing/orange 在源码两处语义不同但都映射到 warning，
    // success→success、error→danger。
    expect(BADGE_VARIANT_MAP['processing']).toBe('warning');
    expect(BADGE_VARIANT_MAP['orange']).toBe('warning');
    expect(BADGE_VARIANT_MAP['success']).toBe('success');
    expect(BADGE_VARIANT_MAP['error']).toBe('danger');
  });
});

describe('statusToneClass', () => {
  it('returns the Tailwind class for a known tone', () => {
    expect(statusToneClass('green')).toContain('bg-green-50');
    expect(statusToneClass('red')).toContain('bg-red-50');
  });

  it('falls back to the default tone class for an unknown tone (no undefined class leak)', () => {
    const cls = statusToneClass('does-not-exist');
    expect(cls).toContain('bg-gray-50');
    expect(statusToneClass('')).toContain('bg-gray-50');
  });
});

describe('MMF_PERMISSIONS (5 limit codes → button visibility)', () => {
  const permissionValues = Object.values(MMF_PERMISSIONS);

  it('exposes exactly the 5 documented permission codes', () => {
    expect(Object.keys(MMF_PERMISSIONS).sort()).toEqual(
      [
        'ACCRUAL_BATCH_APPLY_BTN',
        'ACCRUAL_SINGLE_APPLY_BTN',
        'ACCRUAL_VIEW_BTN',
        'SETTLEMENT_VIEW_BTN',
        'SETTLEMENT_RECORD_VIEW_BTN',
      ].sort(),
    );
  });

  it('every code is a non-empty string (an empty code would leak the button to everyone)', () => {
    for (const code of permissionValues) {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it('all 5 codes are mutually distinct (duplicates would collide the permission check)', () => {
    expect(new Set(permissionValues).size).toBe(permissionValues.length);
  });
});
