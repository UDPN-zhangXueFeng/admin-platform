import { canViewJournalDetails, JOURNAL_ENTRIES_PERMISSIONS } from './journal-entries-new.constants';

describe('Journal Details action visibility', () => {
  it('requires the exact action UUID in TDManage', () => {
    expect(canViewJournalDetails('TDManage', new Set())).toBe(false);
    expect(canViewJournalDetails('TDManage', new Set(['journal-entries-new:detail']))).toBe(false);
    expect(canViewJournalDetails('TDManage', new Set([JOURNAL_ENTRIES_PERMISSIONS.Detail]))).toBe(true);
  });

  it('defaults to TDManage but permits explicitly non-TD deployments', () => {
    expect(canViewJournalDetails(undefined, new Set())).toBe(false);
    expect(canViewJournalDetails('Other', new Set())).toBe(true);
  });
});
