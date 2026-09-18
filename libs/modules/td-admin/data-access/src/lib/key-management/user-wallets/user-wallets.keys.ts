/**
 * TanStack Query key factory for user-wallets.
 */

export const userWalletKeys = {
  all: () => ['user-wallets'] as const,
  lists: () => [...userWalletKeys.all(), 'list'] as const,
  list: () => [...userWalletKeys.lists()] as const,
};
