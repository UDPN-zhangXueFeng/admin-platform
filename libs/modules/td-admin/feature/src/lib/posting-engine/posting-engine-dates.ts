import { formatDate } from '@myorg/shared/util-dates';
import { EMPTY_DISPLAY, toMillis } from './posting-engine.constants';

export function formatPostingDate(value?: number): string {
  const millis = toMillis(value);
  if (!millis || Number.isNaN(new Date(millis).getTime())) return EMPTY_DISPLAY;
  const date = new Date(millis);
  const hours = -date.getTimezoneOffset() / 60;
  return `${formatDate(date, 'MMM d, yyyy')} (UTC${hours >= 0 ? '+' : ''}${hours})`;
}
