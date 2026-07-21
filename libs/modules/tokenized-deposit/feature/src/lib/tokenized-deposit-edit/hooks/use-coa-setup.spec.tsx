import { renderHook, waitFor } from '@testing-library/react';

import { MINT_METHOD } from '@myorg/modules/tokenized-deposit/util';

jest.mock('@myorg/modules/tokenized-deposit/data-access', () => {
  const query = (data: unknown) => ({
    data,
    isError: false,
    isLoading: false,
  });
  const financeTemplateQuery = query([
    {
      templateCode: 'stablecoin-default',
      templateName: 'Stablecoin Default Template',
    },
  ]);
  const timezoneQuery = query([
    {
      key: 'Asia/Shanghai',
      value: '(UTC+08:00) Asia/Shanghai - China Standard Time',
    },
  ]);
  const financeBookQuery = query({
    financeBookId: 1,
    bookName: 'USDCX Financial Book',
    eodCutoffDate: '17:00:00',
  });

  return {
    useFinanceTemplateQuery: () => financeTemplateQuery,
    useTimezoneOptionsQuery: () => timezoneQuery,
    useFinanceBookByReserveQuery: () => financeBookQuery,
  };
});

import { useCoaSetup } from './use-coa-setup';

describe('useCoaSetup', () => {
  beforeEach(() => {
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: 'Asia/Shanghai' }),
        }) as Intl.DateTimeFormat,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows default read-only values when legacy template and timezone responses omit the new field names', async () => {
    const { result } = renderHook(() =>
      useCoaSetup({
        mintMethod: MINT_METHOD.STABLECOIN,
        reserveAccountId: 9,
      }),
    );

    await waitFor(() => {
      expect(result.current.stablecoinCoaData.status).toBe('configured');
    });

    expect(result.current.stablecoinCoaData).toMatchObject({
      accountTemplateCode: 'stablecoin-default',
      accountTemplateName: 'Stablecoin Default Template',
      timeZone: 'Asia/Shanghai',
      timeZoneLabel: '(UTC+08:00) Asia/Shanghai - China Standard Time',
    });
  });
});
