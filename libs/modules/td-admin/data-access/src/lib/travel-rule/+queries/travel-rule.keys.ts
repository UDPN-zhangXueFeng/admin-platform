import type { TravelRuleQueryParams } from '../travel-rule.model';

/**
 * TanStack Query key factory for the travel-rule module.
 *
 * Every key includes `projectId` so switching projects automatically isolates
 * the cached server-state. Always use these helpers instead of inline string
 * arrays.
 *
 * Travel Rule is a list-only view (no detail/create), so only list keys exist.
 */
export const travelRuleKeys = {
  /** Root key for all travel-rule queries within a project. */
  all: (projectId: string) => ['project', projectId, 'travel-rule'] as const,

  /** Key prefix for all list queries. */
  lists: (projectId: string) => [...travelRuleKeys.all(projectId), 'list'] as const,

  /** Key for a specific filtered / paginated list. */
  list: (projectId: string, params: TravelRuleQueryParams) =>
    [...travelRuleKeys.lists(projectId), params] as const,
} as const;
