/**
 * 节点编辑页动态字段拼装 —— 纯函数（无 React 依赖，可单测）。
 *
 * 迁移自 td-manage src/pages/blockchain/node/edit.tsx 的 onFinish 回扫拼装逻辑
 * （文档步骤 10 / bc-11）。
 *
 * 源码 onFinish 行为：遍历表单 values，跳过 chainName/nodeLocation，
 * 对每个 key 在 filedArrObj 中按 paramKey 匹配，匹配到则回填 paramValue 后推入
 * 结果数组。
 *
 * 这里等价实现：以 filedArrObj 为基准（保证 paramKey/paramName 完整），
 * 用 values[paramKey] 作为 paramValue（动态字段运行时通过 register(paramKey)
 * 注册，因此 values 上的动态键就是 paramKey）。
 *
 * 抽离为纯函数以便覆盖空字段集合 / 多动态字段 / paramValue 缺失回退 '' 边界，
 * 对齐 mmf batch-apply-selection 的抽离模式。
 */
import type {
  NodeEditFormValues,
  NodeParamsDetailField,
} from '@myorg/modules/blockchain/data-access';

/**
 * 由动态字段集合 + 表单值拼装 nodeParamsDetail。
 *
 * @param filedArrObj 当前渲染的动态字段集合（params/search 返回，含 paramKey/paramName）。
 * @param values       react-hook-form 收集的表单值（动态键 = paramKey）。
 * @returns nodeParamsDetail（paramKey/paramName/paramValue 三元组数组）。
 *          paramValue 缺失（undefined/null）回退空串，与页面 `String(values[key] ?? '')` 一致。
 */
export function buildNodeParamsDetail(
  filedArrObj: NodeParamsDetailField[],
  values: NodeEditFormValues,
): NodeParamsDetailField[] {
  return filedArrObj.map((field) => ({
    paramKey: field.paramKey,
    paramName: field.paramName,
    paramValue: String(values[field.paramKey] ?? ''),
  }));
}
