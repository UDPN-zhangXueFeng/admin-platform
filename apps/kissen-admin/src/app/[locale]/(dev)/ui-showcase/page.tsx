'use client';

import * as React from 'react';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Label,
  PasswordField,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from '@myorg/shared/ui';
import type { ColumnDef } from '@tanstack/react-table';

/**
 * P2 组件精修展示页（等价 Storybook 载体，执行方案 §4 P2「或等价展示页」）。
 * 仅开发构建可达；生产构建直接 notFound。
 * 暗色档通过根节点 .dark 类切换（不依赖 app 主题机制，任何 app 可复用本页结构）。
 */

interface Row {
  id: string;
  name: string;
  pair: string;
  amount: string;
  status: 'success' | 'warning' | 'info' | 'destructive';
}

const ROWS: Row[] = [
  { id: '1', name: 'Clearing batch #1042', pair: 'USDT/CNY', amount: '1,240,500.00', status: 'success' },
  { id: '2', name: 'Liquidity rebalance', pair: 'USDC/USD', amount: '88,000.00', status: 'info' },
  { id: '3', name: 'Settlement retry queue', pair: 'EUR/USDT', amount: '12,430.80', status: 'warning' },
  { id: '4', name: 'Rejected by counterparty', pair: 'BTC/USDT', amount: '5.128400', status: 'destructive' },
];

const COLUMNS: ColumnDef<Row, unknown>[] = [
  { accessorKey: 'name', header: 'Transaction' },
  { accessorKey: 'pair', header: 'Pair' },
  {
    accessorKey: 'amount',
    header: () => <span className="block text-right tabular-nums">Amount</span>,
    cell: ({ row }) => (
      <span className="block text-right tabular-nums">{row.original.amount}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <Badge variant={row.original.status} dot>{row.original.status}</Badge>,
  },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="section-gap flex flex-col gap-3">
      <h2 className="text-base font-semibold leading-6">{title}</h2>
      {children}
    </section>
  );
}

