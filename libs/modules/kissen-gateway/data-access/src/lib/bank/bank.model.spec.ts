import {
  instanceConnectivityText,
  instanceStatusText,
} from './bank.model';

describe('gateway instance display mappings', () => {
  it('uses the management portal connectivity vocabulary for gateway values', () => {
    expect(instanceConnectivityText('UP')).toBe('Online');
    expect(instanceConnectivityText('DOWN')).toBe('Offline');
    expect(instanceConnectivityText('DEGRADED')).toBe('Degraded');
  });

  it('distinguishes active, bootstrap-pending, and inactive instances', () => {
    expect(
      instanceStatusText({ activated: true, credentialMode: 'instance' }),
    ).toBe('Active');
    expect(
      instanceStatusText({ activated: false, credentialMode: 'bootstrap' }),
    ).toBe('Pending');
    expect(
      instanceStatusText({ activated: false, credentialMode: 'legacy' }),
    ).toBe('Inactive');
  });
});
