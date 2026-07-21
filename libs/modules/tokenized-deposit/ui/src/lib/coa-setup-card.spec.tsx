import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import * as mockReact from 'react';

const React = mockReact;

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('@myorg/shared/ui', () => {
  const Box = ({ children }: mockReact.PropsWithChildren) =>
    mockReact.createElement('div', null, children);

  return {
    Badge: Box,
    Card: Box,
    CardDescription: Box,
    CardTitle: Box,
    Field: Box,
    FieldError: Box,
    FieldLabel: Box,
    Input: (props: mockReact.ComponentProps<'input'>) =>
      mockReact.createElement('input', props),
    Select: ({
      children,
      disabled,
    }: mockReact.PropsWithChildren<{ disabled?: boolean }>) =>
      mockReact.createElement(
        'div',
        {
          'data-testid': 'select',
          'data-disabled': String(Boolean(disabled)),
        },
        children,
      ),
    SelectContent: Box,
    SelectItem: Box,
    SelectTrigger: Box,
    SelectValue: Box,
  };
});

import { CoaSetupCard } from './coa-setup-card';

describe('CoaSetupCard', () => {
  it('keeps COA reference fields read-only after setup defaults are populated', () => {
    render(
      <CoaSetupCard
        data={{
          status: 'setup_required',
          financialBookName: '',
          accountTemplateCode: 'stablecoin-default',
          accountTemplateName: 'Default Stablecoin Account Template',
          eodCutOffTime: '00:00:00',
          timeZone: 'Asia/Shanghai',
          timeZoneLabel: '(UTC+08:00) Asia/Shanghai - China Time',
        }}
        accountTemplateOptions={[
          {
            value: 'stablecoin-default',
            label: 'Default Stablecoin Account Template',
          },
        ]}
        timezoneOptions={[
          {
            value: 'Asia/Shanghai',
            label: '(UTC+08:00) Asia/Shanghai - China Time',
          },
        ]}
      />,
    );

    expect(screen.getByDisplayValue('00:00:00')).toBeDisabled();
    expect(screen.getAllByTestId('select')).toHaveLength(2);
    screen
      .getAllByTestId('select')
      .forEach((select) => expect(select).toHaveAttribute('data-disabled', 'true'));
    expect(
      screen.getByPlaceholderText(
        'tokenized_deposit_coa_financial_book_placeholder',
      ),
    ).toBeEnabled();
  });
});
