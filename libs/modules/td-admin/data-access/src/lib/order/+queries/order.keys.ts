import type { OrderListParams } from '../order.model';

/**
 * Query key factory for the order module.
 *
 * Every key includes `projectId` so switching projects automatically
 * isolates the TanStack Query cache.
 */
export const orderKeys = {
  /** Base key for all order queries within a project. */
  all: (projectId: string) => ['project', projectId, 'order'] as const,

  /** Key for all list queries. */
  lists: (projectId: string) => [...orderKeys.all(projectId), 'list'] as const,

  /** Key for a specific filtered / paginated list. */
  list: (projectId: string, params: OrderListParams) =>
    [...orderKeys.lists(projectId), params] as const,

  /** Key for all detail queries. */
  details: (projectId: string) => [...orderKeys.all(projectId), 'detail'] as const,

  /** Key for a single order detail. */
  detail: (projectId: string, id: string) =>
    [...orderKeys.details(projectId), id] as const,
} as const;
