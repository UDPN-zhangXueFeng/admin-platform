/**
 * Blockchain 枚举常量与状态映射。
 *
 * 迁移自 td-manage blockchain（deployment/node/smart-contract）。
 * 状态/类型文案全部走 i18n key 动态拼接（非静态对象字面量）。
 * 权限码控制 8 个按钮可见性。
 */

// ── 通用 ──
export const DEFAULT_PAGE_SIZE = 10;
export const EMPTY_DISPLAY = '--';

/**
 * 下拉「全部」选项值。用非空占位 'all'——Radix Select 禁止 SelectItem value 为空串
 * （空串保留给清空 placeholder）。本项目部分原生 Select（需 per-option disabled，
 * FormSelect 不支持）用 SelectItem，故 ALL_VALUE 必须非空。筛选时 !== ALL_VALUE 判断。
 */
export const ALL_VALUE = 'all';

// ── 节点状态筛选下拉（2 个状态）──
// labelKey 不带模块名前缀：页面用 useTranslations('modules.blockchain')，t(labelKey) 解析为
// modules.blockchain.<key>。带 'blockchain.' 前缀会拼成双重 modules.blockchain.blockchain.xxx。
export const NODE_STATUS_OPTIONS = [
  { value: '1', labelKey: 'node_status_1' },
  { value: '2', labelKey: 'node_status_2' },
];

// ── 部署类型枚举（1/5）──
export const DEPLOYMENT_TYPE_OPTIONS = [
  { value: 1, labelKey: 'type_1' },
  { value: 5, labelKey: 'type_5' },
];

// ── 节点 state 枚举（updateState 接口入参语义）──
export const NODE_STATE = {
  ENABLE: 1,   // 启用
  DISABLE: 2,  // 禁用
  DELETE: 3,   // 删除
} as const;

// ── i18n key 前缀常量（动态拼接用，不带模块名前缀）──
export const NODE_STATUS_COLOR_KEY_PREFIX = 'common_task_status_color_';
export const NODE_STATUS_LABEL_KEY_PREFIX = 'node_status_';
export const TOKEN_TYPE_LABEL_KEY_PREFIX = 'token_type_';
export const DEPLOYMENT_TYPE_LABEL_KEY_PREFIX = 'type_';
export const CONTRACT_NAME_LABEL_KEY_PREFIX = 'contractName_';

// ── limit 权限码（按钮可见性，8 个）──
export const BLOCKCHAIN_PERMISSIONS = {
  // node 子模块
  NODE_ADD_BTN:      '3b95cac8b3fd4df983ebe31ae3570351',
  NODE_EDIT_BTN:     '1b97b11ad5574b979c4e1d6600972191',
  NODE_DISABLE_BTN:  'be093898366f4beabeb412d581c3ecac',
  NODE_ENABLE_BTN:   'eea4afc3903640d19a0c3d8f9b1e4983',
  NODE_DELETE_BTN:   '046da3258f3648caaf87957df830727f',
  // smart-contract 子模块
  SC_ADD_BTN:        '9b11eb88799b4266a1b34100ec90db2c',
  SC_DOWNLOAD_BTN:   '2e25e8caeda242b4b4b70db7c7541bda',
  // deployment 子模块
  DEPLOYMENT_VIEW_BTN: 'f90a33b77b1e4dd9bad371f14f217958',
} as const;
