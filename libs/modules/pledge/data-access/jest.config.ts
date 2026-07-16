export default {
  displayName: 'modules-pledge-data-access',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[tj]sx?$': ['@swc/jest'] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Stub the shared HTTP client so the api/mutations specs run without axios +
  // next-intl's ESM build (which @swc/jest cannot transform from node_modules).
  // 对齐 cross-chain.data-access 的 moduleNameMapper。
  moduleNameMapper: {
    '^@myorg/shared/data-access-api$':
      '<rootDir>/src/lib/__mocks__/data-access-api.ts',
  },
  coverageDirectory: '../../../../coverage/libs/modules/pledge/data-access',
};
