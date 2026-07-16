/**
 * Shared query-key helpers.
 *
 * Query keys MUST include `projectId` so that switching projects
 * automatically isolates server-state caches. Modules should build
 * their own key factories on top of these primitives.
 */

const PROJECT_PREFIX = 'project' as const;

/**
 * Root key for a project scope.
 *
 * @example
 * projectKey('ecommerce') // ['project', 'ecommerce']
 */
export function projectKey(projectId: string) {
  return [PROJECT_PREFIX, projectId] as const;
}

/**
 * Scoped key under a project for a specific module.
 *
 * @example
 * moduleKey('ecommerce', 'user') // ['project', 'ecommerce', 'user']
 */
export function moduleKey(projectId: string, module: string) {
  return [...projectKey(projectId), module] as const;
}

/**
 * List-scope key for a module.
 *
 * @example
 * listKey('ecommerce', 'user') // ['project', 'ecommerce', 'user', 'list']
 */
export function listKey(projectId: string, module: string) {
  return [...moduleKey(projectId, module), 'list'] as const;
}

/**
 * Detail-scope key for a module.
 *
 * @example
 * detailKey('ecommerce', 'user') // ['project', 'ecommerce', 'user', 'detail']
 */
export function detailKey(projectId: string, module: string) {
  return [...moduleKey(projectId, module), 'detail'] as const;
}

/**
 * Single-item detail key.
 *
 * @example
 * detailItemKey('ecommerce', 'user', '123')
 * // ['project', 'ecommerce', 'user', 'detail', '123']
 */
export function detailItemKey(projectId: string, module: string, id: string) {
  return [...detailKey(projectId, module), id] as const;
}
