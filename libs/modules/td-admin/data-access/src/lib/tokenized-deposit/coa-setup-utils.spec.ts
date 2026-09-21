import {
  normalizeCoaSetupTimeZone,
  withDefaultAccountTemplate,
  withDefaultCoaTimezone,
} from './coa-setup-utils';

describe('COA setup defaults', () => {
  const accountTemplate = {
    value: '101',
    label: 'Default Account Template',
  };
  const browserTimezone = {
    value: 'Asia/Shanghai',
    label: '(UTC+08:00) Asia/Shanghai - China Standard Time',
  };

  it('uses the first account template and browser timezone when a read-only COA has no values', () => {
    const emptyConfiguredCoa = {
      status: 'configured' as const,
      accountTemplateCode: '',
      accountTemplateName: '',
      timeZone: '',
      timeZoneLabel: '',
    };

    const withTemplate = withDefaultAccountTemplate(
      emptyConfiguredCoa,
      accountTemplate,
    );
    const result = withDefaultCoaTimezone(withTemplate, browserTimezone);

    expect(result).toEqual({
      ...emptyConfiguredCoa,
      accountTemplateCode: '101',
      accountTemplateName: 'Default Account Template',
      timeZone: 'Asia/Shanghai',
      timeZoneLabel: '(UTC+08:00) Asia/Shanghai - China Standard Time',
    });
  });

  it('does not overwrite a configured COA returned by the backend', () => {
    const configuredCoa = {
      status: 'configured' as const,
      accountTemplateCode: '202',
      accountTemplateName: 'Existing Account Template',
      timeZone: 'Europe/London',
      timeZoneLabel: '(UTC+00:00) Europe/London - Greenwich Mean Time',
    };

    expect(
      withDefaultAccountTemplate(configuredCoa, accountTemplate),
    ).toBe(configuredCoa);
    expect(withDefaultCoaTimezone(configuredCoa, browserTimezone)).toBe(
      configuredCoa,
    );
  });

  it('normalizes a backend timezone label to the selectable timezone value', () => {
    const timezoneLabel = '(UTC+08:00) Asia/Shanghai - China Standard Time';
    const coaWithLabelOnly = {
      status: 'configured' as const,
      timeZone: '',
      timeZoneLabel: timezoneLabel,
    };

    expect(
      normalizeCoaSetupTimeZone(coaWithLabelOnly, [browserTimezone]),
    ).toEqual({
      ...coaWithLabelOnly,
      timeZone: 'Asia/Shanghai',
    });
  });
});
