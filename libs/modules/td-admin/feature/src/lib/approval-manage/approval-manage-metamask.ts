'use client';

/**
 * MetaMask 签名工具（ethers v6 改写版）。
 *
 * 迁移自 td-manage `src/lib/components/MeatmaskOrSign.tsx`（源文件名拼写错误
 * Meatmask→MetaMask，见迁移文档 §8）。源用 **ethers v5** API，目标项目
 * 根 package.json 已声明 `ethers@^6.16.0`（node_modules 实装 6.16.0），
 * 故做 v5→v6 API 改写，**非降级 stub**：
 *
 * | 源 (v5)                                      | 目标 (v6)                              |
 * |----------------------------------------------|----------------------------------------|
 * | `new ethers.providers.Web3Provider(provider)`| `new ethers.BrowserProvider(provider)` |
 * | `provider.getSigner()`（同步）                | `await provider.getSigner()`（异步）    |
 * | `ethers.utils.keccak256`                     | `ethers.keccak256`                     |
 * | `ethers.utils.toUtf8Bytes`                   | `ethers.toUtf8Bytes`                   |
 *
 * v6 移除了 `.providers` / `.utils` 命名空间，且 `getSigner()` 变为 async。
 *
 * **三个函数语义（照源，勿改）**：
 * - `connectToMetamask()`：检测 MetaMask 注入；未装 → 弹 AlertDialog 引导安装
 *   （源用 antd Modal.confirm，目标用 shadcn AlertDialog，文案 i18n 化）；
 *   已装 → 请求账户权限（`wallet_requestPermissions`），成功返回 BrowserProvider，
 *   失败/拒绝返回 null。
 * - `signMessage(message, type)`：type!==0 签 `keccak256(toUtf8Bytes(message))` 的
 *   hash（type=1，**审批签名必须保留此语义**）；type===0 直接签明文。
 *   无 MetaMask / 签名异常 → 返回 ''。
 * - `convertTxHashToRSV(txHash)`：签名结果（132 字符 = '0x' + 130 hex）拆 r/s/v。
 *   长度 !== 132 或非 '0x' 前缀 → `{r:'0',s:'0',v:'0'}`（**源注释写 130/66 是错的，
 *   以代码为准：132**）。调用方据 `r==='0'` 中止流程。
 *
 * **接入位置**：approval-manage-operation-panel.tsx MetaMask 按钮 onClick
 * （message = (busCode+taskId+approve+remarks).replaceAll(' ','').toLowerCase()，
 * type=1）。详见迁移文档 §7 步骤 13、§8。
 *
 * NOTE: 副作用函数（ethers 浏览器 API + AlertDialog），不属纯函数 util，故放 feature 层
 * （与 approval-manage.helpers.ts 注释一致）。依赖仅在浏览器可用，SSR 不会执行
 * （operation-panel 已 'use client'，且签名由用户点击触发）。
 */
import detectEthereumProvider from '@metamask/detect-provider';
import { BrowserProvider, keccak256, toUtf8Bytes } from 'ethers';

/** window.ethereum 类型（MetaMask 注入）。源用 GlobalAny，目标收敛为最小可用类型。 */
declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

/** EIP-1193 最小 provider 接口（request 方法）。覆盖 MetaMask 调用面。 */
interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
}

/** connectToMetamask 回调：未装 MetaMask 时由调用方决定如何引导（AlertDialog）。 */
export interface MetaMaskInstallPromptCallbacks {
  /** 触发安装引导（打开 AlertDialog）。调用方持 state 控制开关。 */
  onRequireInstall: () => void;
}

/**
 * 检测并连接 MetaMask（迁移自源 connectToMetamask，v6 改写）。
 *
 * @returns 成功 → BrowserProvider；未装 / 用户拒绝权限 → null。
 *
 * 源 v5：`new ethers.providers.Web3Provider(provider)` + `_isProvider` 标志判定。
 * v6：`new BrowserProvider(provider)`；v6 无 `_isProvider` 私有属性，改由
 * 本函数内部「检测通过 + 权限请求成功」即返回非 null 表达成功语义
 * （调用方原 `res !== null && res._isProvider` 简化为 `res !== null`）。
 *
 * 未装 MetaMask 不再在此函数内直接弹窗（源用 antd Modal.confirm 内聚 UI），
 * 改为回调通知调用方（operation-panel）弹 shadcn AlertDialog（i18n 化文案，
 * 见迁移文档 §8 mapping「antd Modal.confirm → shadcn AlertDialog」）。
 * 这样保持纯逻辑、UI 解耦、可在测试中 mock。
 */
export async function connectToMetamask(
  callbacks?: MetaMaskInstallPromptCallbacks
): Promise<BrowserProvider | null> {
  const provider = (await detectEthereumProvider()) as Eip1193Provider | null;

  // 1. 未装 MetaMask → 通知调用方引导安装。
  if (!provider) {
    callbacks?.onRequireInstall();
    return null;
  }

  // 2. 请求账户权限（源 wallet_requestPermissions；eth_accounts 降级注释保留源意图）。
  try {
    await provider.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
  } catch {
    // 用户拒绝或请求失败 → 中止。
    return null;
  }

  return new BrowserProvider(provider);
}

/**
 * 对 message 签名（迁移自源 signMessage，v6 改写）。
 *
 * @param message 待签内容
 * @param type    0=签明文；非 0（审批用 1）=签 `keccak256(toUtf8Bytes(message))` 的 hash
 * @returns 签名串；无 MetaMask / 异常 → ''（调用方据 convertTxHashToRSV 得 r==='0' 中止）
 *
 * v6 改写：`provider.getSigner()` 变 async；`ethers.utils.*` → `ethers.*` 顶层导出。
 */
export async function signMessage(message: string, type = 0): Promise<string> {
  if (!window.ethereum) {
    return '';
  }
  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  try {
    if (type !== 0) {
      // 审批签名：签 hash（源 type=1 语义，**必须保留**）。
      return await signer.signMessage(keccak256(toUtf8Bytes(message)));
    }
    return await signer.signMessage(message);
  } catch {
    return '';
  }
}

/** RSV 拆分结果。r==='0' 表示签名无效（长度/前缀校验失败），调用方据此中止。 */
export interface RsvSignature {
  r: string;
  s: string;
  v: string;
}

/**
 * 签名串 → r/s/v（迁移自源 convertTxHashToRSV）。
 *
 * 校验：长度必须 === **132**（'0x' + 130 hex）；非 132 或非 '0x' 前缀 → 全 '0'。
 * 拆分（去 '0x' 后）：r=前 64，s=中 64，v=末 2。
 *
 * NOTE: 源注释「130 位交易哈希值通常是 66 位的 hex」与代码 `length !== 132` 矛盾，
 * 以**代码为准**（132）。ethers v6 签名串为 0x + 130 hex = 132 字符（r64+s64+v2）。
 */
export function convertTxHashToRSV(txHash: string): RsvSignature {
  if (txHash.length !== 132 || !txHash.startsWith('0x')) {
    return { r: '0', s: '0', v: '0' };
  }
  const hashWithoutPrefix = txHash.slice(2);
  return {
    r: hashWithoutPrefix.slice(0, 64),
    s: hashWithoutPrefix.slice(64, 128),
    v: hashWithoutPrefix.slice(128),
  };
}
