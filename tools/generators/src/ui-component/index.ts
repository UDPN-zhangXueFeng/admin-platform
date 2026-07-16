import {
  type Tree,
  type GeneratorCallback,
  formatFiles,
  readProjectConfiguration,
} from '@nx/devkit';
import { join } from 'path';

interface UiComponentGeneratorSchema {
  name: string;
  radix?: string;
}

/**
 * Nx generator that scaffolds a new shared UI component in
 * `libs/shared/ui/src/lib/{name}/` and updates the main barrel.
 *
 * Produces a Radix + Tailwind CSS component following the same
 * patterns as the existing shadcn/ui-inspired components in this
 * repo (forwardRef, cn(), displayName, JSDoc).
 */
export default async function uiComponentGenerator(
  tree: Tree,
  options: UiComponentGeneratorSchema
): Promise<GeneratorCallback> {
  const { name } = options;
  const pascal = toPascal(name);
  const dir = join('libs/shared/ui/src/lib', name);

  // ── 1. Validate target library exists ───────────────────────────────
  try {
    readProjectConfiguration(tree, 'shared-ui');
  } catch {
    throw new Error(
      'Project "shared-ui" not found. Make sure libs/shared/ui/project.json exists.'
    );
  }

  // ── 2. Write component file ─────────────────────────────────────────
  const hasRadix = Boolean(options.radix);
  const radixImport = hasRadix
    ? `import * as ${pascal}Primitive from '${options.radix}';\n`
    : '';
  const rootComp = hasRadix ? `${pascal}Primitive.Root` : 'div';

  tree.write(
    join(dir, `${name}.tsx`),
    `'use client';

import * as React from 'react';
${radixImport}import { cn } from '@myorg/shared/util-classnames';

/* eslint-disable @typescript-eslint/no-empty-object-type */

export interface ${pascal}Props extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional class names */
  className?: string;
}

/**
 * ${pascal} component.
 *
 * ${hasRadix ? `Built on \`${options.radix}\` for accessibility and keyboard interaction.` : 'Styled wrapper with Tailwind CSS.'}
 * Accepts all standard div attributes and forwards refs.
 */
const ${pascal} = React.forwardRef<HTMLDivElement, ${pascal}Props>(
  ({ className, children, ...props }, ref) => (
    <${rootComp}
      ref={ref}
      className={cn(
        'rounded-md border bg-background p-4 text-foreground shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </${rootComp}>
  )
);
${pascal}.displayName = '${pascal}';

export { ${pascal} };
`
  );

  // ── 3. Update barrel file ───────────────────────────────────────────
  const barrelPath = 'libs/shared/ui/src/index.ts';
  const barrelContent = tree.read(barrelPath)?.toString() ?? '';

  const exportLine = `export * from './lib/${name}';`;

  if (barrelContent.includes(exportLine)) {
    // Already registered — nothing to do
  } else {
    const newBarrel = barrelContent.trimEnd() + '\n' + exportLine + '\n';
    tree.write(barrelPath, newBarrel);
  }

  await formatFiles(tree);

  return () => {
    // No install needed — source files only
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function toPascal(str: string): string {
  return str
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}
