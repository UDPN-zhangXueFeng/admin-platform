export interface ExportTask extends Record<string, unknown> { spId: number; moduleType: number; fileId: string; fileHash?: string; exportTime: string; exportUserName?: string; exportState: number; busId: string; busType: string; }
export interface ExportListResponse { page?: { total: number }; rows: ExportTask[]; }
