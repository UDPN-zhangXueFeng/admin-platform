/**
 * ContractDeploymentTab — Tab2：合约部署（全 mock，保留源骨架）。
 * 源: tokenized-deposit-view-page.tsx 690-892
 */
'use client';

import * as React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import {
  Button,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@myorg/shared/ui';


// ═════════════════════════════════════════════════════════════════════
// Tab2：合约部署（全 mock，保留源骨架）
// ═════════════════════════════════════════════════════════════════════

/** 合约部署行（源 mock dataSource）。 */
interface ContractRow {
  /** DataTable 契约 id（= key）。 */
  id: string;
  key: string;
  contractName: string;
  version: string;
  contractType: string;
  proxyContractAddress: string;
  createdTime: string;
  status: string;
}

const CONTRACT_ROWS: ContractRow[] = [
  {
    id: '1',
    key: '1',
    contractName: 'Tokenized Deposit Contract',
    version: '1.0.0',
    contractType: 'Proxy Contract',
    proxyContractAddress: '0x000580a716cf548c5e8520218cf78d0e04052299',
    createdTime: 'Feb 10, 2024, 10:14:41 UTC+08:00',
    status: 'Success',
  },
  {
    id: '2',
    key: '2',
    contractName: 'Pool Management Contract',
    version: '1.0.0',
    contractType: 'Proxy Contract',
    proxyContractAddress: '0x000580a716cf548c5e8520218cf78d0e04050000',
    createdTime: 'Feb 10, 2024, 10:14:41 UTC+08:00',
    status: 'Success',
  },
  {
    id: '3',
    key: '3',
    contractName: 'Wallet Contract',
    version: '1.0.0',
    contractType: 'Proxy Contract',
    proxyContractAddress: '0x000580a716cf548c5e8520218cf78d0e04051111',
    createdTime: 'Feb 10, 2024, 10:14:41 UTC+08:00',
    status: 'Success',
  },
];

/**
 * 合约部署 Tab（全 mock，无后端）。
 *
 * 源 view.tsx 第 265-356 行 mock 表 + Update / Details 行操作。本组件保留 mock 骨架，
 * 两个 Dialog（Update 表单 / Details 列表）亦保留 mock 数据。
 */
export function ContractDeploymentTab(): React.JSX.Element {
  const t = useTranslations('modules.tokenized-deposit');

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [updateOpen, setUpdateOpen] = React.useState(false);
  const [bin, setBin] = React.useState('poolManagementContracts.bin (49KB)');
  const [abi, setAbi] = React.useState('poolManagementContracts.abi (49KB)');
  // 源 Form initialValues：每次打开 Update 都恢复预填值；Submit/Cancel 仅关闭，不发 API。
  React.useEffect(() => {
    if (updateOpen) {
      setBin('poolManagementContracts.bin (49KB)');
      setAbi('poolManagementContracts.abi (49KB)');
    }
  }, [updateOpen]);
  // Details Modal 中「Contract Initialisation List」显隐（源 hide = data.key === '2'）。
  const [hideInitList, setHideInitList] = React.useState(false);

  const columns = React.useMemo<ColumnDef<ContractRow>[]>(
    () => [
      { accessorKey: 'contractName', header: 'Contract Name' },
      { accessorKey: 'version', header: 'Version' },
      { accessorKey: 'contractType', header: 'Contract Type' },
      { accessorKey: 'proxyContractAddress', header: t('contract_manage_004') },
      { accessorKey: 'createdTime', header: t('PUB_CreatedTime') },
      { accessorKey: 'status', header: 'Status' },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => (
          <div className="flex gap-3 text-primary">
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => setUpdateOpen(true)}
            >
              Update
            </Button>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => {
                setHideInitList(row.original.key === '2');
                setDetailsOpen(true);
              }}
            >
              Details
            </Button>
          </div>
        ),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-4">
      <p role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {t('td_legacy_demo_notice')}
      </p>
      <DataTable
        columns={columns}
        data={CONTRACT_ROWS}
        emptyMessage={t('empty')}
        pagination={undefined}
      />

      {/* Details Modal（源 isModalOpen） */}
      <Dialog open={detailsOpen} onOpenChange={(next) => !next && setDetailsOpen(false)}>
        <DialogContent className="max-w-[60%]">
          <DialogHeader>
            <DialogTitle>Contract Deployment List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ContractDeploymentTable />
            {!hideInitList ? <ContractInitialisationTable /> : null}
          </div>
          <DialogFooter className="flex-row justify-end sm:justify-end">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Modal（源 mock：bin/abi 预填，Cancel/Submit 仅关闭，不发 API） */}
      <Dialog open={updateOpen} onOpenChange={(next) => !next && setUpdateOpen(false)}>
        <DialogContent className="max-w-[30rem]">
          <DialogHeader>
            <DialogTitle>Update Pool Management Contract</DialogTitle>
            <DialogDescription className="sr-only">
              Update Pool Management Contract
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              setUpdateOpen(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="pool-contract-bin">BIN</Label>
              <Input
                id="pool-contract-bin"
                value={bin}
                onChange={(event) => setBin(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pool-contract-abi">ABI</Label>
              <Input
                id="pool-contract-abi"
                value={abi}
                onChange={(event) => setAbi(event.target.value)}
                required
              />
            </div>
            <DialogFooter className="flex-row justify-end gap-3 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setUpdateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

/** Details Modal 上表（源 Contract Deployment List，mock）。 */
function ContractDeploymentTable(): React.JSX.Element {
  const rows = [
    {
      id: '1',
      key: '1',
      contractType: 'Proxy Contract',
      version: '1.0.0',
      type: 'Deployment',
      contractAddress: '0x9f8f...79a2',
      transactionHash: '0x30ef866295...',
      status: 'Success',
    },
    {
      id: '2',
      key: '2',
      contractType: 'Logical Contract',
      version: '1.0.0',
      type: 'Deployment',
      contractAddress: '0x9f8f...79a2',
      transactionHash: '0x30ef866295...',
      status: 'Success',
    },
    {
      id: '3',
      key: '3',
      contractType: 'TD Contract Relationship Deployment',
      version: '1.0.0',
      type: 'Deployment',
      contractAddress: '0x9f8f...79a2',
      transactionHash: '0x30ef866295...',
      status: 'Success',
    },
  ];
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    { accessorKey: 'contractType', header: 'Contract Type' },
    { accessorKey: 'version', header: 'Version' },
    { accessorKey: 'type', header: 'Type' },
    { accessorKey: 'contractAddress', header: 'Contract Address' },
    { accessorKey: 'transactionHash', header: 'Transaction Hash' },
    { accessorKey: 'status', header: 'Status' },
  ];
  return <DataTable columns={columns} data={rows} pagination={undefined} />;
}

/** Details Modal 下表（源 Contract Initialisation List，mock）。 */
function ContractInitialisationTable(): React.JSX.Element {
  const rows = [
    {
      id: '1',
      key: '1',
      administratorWalletAddress: '0x000580a716cf548c5e8520218cf78d0e04051010',
      description: 'TD Managed Operations Wallet',
      transactionHash: '0x30ef866295...',
      status: 'Success',
    },
    {
      id: '2',
      key: '2',
      administratorWalletAddress: '0x000580a716cf548c5e8520218cf78d0e04051212',
      description: 'TD Sales Operating Wallet',
      transactionHash: '0x30ef866295...',
      status: 'Success',
    },
  ];
  const columns: ColumnDef<(typeof rows)[number]>[] = [
    {
      accessorKey: 'administratorWalletAddress',
      header: 'Administrator Wallet Address',
    },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'transactionHash', header: 'Transaction Hash' },
    { accessorKey: 'status', header: 'Status' },
  ];
  return <DataTable columns={columns} data={rows} pagination={undefined} />;
}
