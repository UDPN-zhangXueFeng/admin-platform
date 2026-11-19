'use client';

import { Card } from '@myorg/shared/ui';

export function PostingEventFields({ title, fields, emptyMessage }: {
  title: string;
  fields: string[];
  emptyMessage: string;
}) {
  return (
    <Card>
      <h2 className="border-b px-6 py-3 text-sm font-semibold">{title}</h2>
      <div className="flex flex-wrap gap-2 p-4">
        {fields.length ? fields.map((field, index) => (
          <span key={`${field}-${index}`} className="rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium">{field}</span>
        )) : <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
      </div>
    </Card>
  );
}
