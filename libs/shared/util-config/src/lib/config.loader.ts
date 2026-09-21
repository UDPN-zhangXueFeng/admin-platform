import type { ProjectConfig } from './config.types';
import { ProjectConfigSchema } from './config.schema';
import { mergeWithDefaults } from './config.defaults';

/**
 * Load a project config by ID.
 *
 * Resolution order for `projectId`:
 *   1. Explicit argument
 *   2. env var NX_PROJECT_ID
 *   3. fallback "ecommerce"
 *
 * The function dynamically imports `configs/{id}.json`, validates it
 * against the Zod schema, and merges defaults for any missing fields.
 */
export async function loadProjectConfig(projectId?: string): Promise<ProjectConfig> {
  const id = projectId || process.env['NX_PROJECT_ID'] || 'stablecoin';

  // Use a switch with explicit imports so bundlers can resolve the JSON files.
  // This avoids dynamic template-literal imports that Turbopack cannot trace.
  let raw: unknown;
  switch (id) {
    case 'ecommerce':
      raw = (await import('../../../../../configs/ecommerce.json')) as unknown;
      break;
    case 'crm':
      raw = (await import('../../../../../configs/crm.json')) as unknown;
      break;
    case 'hospital':
      raw = (await import('../../../../../configs/hospital.json')) as unknown;
      break;
    case 'education':
      raw = (await import('../../../../../configs/education.json')) as unknown;
      break;
    case 'stablecoin':
      raw = (await import('../../../../../configs/stablecoin.json')) as unknown;
      break;
    case 'kissen-admin':
      raw = (await import('../../../../../configs/kissen-admin.json')) as unknown;
      break;
    case 'kissen-gateway':
      raw = (await import('../../../../../configs/kissen-gateway.json')) as unknown;
      break;
    case 'lp-portal':
      raw = (await import('../../../../../configs/lp-portal.json')) as unknown;
      break;
    default:
      raw = (await import('../../../../../configs/ecommerce.json')) as unknown;
  }

  // JSON files are imported as ES modules with a `default` export in some bundlers
  const config = (raw as Record<string, unknown>).default ?? raw;

  // Validate then merge defaults
  const validated = ProjectConfigSchema.parse(config);
  return mergeWithDefaults(validated) as ProjectConfig;
}

/**
 * Return the list of available project IDs by scanning known config files.
 * This is synchronous and hardcoded to avoid filesystem access on the client.
 */
export function getAvailableProjects(): string[] {
  return ['ecommerce', 'crm', 'hospital', 'education', 'stablecoin', 'kissen-admin', 'kissen-gateway', 'lp-portal'];
}
