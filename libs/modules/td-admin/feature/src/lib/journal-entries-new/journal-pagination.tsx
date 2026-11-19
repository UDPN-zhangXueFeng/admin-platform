import { Button } from '@myorg/shared/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface JournalPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  visible: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
}

export function JournalPagination({ page, pageSize, total, visible, disabled, onPageChange }: JournalPaginationProps) {
  const t = useTranslations('modules.journal-entries-new.pagination');
  const pageCount = Math.ceil(total / pageSize);
  const range = Array.from({ length: Math.min(pageCount, 5) }, (_, index) =>
    Math.max(1, Math.min(page - 2, pageCount - 4)) + index,
  );
  const first = range[0];
  const last = range[range.length - 1];
  const numbers = pageCount > 0
    ? [...(first > 1 ? [1] : []), ...(first > 2 ? ['before'] : []), ...range,
      ...(last < pageCount - 1 ? ['after'] : []), ...(last < pageCount ? [pageCount] : [])]
    : [];

  return (
    <nav aria-label={t('label')} className="mt-4 flex flex-wrap items-center justify-end gap-1">
      <div className="mr-auto text-xs tabular-nums text-muted-foreground">
        {t('range', {
          start: visible ? (page - 1) * pageSize + 1 : 0,
          end: visible ? (page - 1) * pageSize + visible : 0,
          total,
        })}
      </div>
      <Button type="button" variant="outline" size="icon" aria-label={t('previous')} disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft aria-hidden="true" />
      </Button>
      {numbers.map((number) => typeof number === 'string'
        ? (
          <Button key={number} type="button" size="icon" variant="ghost" disabled={disabled}
            aria-label={number === 'before' ? t('previousFive') : t('nextFive')}
            onClick={() => onPageChange(number === 'before' ? Math.max(1, page - 5) : Math.min(pageCount, page + 5))}>
            …
          </Button>
        )
        : (
          <Button key={number} type="button" size="icon" variant={number === page ? 'default' : 'outline'}
            aria-label={t('page', { number })} aria-current={number === page ? 'page' : undefined}
            disabled={disabled} onClick={() => { if (number !== page) onPageChange(number); }}>
            {number}
          </Button>
        ))}
      <Button type="button" variant="outline" size="icon" aria-label={t('next')} disabled={disabled || page >= pageCount} onClick={() => onPageChange(page + 1)}>
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
