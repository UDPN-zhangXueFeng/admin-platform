/**
 * blockchain 常量与动态 i18n key 拼接单测。
 *
 * 覆盖验收（blockchain.md 第9章 / 第6.1节 / 第6.2节）：
 *   - NODE_STATE 枚举（1 启用 / 2 禁用 / 3 删除）—— updateState 接口入参语义。
 *   - NODE_STATUS_OPTIONS / DEPLOYMENT_TYPE_OPTIONS：筛选下拉 value 与 labelKey 一致。
 *   - i18n key 前缀常量（动态拼接用）：node_status / common_task_status_color /
 *     token_type / type / contractName —— 拼接结果命中源码约定。
 *   - 8 个 limit 权限码（BLOCKCHAIN_PERMISSIONS）非空且互不重复（控制按钮可见性）。
 *
 * 纯函数 + 静态查表，无需 React / jest-dom（对齐 mmf.constants.spec 风格）。
 */
import {
  ALL_VALUE,
  BLOCKCHAIN_PERMISSIONS,
  CONTRACT_NAME_LABEL_KEY_PREFIX,
  DEFAULT_PAGE_SIZE,
  DEPLOYMENT_TYPE_LABEL_KEY_PREFIX,
  DEPLOYMENT_TYPE_OPTIONS,
  EMPTY_DISPLAY,
  NODE_STATE,
  NODE_STATUS_COLOR_KEY_PREFIX,
  NODE_STATUS_LABEL_KEY_PREFIX,
  NODE_STATUS_OPTIONS,
  TOKEN_TYPE_LABEL_KEY_PREFIX,
} from './blockchain.constants';

describe('NODE_STATE (updateState 接口入参语义)', () => {
  it('maps ENABLE/DISABLE/DELETE to 1/2/3 (shared updateState endpoint)', () => {
    expect(NODE_STATE.ENABLE).toBe(1);
    expect(NODE_STATE.DISABLE).toBe(2);
    expect(NODE_STATE.DELETE).toBe(3);
  });
});

describe('下拉 options（筛选）', () => {
  it('NODE_STATUS_OPTIONS exposes the 2 source statuses (1 启用 / 2 禁用)', () => {
    expect(NODE_STATUS_OPTIONS).toEqual([
      { value: '1', labelKey: 'blockchain.node_status_1' },
      { value: '2', labelKey: 'blockchain.node_status_2' },
    ]);
  });

  it('DEPLOYMENT_TYPE_OPTIONS exposes the 2 source types (1 / 5)', () => {
    expect(DEPLOYMENT_TYPE_OPTIONS).toEqual([
      { value: 1, labelKey: 'blockchain.type_1' },
      { value: 5, labelKey: 'blockchain.type_5' },
    ]);
  });
});

describe('i18n key 前缀常量（动态拼接）', () => {
  // 验收：状态/类型文案无静态 STATUS_ENUMS 对象，全走 t(`prefix_${n}`) 拼接。
  // 前缀常量是拼接的唯一真源，改前缀即断言失败（守护源码约定）。
  it('builds the node status color key common_task_status_color_${status}', () => {
    expect(`${NODE_STATUS_COLOR_KEY_PREFIX}1`).toBe(
      'blockchain.common_task_status_color_1',
    );
    expect(`${NODE_STATUS_COLOR_KEY_PREFIX}2`).toBe(
      'blockchain.common_task_status_color_2',
    );
  });

  it('builds the node status label key node_status_${status}', () => {
    expect(`${NODE_STATUS_LABEL_KEY_PREFIX}1`).toBe('blockchain.node_status_1');
    expect(`${NODE_STATUS_LABEL_KEY_PREFIX}2`).toBe('blockchain.node_status_2');
  });

  it('builds the tokenType label key token_type_${n}', () => {
    expect(`${TOKEN_TYPE_LABEL_KEY_PREFIX}2`).toBe('blockchain.token_type_2');
  });

  it('builds the deployment type label key type_${n}', () => {
    expect(`${DEPLOYMENT_TYPE_LABEL_KEY_PREFIX}1`).toBe('blockchain.type_1');
    expect(`${DEPLOYMENT_TYPE_LABEL_KEY_PREFIX}5`).toBe('blockchain.type_5');
  });

  it('builds the contract-name label key contractName_${n} (detail page)', () => {
    expect(`${CONTRACT_NAME_LABEL_KEY_PREFIX}1`).toBe(
      'blockchain.contractName_1',
    );
  });
});

describe('通用常量', () => {
  it('ALL_VALUE is the empty string (Select 全部 = 不筛选)', () => {
    expect(ALL_VALUE).toBe('');
  });

  it('DEFAULT_PAGE_SIZE is 10 (DataTable 默认分页)', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(10);
  });

  it('EMPTY_DISPLAY is the dash placeholder', () => {
    expect(EMPTY_DISPLAY).toBe('--');
  });
});

describe('BLOCKCHAIN_PERMISSIONS (8 limit codes → button visibility)', () => {
  const permissionValues = Object.values(BLOCKCHAIN_PERMISSIONS);

  it('exposes exactly the 8 documented permission codes', () => {
    expect(Object.keys(BLOCKCHAIN_PERMISSIONS).sort()).toEqual(
      [
        'NODE_ADD_BTN',
        'NODE_EDIT_BTN',
        'NODE_DISABLE_BTN',
        'NODE_ENABLE_BTN',
        'NODE_DELETE_BTN',
        'SC_ADD_BTN',
        'SC_DOWNLOAD_BTN',
        'DEPLOYMENT_VIEW_BTN',
      ].sort(),
    );
  });

  it('every code is a non-empty string (an empty code would leak the button to everyone)', () => {
    for (const code of permissionValues) {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    }
  });

  it('all 8 codes are mutually distinct (duplicates would collide the permission check)', () => {
    expect(new Set(permissionValues).size).toBe(permissionValues.length);
    expect(permissionValues.length).toBe(8);
  });
});
