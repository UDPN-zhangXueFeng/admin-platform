import CryptoJS from 'crypto-js';

/**
 * AES-CBC 加密工具（keystore 密码加密）。
 *
 * 迁移自 td-manage `libs/utils/get/getEncryptionData.ts`（1:1 保留）。
 * 与 tokenized-deposit 模块的 `get-encryption-data.ts` 同源同逻辑——两模块
 * keystore 密码均经此加密后再 POST 给后端 `/util/wallet/keystore`，密钥/IV/算法
 * 必须严格匹配后端解密逻辑，否则解密失败。
 *
 * 配置：
 * - key:  'reddatespartan25'
 * - iv:   'hongzao25spartan'
 * - mode: CBC
 * - padding: Pkcs7
 * - output: uppercase hex string（encrypted.ciphertext.toString().toUpperCase()）
 *
 * NOTE: tokenized-deposit 已有同名实现；wallet 不跨库依赖 td util（避免跨模块 util
 * 耦合），按计划 §0「单库」原则在 wallet util 内独立保留一份。
 */

const DEFAULT_KEY = CryptoJS.enc.Utf8.parse('reddatespartan25');
const DEFAULT_IV = CryptoJS.enc.Utf8.parse('hongzao25spartan');

/**
 * 将明文加密为 AES-CBC 大写十六进制密文。
 *
 * @param plain - 待加密的明文（keystore 密码）
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
