import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';
import type { z } from 'zod';

/**
 * Create a react-hook-form resolver from a Zod schema.
 *
 * This thin wrapper around @hookform/resolvers/zod centralizes
 * the resolver creation so consumers don't need to import two packages.
 *
 * @example
 * const schema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * });
 *
 * const methods = useForm({
 *   resolver: createFormResolver(schema),
 * });
 */
export function createFormResolver<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TOutput = TFieldValues,
>(
  schema: z.ZodType<TOutput, TFieldValues>,
): Resolver<TFieldValues, TContext, TOutput> {
  // 泛型镜像 zodResolver 的 zod4 重载（<Input, Context, Output>，zod v4 包中
  // `zod` 入口按 $ZodType 结构匹配该重载），使调用本身类型成立，无需断言；
  // 运行时仅原样转发，zodResolver 内部按 schema 实际 in/out 解析。
  return zodResolver<TFieldValues, TContext, TOutput>(schema);
}
