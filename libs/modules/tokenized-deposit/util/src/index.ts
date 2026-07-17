// tokenized-deposit util barrel.
//
// 命名空间路径：@myorg/modules/tokenized-deposit/util

export {
  DEFAULT_PAGE_SIZE,
  EMPTY_DISPLAY,
  RECON_DISABLED,
  RECON_ENABLED,
  MINT_METHOD,
  PLEDGE_TYPE,
  APPLY_STATUS,
  TD_STATE,
  TD_PERMISSIONS,
  TASK_STATUS_COLOR_KEY_PREFIX,
  TASK_STATUS_LABEL_KEY_PREFIX,
  SMART_CONTRACT_STATUS_COLOR_KEY_PREFIX,
  SMART_CONTRACT_STATUS_LABEL_KEY_PREFIX,
  RECORD_TYPE_KEY_PREFIX,
  OPERATION_RECORD_TYPE_KEY_PREFIX,
  ORDER_TYPE_KEY_PREFIX,
  TOKEN_TYPE_KEY_PREFIX,
  ADMIN_WALLET_TYPE_KEY_PREFIX,
  STEP_STATUS_KEY_PREFIX,
  ROLE_WALLET_STATUS_KEY_PREFIX,
  REVIEW_SUBMIT_STATE_KEY_PREFIX,
  STEP_STATUS_COLOR,
  STEP_STATUS_DEFAULT_COLOR,
  TD_STATE_ICON_COLOR,
  FUND_TYPE_MAP,
  RISK_LEVEL_MAP,
  COA_STATUS_STYLE,
  FINANCIAL_BOOK_NAME_PATTERN,
  FINANCIAL_BOOK_NAME_MAX_LENGTH,
  FINANCIAL_BOOK_NAME_RULE_MESSAGE,
  WALLET_ATTRIBUTE_TYPE,
  WALLET_ROLE,
} from './lib/tokenized-deposit.constants';

export { getEncryptionData } from './lib/get-encryption-data';

export {
  REQUIRED_COA_SETUP_FIELDS,
  setupRequiredCoaSetupMock,
  getCoaTemplateTokenType,
  mapFinanceBookToCoaSetup,
  mapDetailToCoaSetup,
  withDefaultAccountTemplate,
  resolveCoaSetupTimeZone,
  normalizeCoaSetupTimeZone,
  mapCoaSetupToPayload,
  getCoaSetupFieldError,
  validateCoaSetup,
  hasCoaSetupErrors,
  getNextCoaSetupErrors,
} from './lib/coa-setup-utils';

export {
  saveDraft,
  loadDraft,
  clearDraft,
  formatDraftTime,
  draftKey,
} from './lib/onboard-draft';
export type {
  OnboardDraft,
  OnboardDraftFormValues,
  OnboardDraftCoaInfo,
  OnboardDraftCoaValues,
  DraftScope,
} from './lib/onboard-draft';
