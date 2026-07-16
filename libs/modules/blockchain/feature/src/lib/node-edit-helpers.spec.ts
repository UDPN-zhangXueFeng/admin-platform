/**
 * 节点编辑动态字段拼装单测 —— buildNodeParamsDetail。
 *
 * 验收（blockchain.md 第9章「node 编辑页」/ 第8章「动态字段表单」）：
 *   - 提交时回扫 values 与 filedArrObj 按 paramKey 匹配拼装 nodeParamsDetail。
 *   - 以 filedArrObj 为基准（保证 paramKey/paramName 完整，不丢字段）。
 *   - paramValue 缺失（undefined/null）回退空串。
 *   - 空字段集合 → 空数组。
 *
 * 纯函数 spec（无 React），对齐 mmf batch-apply-selection.spec 风格。
 */
import { buildNodeParamsDetail } from './node-edit-helpers';
import type {
  NodeEditFormValues,
  NodeParamsDetailField,
} from '@myorg/modules/blockchain/data-access';

function field(
  key: string,
  name: string,
): NodeParamsDetailField {
  return { paramKey: key, paramName: name, paramValue: '' };
}

describe('buildNodeParamsDetail', () => {
  it('returns an empty array when there are no dynamic fields', () => {
    expect(buildNodeParamsDetail([], {})).toEqual([]);
  });

  it('maps each dynamic field using the form value keyed by paramKey', () => {
    const fields = [field('rpc', 'RPC URL'), field('ws', 'WebSocket')];
    const values: NodeEditFormValues = {
      chainName: '1',
      nodeLocation: '2',
      rpc: 'http://localhost:8545',
      ws: 'ws://localhost:8546',
    };
    expect(buildNodeParamsDetail(fields, values)).toEqual([
      { paramKey: 'rpc', paramName: 'RPC URL', paramValue: 'http://localhost:8545' },
      { paramKey: 'ws', paramName: 'WebSocket', paramValue: 'ws://localhost:8546' },
    ]);
  });

  it('falls back to empty string when a paramKey has no form value', () => {
    const fields = [field('rpc', 'RPC URL')];
    const values: NodeEditFormValues = { chainName: '1', nodeLocation: '2' };
    // paramValue 缺失（undefined）→ ''，与页面 String(values[key] ?? '') 一致。
    expect(buildNodeParamsDetail(fields, values)).toEqual([
      { paramKey: 'rpc', paramName: 'RPC URL', paramValue: '' },
    ]);
  });

  it('stringifies non-string values (number → string)', () => {
    const fields = [field('port', 'Port')];
    const values: NodeEditFormValues = { port: 8545 };
    expect(buildNodeParamsDetail(fields, values)).toEqual([
      { paramKey: 'port', paramName: 'Port', paramValue: '8545' },
    ]);
  });

  it('treats null as empty string (defensive against backend nulls)', () => {
    const fields = [field('rpc', 'RPC URL')];
    const values = { rpc: null } as unknown as NodeEditFormValues;
    expect(buildNodeParamsDetail(fields, values)).toEqual([
      { paramKey: 'rpc', paramName: 'RPC URL', paramValue: '' },
    ]);
  });

  it('preserves the filedArrObj order (not the values key order)', () => {
    // 实现用 filedArrObj.map，顺序跟随字段集合而非表单填写顺序，
    // 保证提交的 nodeParamsDetail 顺序稳定（后端按数组顺序处理）。
    const fields = [field('b', 'B'), field('a', 'A')];
    const values = { a: '1', b: '2' } as NodeEditFormValues;
    const result = buildNodeParamsDetail(fields, values);
    expect(result.map((r) => r.paramKey)).toEqual(['b', 'a']);
  });

  it('keeps paramName from the field set (never from the form values)', () => {
    // paramName 是 params/search 返回的字段定义，提交时必须原样回传，
    // 不能被表单值覆盖（表单值只有 paramValue）。
    const fields = [field('rpc', 'RPC URL')];
    const values = { rpc: 'http://x', paramName: 'tampered' } as NodeEditFormValues;
    expect(buildNodeParamsDetail(fields, values)[0].paramName).toBe('RPC URL');
  });
});
