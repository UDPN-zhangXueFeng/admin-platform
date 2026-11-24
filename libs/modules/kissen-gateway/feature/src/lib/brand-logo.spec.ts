import type { Brand } from '@myorg/modules/kissen-gateway/data-access';

import {
  buildBrandUpdatePayload,
  dataUrlDecodedBytes,
  LOGO_MAX_TEXT_LENGTH,
  LOGO_REQUIRED_MESSAGE,
  textLogoValue,
  validateBrandForm,
} from './brand-logo';

const IMAGE_LOGO = 'data:image/png;base64,iVBORw0KGgo=';

function form(overrides: Partial<Brand> = {}): Brand {
  return {
    name: 'Acme Bank Gateway',
    subtitle: 'Operations console',
    logo: '🏦',
    primaryColor: '#0B6B53',
    headerName: 'Acme Bank Gateway',
    ...overrides,
  };
}

describe('buildBrandUpdatePayload — logo three-state contract', () => {
  it('omits the logo key entirely when the logo was not touched', () => {
    const payload = buildBrandUpdatePayload(
      form({ logo: 'ignored local change' }),
      false,
    );

    expect('logo' in payload).toBe(false);
    expect(payload).toEqual({
      name: 'Acme Bank Gateway',
      subtitle: 'Operations console',
      primaryColor: '#0B6B53',
    });
  });

  it('sends the current logo when it was touched', () => {
    expect(buildBrandUpdatePayload(form({ logo: 'AB' }), true).logo).toBe('AB');
    expect(
      buildBrandUpdatePayload(form({ logo: IMAGE_LOGO }), true).logo,
    ).toBe(IMAGE_LOGO);
  });

  it('trims text fields without altering a data URL', () => {
    const payload = buildBrandUpdatePayload(
      form({
        name: '  Acme Bank Gateway  ',
        subtitle: '  Console  ',
        primaryColor: ' #0B6B53 ',
        logo: ` ${IMAGE_LOGO} `,
      }),
      true,
    );

    expect(payload.name).toBe('Acme Bank Gateway');
    expect(payload.subtitle).toBe('Console');
    expect(payload.primaryColor).toBe('#0B6B53');
    expect(payload.logo).toBe(IMAGE_LOGO);
  });
});

describe('validateBrandForm', () => {
  it('accepts a valid untouched form', () => {
    expect(validateBrandForm(form(), false)).toEqual({});
  });

  it('requires a non-blank portal name', () => {
    expect(validateBrandForm(form({ name: '   ' }), false).name).toBe(
      'Portal name is required',
    );
  });

  it('requires a non-blank logo only when the logo is dirty', () => {
    expect(validateBrandForm(form({ logo: '  ' }), false).logo).toBeUndefined();
    expect(validateBrandForm(form({ logo: '  ' }), true).logo).toBe(
      LOGO_REQUIRED_MESSAGE,
    );
  });

  it('caps text logos at four UTF-16 units but accepts image data URLs', () => {
    expect(LOGO_MAX_TEXT_LENGTH).toBe(4);
    expect(validateBrandForm(form({ logo: 'ABCD' }), true).logo).toBeUndefined();
    expect(validateBrandForm(form({ logo: 'ABCDE' }), true).logo).toMatch(
      /4 characters or fewer/,
    );
    expect(
      validateBrandForm(form({ logo: IMAGE_LOGO }), true).logo,
    ).toBeUndefined();
  });

  it('requires a #RRGGBB primary color', () => {
    expect(
      validateBrandForm(form({ primaryColor: 'red' }), false).primaryColor,
    ).toMatch(/#RRGGBB|hex value/);
    expect(
      validateBrandForm(form({ primaryColor: '#0b6b53' }), false).primaryColor,
    ).toBeUndefined();
  });
});

describe('textLogoValue', () => {
  it('never exposes an image data URL to the short-text input', () => {
    expect(textLogoValue(IMAGE_LOGO)).toBe('');
    expect(textLogoValue('🏦')).toBe('🏦');
    expect(textLogoValue('AB')).toBe('AB');
  });
});

describe('dataUrlDecodedBytes', () => {
  it('computes decoded bytes from base64 padding', () => {
    expect(dataUrlDecodedBytes('data:image/png;base64,AA==')).toBe(1);
    expect(dataUrlDecodedBytes('data:image/png;base64,AAA=')).toBe(2);
    expect(dataUrlDecodedBytes('data:image/png;base64,AAAA')).toBe(3);
    expect(dataUrlDecodedBytes('missing-comma')).toBe(0);
  });
});
