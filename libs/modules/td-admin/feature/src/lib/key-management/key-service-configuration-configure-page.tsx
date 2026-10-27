/**
 * KeyServiceConfigurationConfigurePage — new (configure) service view.
 * Renders KeyServiceConfigurationForm (name editable + required, hot wallet
 * pre-selected). Submission is disabled — the backend exposes no Key-service
 * write API (see form header + in-page banner).
 *
 * Source: td-manage/src/pages/key-management/key-service-configuration/configure.tsx
 */

'use client';

import { KeyServiceConfigurationForm } from './key-service-configuration-form';

export function KeyServiceConfigurationConfigurePage() {
  return <KeyServiceConfigurationForm />;
}
