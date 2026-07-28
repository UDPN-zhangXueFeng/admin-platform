export const dataExportKeys = { all: ['data-export'] as const, list: (pg: number) => [...dataExportKeys.all, 'list', pg] as const };
