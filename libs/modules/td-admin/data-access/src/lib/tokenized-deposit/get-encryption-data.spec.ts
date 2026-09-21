import { getEncryptionData } from './get-encryption-data';

describe('getEncryptionData', () => {
  // ===== 空值 / 边界 =====

  it('should return empty string for empty string input', () => {
    expect(getEncryptionData('')).toBe('');
  });

  it('should return empty string for undefined input', () => {
    expect(getEncryptionData(undefined as unknown as string)).toBe('');
  });

  it('should return empty string for null input', () => {
    expect(getEncryptionData(null as unknown as string)).toBe('');
  });

  // ===== 固定测试向量（与 crypto-js 直接计算一致） =====

  it('should encrypt "test123" with default key/iv to a known uppercase hex ciphertext', () => {
    // Computed via: crypto-js AES-CBC Pkcs7, key='reddatespartan25', iv='hongzao25spartan'
    const result = getEncryptionData('test123');
    expect(result).toBe('9E32F1C9DCE67156FE1F05218407BD3C');
  });

  it('should encrypt numeric input (42) correctly', () => {
    const result = getEncryptionData(42);
    expect(result).toBe('6C1FCE1E56A2736BB907B0267DA85B5D');
  });

  // ===== customKey 覆盖默认 key =====

  it('should use custom key when customKey is provided', () => {
    const result = getEncryptionData('hello', 'myCustomKey12345');
    // Same key/iv computed: key='myCustomKey12345', iv='hongzao25spartan'
    expect(result).toBe('5B8994A91B81B83FFCF8114EE6D24CFD');
  });

  it('should keep using default key when customKey is empty string', () => {
    // Default key='reddatespartan25', same as getEncryptionData('test123')
    const result = getEncryptionData('test123', '');
    expect(result).toBe('9E32F1C9DCE67156FE1F05218407BD3C');
  });

  // ===== 确定性（多次调用结果一致） =====

  it('should produce the same output for the same input across multiple calls', () => {
    const first = getEncryptionData('hello world');
    const second = getEncryptionData('hello world');
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });

  // ===== 输出格式 =====

  it('should return an uppercase hex string (no lowercase letters)', () => {
    const result = getEncryptionData('some data');
    // Must be all uppercase hex characters
    expect(result).toMatch(/^[0-9A-F]+$/);
    expect(result).toBe(result.toUpperCase());
    expect(result).not.toMatch(/[a-f]/);
  });
});
