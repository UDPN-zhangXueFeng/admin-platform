import { kissenRequest } from '../kissen-gateway-client';
import { sanitizeBrandText, updateBrand } from './auth.api';
import { isImageLogo } from './auth.model';

jest.mock('../kissen-gateway-client', () => ({
  kissenRequest: { put: jest.fn().mockResolvedValue({}) },
}));

describe('sanitizeBrandText', () => {
  it('falls back to the English default when the backend brand copy contains CJK', () => {
    // 实测 87 环境 brand 接口返回中文文案；约束 1 要求用户可见字符串零 CJK。
    expect(sanitizeBrandText('Kissen 银行门户', 'Kissen Bank Portal')).toBe(
      'Kissen Bank Portal',
    );
  });

  it('passes non-CJK white-label copy through unchanged', () => {
    expect(sanitizeBrandText('Kissen Clearing', 'Kissen Bank Portal')).toBe(
      'Kissen Clearing',
    );
  });

  it('falls back on empty or whitespace-only values', () => {
    expect(sanitizeBrandText(undefined, 'Bank Portal Console')).toBe(
      'Bank Portal Console',
    );
    expect(sanitizeBrandText('   ', 'Bank Portal Console')).toBe(
      'Bank Portal Console',
    );
  });
});

describe('isImageLogo', () => {
  it('accepts picture data URLs', () => {
    expect(isImageLogo('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('rejects emoji / abbreviation text logos', () => {
    expect(isImageLogo('🏦')).toBe(false);
    expect(isImageLogo('UDPN')).toBe(false);
  });

  it('rejects empty and missing values', () => {
    expect(isImageLogo('')).toBe(false);
    expect(isImageLogo(undefined)).toBe(false);
    expect(isImageLogo(null)).toBe(false);
  });

  it('rejects long non-data text (including data URLs of non-image types)', () => {
    expect(isImageLogo('https://cdn.example.com/logo.png')).toBe(false);
    expect(isImageLogo('data:text/plain;base64,aGVsbG8=')).toBe(false);
  });
});

describe('updateBrand', () => {
  const putMock = kissenRequest.put as unknown as jest.Mock;

  beforeEach(() => {
    putMock.mockClear();
  });

  it('omits logo entirely when the caller leaves it undefined (server keeps current logo)', async () => {
    await updateBrand({
      name: 'Kissen Bank Portal',
      subtitle: 'Console',
      primaryColor: '#0B6B53',
    });

    expect(putMock).toHaveBeenCalledWith(
      '/brand',
      {
        name: 'Kissen Bank Portal',
        subtitle: 'Console',
        primaryColor: '#0B6B53',
      },
      undefined,
    );
    expect(putMock.mock.calls[0][1]).not.toHaveProperty('logo');
  });

  it('sends a blank logo string when the caller explicitly blanks it', async () => {
    await updateBrand({
      name: 'Kissen Bank Portal',
      subtitle: 'Console',
      primaryColor: '#0B6B53',
      logo: '',
    });

    expect(putMock.mock.calls[0][1]).toHaveProperty('logo', '');
  });

  it('sends text and image logos verbatim without headerName', async () => {
    const logo = 'data:image/png;base64,iVBORw0KGgo=';
    await updateBrand({
      name: 'Kissen Bank Portal',
      subtitle: 'Console',
      primaryColor: '#0B6B53',
      logo,
    });

    const body = putMock.mock.calls[0][1];
    expect(body).toMatchObject({ logo });
    expect(body).not.toHaveProperty('headerName');
  });
});
