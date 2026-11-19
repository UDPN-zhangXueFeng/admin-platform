import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { QueryForm } from './query-form';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// The shared UI barrel pulls in the sidebar, which imports the next-intl
// routing helpers (ESM). Stub them so this presentational test stays focused.
jest.mock('@myorg/shared/util-i18n', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  usePathname: () => '/',
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

describe('QueryForm', () => {
  it('renders the filter row and actions without a query heading', () => {
    const onQuery = jest.fn();
    const onReset = jest.fn();

    render(
      <QueryForm
        fields={[<label key="keyword">Keyword</label>]}
        onQuery={onQuery}
        onReset={onReset}
        queryLabel="Query"
        resetLabel="Reset"
      />
    );

    expect(screen.getByText('Keyword')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Query' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    expect(onQuery).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('keeps advanced filters collapsed until More is toggled', () => {
    render(
      <QueryForm
        fields={[<span key="primary">Primary filter</span>]}
        advancedFields={[<span key="advanced">Advanced filter</span>]}
        onQuery={jest.fn()}
        onReset={jest.fn()}
        queryLabel="Query"
        resetLabel="Reset"
      />
    );

    expect(screen.getByText('Primary filter')).toBeInTheDocument();
    expect(screen.queryByText('Advanced filter')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'more' })
    ).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'more' }));
    expect(screen.getByText('Advanced filter')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'collapse' }));
    expect(screen.queryByText('Advanced filter')).not.toBeInTheDocument();
  });

  it('renders a submit button for form-owned queries', () => {
    const onSubmit = jest.fn((event) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <QueryForm
          fields={[<span key="primary">Primary filter</span>]}
          queryType="submit"
          onReset={jest.fn()}
          queryLabel="Query"
          resetLabel="Reset"
        />
      </form>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Query' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
