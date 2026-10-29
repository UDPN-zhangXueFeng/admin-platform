'use client';

import * as React from 'react';
import { Check, Info } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from '@myorg/shared/ui';

export interface SummaryRow {
  label: string;
  complete: boolean;
}

export interface SummaryAsideProps {
  title: string;
  description: string;
  tokenTypeLabelLabel: string;
  tokenTypeLabel: string;
  rows: SummaryRow[];
  deployNetworkLabelLabel: string;
  deployNetworkLabel: string;
  completeLabel: string;
  requiredLabel: string;
  walletsIncompleteAlert?: { title: string; description: string } | null;
}

/** 右侧 summary 卡片。源: tokenized-deposit-edit/ui/page-shell.tsx 149-262（纯代码搬移）。 */
export function SummaryAside({
  title,
  description,
  tokenTypeLabelLabel,
  tokenTypeLabel,
  rows,
  deployNetworkLabelLabel,
  deployNetworkLabel,
  completeLabel,
  requiredLabel,
  walletsIncompleteAlert,
}: SummaryAsideProps): React.JSX.Element {
  return (
    <aside className="lg:sticky lg:top-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{tokenTypeLabelLabel}</span>
            <span className="text-right font-medium">{tokenTypeLabel}</span>
          </div>
          <Separator />
          <div className="flex flex-col gap-3">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between"
              >
                <span className="text-sm">{row.label}</span>
                {row.complete ? (
                  <Check
                    className="size-4 text-primary"
                    aria-label={completeLabel}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {requiredLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
          <Separator />
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {deployNetworkLabelLabel}
            </span>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary" />
              <span className="font-medium">{deployNetworkLabel}</span>
            </div>
          </div>
          {walletsIncompleteAlert ? (
            <Alert>
              <Info className="size-4" aria-hidden="true" />
              <div className="flex flex-col gap-0.5">
                <AlertTitle>{walletsIncompleteAlert.title}</AlertTitle>
                <AlertDescription>
                  {walletsIncompleteAlert.description}
                </AlertDescription>
              </div>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </aside>
  );
}
