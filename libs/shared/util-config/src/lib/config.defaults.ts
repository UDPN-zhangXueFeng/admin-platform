import type { ProjectConfig } from './config.types';
import { ProjectConfigSchema } from './config.schema';

/**
 * The canonical default config.
 * Produced by parsing an empty object through the Zod schema so that
 * defaults stay in exactly one place (config.schema.ts).
 */
export const defaultConfig: ProjectConfig = ProjectConfigSchema.parse({});

/**
 * Deep-merge a partial user config on top of defaults.
 *
 * Strategy:
 *  - Primitives: user value wins over default.
 *  - Arrays:     user value wins (no concatenation).
 *  - Objects:    recurse.
 *
 * The result is then validated through the Zod schema so missing optional
 * fields still get their schema-level defaults.
 */
export function mergeWithDefaults(config: Partial<ProjectConfig>): ProjectConfig {
  const merged = deepMerge(defaultConfig, config);
  return ProjectConfigSchema.parse(merged);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] };

function deepMerge<T extends object>(
  base: T,
  override: DeepPartial<T> | undefined,
): T {
  if (!override) return base;

  const result = { ...base } as Record<string, unknown>;

  for (const key of Object.keys(override)) {
    const baseVal = (base as Record<string, unknown>)[key];
    const overVal = (override as Record<string, unknown>)[key];

    if (
      overVal !== null &&
      overVal !== undefined &&
      typeof overVal === 'object' &&
      !Array.isArray(overVal) &&
      typeof baseVal === 'object' &&
      baseVal !== null &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMerge(
        baseVal as Record<string, unknown>,
        overVal as DeepPartial<Record<string, unknown>>,
      );
    } else if (overVal !== undefined) {
      result[key] = overVal;
    }
  }

  return result as T;
}
