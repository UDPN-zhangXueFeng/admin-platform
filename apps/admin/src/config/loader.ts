/**
 * App-level config loader — re-exports from the shared config utility.
 *
 * This barrel exists so that app-level code can import from a local path
 * (`@/config/loader`) if needed, while the actual implementation lives
 * in @myorg/shared/util-config.
 */
export { loadProjectConfig, getAvailableProjects } from '@myorg/shared/util-config';
