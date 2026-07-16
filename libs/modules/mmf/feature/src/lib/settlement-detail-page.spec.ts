/**
 * Settlement detail page — 审批跳转链接拼接 + i18n 键完整性单测。
 *
 * 覆盖验收（针对 verify 发现的硬伤）：
 *   - buildApprovalViewUrl（抽至 util 的纯函数）：Tab2 审批记录行「查看」跳转
 *     `/approval-manage/view?id=..&busCode=..`，缺失 id/busCode 时回退空串而非 "undefined"
 *     （防止拼出非法 URL）。
 *   - operationType 文案键 status.mmf_settlement_operation_type_* 在 zh+en 存在（缺陷：原落空）。
 *   - 审批状态色 approval_task_status_color_* 与文案 common_task_status_* 在 zh+en 存在（缺陷：原落空）。
 *
 * 设计意图（Rule 9）：这些断言会在「有人删掉 mmf.json 根级审批键 / 改坏跳转拼接」时失败，
 * 即真正守护「审批记录 Tab 的状态色、操作类型、查看链接可用」这一业务诉求。
 *
 * buildApprovalViewUrl 为纯函数；i18n 部分为 JSON 契约断言，无需 React / jest-dom
 *（与 settlement-list-page.spec / mmf.constants.spec 同款）。
 */
import { buildApprovalViewUrl } from '@myorg/modules/mmf/util';
import * as path from 'path';
import * as fs from 'fs';

// 运行时读取真实 i18n 源文件（与 merge-messages.ts 静态 import 同源），
// 用 fs 而非 import 以避开 @nx/enforce-module-boundaries 对跨 lib 相对路径的限制。
const messagesRoot = path.resolve(
  __dirname,
  '../../../../../shared/util-i18n-messages/src/lib',
);
const zhCN = JSON.parse(
  fs.readFileSync(path.join(messagesRoot, 'zh-CN/modules/mmf.json'), 'utf-8'),
);
const enUS = JSON.parse(
  fs.readFileSync(path.join(messagesRoot, 'en-US/modules/mmf.json'), 'utf-8'),
);

/** 断言值非空字符串；失败抛带定位信息的错误（Jest 30 expect 无 message 参数）。 */
function assertNonEmpty(value: unknown, message: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(message);
  }
}

describe('buildApprovalViewUrl (Tab2 approval row → /approval-manage/view)', () => {
  it('builds the source-conformant URL with both query params', () => {
    // 源 settlement/view.tsx：routerPush(`/approval-manage/view?id=${taskId}&busCode=${businessCode}`)
    expect(buildApprovalViewUrl(123, 'DIVIDEND_001')).toBe(
      '/approval-manage/view?id=123&busCode=DIVIDEND_001',
    );
  });

  it('falls back to empty id when taskId is missing (no "undefined" leak)', () => {
    // 后端可能不返回 taskId；拼出 id=undefined 会导致审批页 404。
    expect(buildApprovalViewUrl(undefined, 'DIVIDEND_001')).toBe(
      '/approval-manage/view?id=&busCode=DIVIDEND_001',
    );
    expect(buildApprovalViewUrl(null, 'DIVIDEND_001')).toBe(
      '/approval-manage/view?id=&busCode=DIVIDEND_001',
    );
  });

  it('falls back to empty busCode when businessCode is missing (no "undefined" leak)', () => {
    expect(buildApprovalViewUrl(7, undefined)).toBe(
      '/approval-manage/view?id=7&busCode=',
    );
    expect(buildApprovalViewUrl(7, null)).toBe(
      '/approval-manage/view?id=7&busCode=',
    );
  });

  it('produces an empty-param URL when both are missing', () => {
    expect(buildApprovalViewUrl(undefined, undefined)).toBe(
      '/approval-manage/view?id=&busCode=',
    );
  });
});

describe('settlement-detail-page approval i18n keys (zh-CN + en-US)', () => {
  // 源定义的 approval_task_status_color_* 取值（td-manage en-US/router.json）。
  const APPROVAL_STATES = [1, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45];

  it.each([
    ['zh-CN', zhCN],
    ['en-US', enUS],
  ] as const)(
    'exposes approval_task_status_color_* and common_task_status_* for every source state (%s)',
    (locale, messages) => {
      for (const state of APPROVAL_STATES) {
        const colorKey = `approval_task_status_color_${state}`;
        const labelKey = `common_task_status_${state}`;
        // Jest 30 expect 不接受 message 参数；用断言失败抛带定位信息的错误。
        assertNonEmpty(messages[colorKey], `${locale} missing ${colorKey}`);
        assertNonEmpty(messages[labelKey], `${locale} missing ${labelKey}`);
      }
    },
  );

  it.each([
    ['zh-CN', zhCN],
    ['en-US', enUS],
  ] as const)(
    'exposes the operationType label key under status.* (%s)',
    (locale, messages) => {
      // 源 td-manage en-US/mmf.json：mmf_settlement_operation_type_1 = "Dividend Distribution"
      assertNonEmpty(
        messages.status.mmf_settlement_operation_type_1,
        `${locale} missing status.mmf_settlement_operation_type_1`,
      );
    },
  );

  it('matches the source English approval colour/label values for spot states', () => {
    // 抄源 router.json 准确值，防止翻译漂移。
    expect(enUS.approval_task_status_color_5).toBe('orange');
    expect(enUS.approval_task_status_color_20).toBe('success');
    expect(enUS.approval_task_status_color_40).toBe('error');
    expect(enUS.common_task_status_5).toBe('Pending Approval');
    expect(enUS.common_task_status_20).toBe('Approved');
    expect(enUS.status.mmf_settlement_operation_type_1).toBe(
      'Dividend Distribution',
    );
  });
});
