/**
 * KeyServiceConfigurationConfigurePage — create (configure) view.
 * Renders the shared KeyServiceConfigurationForm in `configure` mode
 * (name editable + required, hot wallet selected by default).
 *
 * Source: td-manage/src/pages/key-management/key-service-configuration/configure.tsx
 */

'use client';

import { KeyServiceConfigurationForm } from './key-service-configuration-form';

export function KeyServiceConfigurationConfigurePage() {
  return <KeyServiceConfigurationForm mode="configure" />;
}
