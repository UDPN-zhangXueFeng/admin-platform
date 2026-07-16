import CryptoJS from 'crypto-js';

/**
 * AES-CBC 加密工具。
 *
 * 迁移自 td-manage libs/utils/get/getEncryptionData.ts。
 * 与后端 tokenized-deposit 服务解密逻辑保持一致。
 * Key/IV/算法必须严格匹配，否则后端解密失败。
 *
 * 配置：
 * - key:  'reddatespartan25'
 * - iv:   'hongzao25spartan'
 * - mode: CBC
 * - padding: Pkcs7
 * - output: uppercase hex string（encrypted.ciphertext.toString().toUpperCase()）
 */

const DEFAULT_KEY = CryptoJS.enc.Utf8.parse('reddatespartan25');
const DEFAULT_IV = CryptoJS.enc.Utf8.parse('hongzao25spartan');

/**
 * 将明文加密为 AES-CBC 大写十六进制密文。
 *
 * @param plain - 待加密的明文字符串或数字
 * @param customKey - 可选自定义密钥字符串（为空则使用默认 key）
 * @returns 大写十六进制密文字符串；plain 为空时返回空串
 */
export function getEncryptionData(
  plain: string | number,
  customKey = ''
): string {
  if (plain === '' || plain === null || plain === undefined) return '';

  const srcs = CryptoJS.enc.Utf8.parse(String(plain));
  const key = customKey
    ? CryptoJS.enc.Utf8.parse(customKey)
    : DEFAULT_KEY;

  const encrypted = CryptoJS.AES.encrypt(srcs, key, {
    iv: DEFAULT_IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return encrypted.ciphertext.toString().toUpperCase();
}
