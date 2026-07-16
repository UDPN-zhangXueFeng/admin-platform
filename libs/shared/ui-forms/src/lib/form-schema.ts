import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver, FieldValues } from 'react-hook-form';
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
export function createFormResolver<TSchema extends z.Schema>(
  schema: TSchema
): Resolver<FieldValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod v4 + RHF resolver type incompatibility requires a broad cast
  return zodResolver(schema as any) as Resolver<FieldValues>;
}
