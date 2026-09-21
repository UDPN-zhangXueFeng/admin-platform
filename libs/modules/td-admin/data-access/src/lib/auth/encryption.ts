import CryptoJS from 'crypto-js';

/**
 * AES-CBC encryption utility.
 *
 * Matches the backend RBAC service's decryption expectations.
 * Key and IV must stay in sync with the backend configuration.
 *
 * TODO: Move key/IV to environment variables (`NEXT_PUBLIC_AES_KEY`,
 * `NEXT_PUBLIC_AES_IV`) before production deployment. Hardcoded for
 * now to maintain compatibility with the existing backend.
 */

const DEFAULT_KEY = 'reddatespartan25';
const DEFAULT_IV = 'hongzao25spartan';

const key = CryptoJS.enc.Utf8.parse(DEFAULT_KEY);
const iv = CryptoJS.enc.Utf8.parse(DEFAULT_IV);

/**
 * Encrypts a value using AES-CBC and returns the ciphertext as
 * an uppercase hex string — exactly what the backend expects.
 */
export function encrypt(value: string | number): string {
  if (value === '' || value === null || value === undefined) return '';

  const srcs = CryptoJS.enc.Utf8.parse(String(value));
  const encrypted = CryptoJS.AES.encrypt(srcs, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return encrypted.ciphertext.toString().toUpperCase();
}

/**
 * Decrypts an AES-CBC ciphertext hex string back to plaintext.
 * Used for debugging/testing; not required by the login flow itself.
 */
export function decrypt(ciphertext: string): string {
  const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return decrypted.toString(CryptoJS.enc.Utf8);
}
