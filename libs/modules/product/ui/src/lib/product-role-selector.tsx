'use client';

import * as React from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@myorg/shared/ui';
import type { ProductRole } from '@myorg/modules/product/util';

export interface ProductRoleSelectorProps {
  value: ProductRole;
  onChange: (value: ProductRole) => void;
  disabled?: boolean;
}

const roles: { value: ProductRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

/**
 * Dropdown selector for 商品管理 roles.
 *
 * Wraps the shared Select component and hard-codes the role list
 * so callers don't need to repeat it in every form.
 */
export function ProductRoleSelector({
  value,
  onChange,
  disabled,
}: ProductRoleSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select role" />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r.value} value={r.value}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