export default function UiShowcasePage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const [dark, setDark] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const toast = useToast();

  return (
    <div className={dark ? 'dark' : undefined}>
      <main className="page-pad mx-auto flex max-w-5xl flex-col gap-10 py-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              shared/ui · P2
            </p>
            <h1 className="text-2xl font-semibold leading-8">Component Showcase</h1>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={dark} onCheckedChange={setDark} aria-label="Toggle dark" />
            dark
          </label>
        </header>

        <Section title="Button">
          <div className="flex flex-wrap items-center gap-3">
            {(['default', 'secondary', 'outline', 'ghost', 'link', 'destructive'] as const).map(
              (v) => (
                <Button key={v} variant={v}>
                  {v}
                </Button>
              ),
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {(['xs', 'sm', 'default', 'lg'] as const).map((s) => (
              <Button key={s} size={s}>
                {s}
              </Button>
            ))}
            <Button
              loading={submitting}
              onClick={() => {
                setSubmitting(true);
                setTimeout(() => setSubmitting(false), 2000);
              }}
            >
              Submit
            </Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Badge">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="success" dot>success</Badge>
            <Badge variant="warning" dot>warning</Badge>
            <Badge variant="info">info</Badge>
            <Badge variant="destructive" dot>destructive</Badge>
            <Badge variant="mute">mute</Badge>
            <Badge variant="secondary">secondary</Badge>
            <Badge variant="outline">outline</Badge>
            <Badge variant="success" dot size="sm">sm 12</Badge>
          </div>
        </Section>

        <Section title="Card">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Funding pool USDT-01</CardTitle>
              <CardDescription>Rebalance window 09:00–11:00 UTC</CardDescription>
            </CardHeader>
            <CardContent className="panel-pad">
              <p className="text-sm text-muted-foreground">
                Water level 78% — within the comfort band.
              </p>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="outline" size="sm">Details</Button>
              <Button size="sm">Rebalance</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section title="Input / Select / Field">
          <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="sh-name">Account name</FieldLabel>
              <Input id="sh-name" placeholder="e.g. TESTLP01" />
              <FieldDescription>Visible to counterparties</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="sh-amount">Amount</FieldLabel>
              <Input
                id="sh-amount"
                aria-invalid
                defaultValue="0.00001"
                className="text-right tabular-nums"
              />
              <FieldError>Below the 0.01 minimum</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="sh-role">Role</FieldLabel>
              <Select defaultValue="ops">
                <SelectTrigger id="sh-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ops">Operations</SelectItem>
                  <SelectItem value="audit">Audit</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="sh-pwd">Password</FieldLabel>
              <PasswordField id="sh-pwd" autoComplete="new-password" />
            </Field>
            <Field>
              <FieldLabel htmlFor="sh-note">Note</FieldLabel>
              <Textarea id="sh-note" placeholder="Optional context for this operation" />
            </Field>
            <div className="flex flex-col gap-3">
              <Label className="flex items-center gap-2">
                <Checkbox defaultChecked /> Reviewed
              </Label>
              <Label className="flex items-center gap-2">
                <Switch defaultChecked /> Auto-retry
              </Label>
              <RadioGroup defaultValue="a" className="flex gap-4">
                <Label className="flex items-center gap-2">
                  <RadioGroupItem value="a" /> Window A
                </Label>
                <Label className="flex items-center gap-2">
                  <RadioGroupItem value="b" /> Window B
                </Label>
              </RadioGroup>
            </div>
          </div>
        </Section>

        <Section title="Tabs">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">
                All <span data-count={ROWS.length} />
              </TabsTrigger>
              <TabsTrigger value="pending">
                Pending <span data-count={1} />
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="pt-3 text-sm">All rows</TabsContent>
            <TabsContent value="pending" className="pt-3 text-sm">1 pending row</TabsContent>
            <TabsContent value="history" className="pt-3 text-sm">No history</TabsContent>
          </Tabs>
        </Section>

        <Section title="DataTable">
          <div className="flex items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => setLoading((v) => !v)}>
              {loading ? 'Show data' : 'Show loading'}
            </Button>
            <span className="text-sm text-muted-foreground">
              selected: {selected.length}
            </span>
          </div>
          <DataTable
            columns={COLUMNS}
            data={loading ? [] : ROWS}
            isLoading={loading}
            emptyMessage="No transactions in this window"
            selection={{ selectedIds: selected, onSelectionChange: setSelected }}
            pagination={{
              page: 1,
              pageSize: 10,
              total: ROWS.length,
              onPageChange: () => {},
            }}
          />
        </Section>

        <Section title="Dialog / Drawer / AlertDialog">
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm window change</DialogTitle>
                  <DialogDescription>
                    The rebalance window applies from the next settlement cycle.
                  </DialogDescription>
                </DialogHeader>
                <div className="text-sm text-muted-foreground">
                  Current: 09:00–11:00 UTC → New: 13:00–15:00 UTC
                </div>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button>Apply</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline">Open drawer</Button>
              </DrawerTrigger>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>Pool detail</DrawerTitle>
                  <DrawerDescription>USDT-01 liquidity composition</DrawerDescription>
                </DrawerHeader>
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Two counterparties · water level 78%
                </div>
                <DrawerFooter>
                  <DrawerClose asChild>
                    <Button variant="outline">Close</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Destructive action</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Freeze this pool?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Counterparties can no longer submit rebalance requests.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction>Freeze</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Section>

        <Section title="Toast">
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              onClick={() => toast.success('Pool rebalanced', { description: 'Water level back to 72%' })}
            >
              success
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                toast.error('Rebalance failed', { description: 'Counterparty timeout (P-2311)' })
              }
            >
              error
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.warning('Water level 91%', { description: 'Approaching cap' })}
            >
              warning
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.info('Window opens in 2h', { description: '09:00 UTC' })}
            >
              info
            </Button>
          </div>
        </Section>

        <Section title="Alert / Skeleton">
          <div className="grid gap-3 sm:grid-cols-2">
            <Alert variant="success">Rebalance completed at 09:42 UTC.</Alert>
            <Alert variant="warning">Water level above the 90% comfort band.</Alert>
            <Alert variant="info">Next settlement window opens in 2 hours.</Alert>
            <Alert variant="destructive">Pool frozen by operations.</Alert>
          </div>
          <div className="flex max-w-md items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex w-full flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
