/**
 * KeyServiceConfigurationEditPage — edit view.
 * Renders the shared KeyServiceConfigurationForm in `edit` mode
 * (name read-only + mock backfill). See key-service-configuration-form.tsx.
 *
 * Source: td-manage/src/pages/key-management/key-service-configuration/edit.tsx
 */

'use client';

import { KeyServiceConfigurationForm } from './key-service-configuration-form';

export function KeyServiceConfigurationEditPage() {
  return <KeyServiceConfigurationForm mode="edit" />;
}
