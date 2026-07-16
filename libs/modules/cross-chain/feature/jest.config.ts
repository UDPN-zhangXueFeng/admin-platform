export default {
  displayName: 'modules-cross-chain-feature',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[tj]sx?$': ['@swc/jest'] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Resolve cross-chain's own sibling libraries to source and stub the shared HTTP
  // client so specs never pull in axios + next-intl's ESM build under @swc/jest.
  // <rootDir> = libs/modules/cross-chain/feature；util/data-access 均为同级目录。
  // 对齐 mmf feature 的 moduleNameMapper（已验收范本）。
  moduleNameMapper: {
    '^@myorg/shared/data-access-api$':
      '<rootDir>/src/lib/__mocks__/data-access-api.ts',
    '^@myorg/modules/cross-chain/data-access$':
      '<rootDir>/../data-access/src/index.ts',
    '^@myorg/modules/cross-chain/util$':
      '<rootDir>/../util/src/index.ts',
  },
  coverageDirectory: '../../../../coverage/libs/modules/cross-chain/feature',
};
