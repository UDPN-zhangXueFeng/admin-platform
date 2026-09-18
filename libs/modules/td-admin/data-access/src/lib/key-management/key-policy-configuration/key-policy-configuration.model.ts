/**
 * Key Policy Configuration domain types.
 *
 * Pure mock module — no API endpoints, no TanStack Query.
 * Covers list, edit, detail, and new form values.
 *
 * Note on createdOn (§8.C.1):
 * - PolicyListItem.createdOn is a ms timestamp (number) from index staticData,
 *   intended for formatTimestamp.
 * - PolicyDetail.createdOn is a pre-formatted string from detail keyPolicyData,
 *   displayed as-is without formatTimestamp.
 */

/** A single row in the policy list (index staticData, 22 items). */
export interface PolicyListItem {
  id: number;
  businessName: string;
  description?: string;
  rotationFrequency?: string;
  rotationTime?: string;
  rotationMethods?: string;
  /** ms timestamp — use formatTimestamp for display. */
  createdOn?: number;
  status: string;
}

/**
 * Edit page backfill record (edit staticData, 4 items).
 * Separate from PolicyListItem because the data source differs —
 * rotationFrequency values vary (1 day / 7 days / 1 month vs. all 3 months),
 * and id values skip (1/2/3/5, missing 4).
 */
export interface PolicyEditItem {
  id: number;
  businessName: string;
  description?: string;
  rotationFrequency?: string;
  rotationTime?: string;
  rotationMethods?: string;
  /** Not present in edit staticData; optional for type compatibility. */
  createdOn?: number;
  status?: string;
}

/**
 * Detail page single record (detail keyPolicyData, 1 item).
 * createdOn is a pre-formatted string like "Mar 20, 2024, 11:14:41 (UTC+8)".
 */
export interface PolicyDetail {
  businessName?: string;
  status?: string;
  description?: string;
  rotationFrequency?: string;
  rotationTime?: string;
  rotationMethods?: string;
  createdBy?: string;
  /** Pre-formatted date string — display as-is. */
  createdOn?: string;
  updatedBy?: string;
  updatedOn?: string;
}

/** A single row in the operation records table (detail operationRecordsData, 5 items). */
export interface OperationRecord {
  key: number;
  operationType: string;
  createdBy: string;
  /** Pre-formatted date string. */
  createdOn: string;
  comments: string;
  status: string;
}

/** New / Edit form values. */
export interface PolicyFormValues {
  businessName: string;
  frequencyNumber: number;
  frequencyUnit: string;
  rotationTime: string;
  rotationMethod: string;
}
