export const txFlowKeys = { all: ['transaction-flow'] as const, list: (f: Record<string, unknown>, pg: number) => [...txFlowKeys.all, 'list', f, pg] as const };
