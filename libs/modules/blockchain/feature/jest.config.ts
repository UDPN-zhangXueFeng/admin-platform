export default {
  displayName: 'modules-blockchain-feature',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[tj]sx?$': ['@swc/jest'] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Resolve blockchain's own sibling libraries to source and stub the shared HTTP
  // client so specs never pull in axios + next-intl's ESM build under @swc/jest.
  // <rootDir> = libs/modules/blockchain/feature；util/data-access 均为同级目录。
  // 对齐 mmf feature 的 moduleNameMapper（已验收范本）。
  moduleNameMapper: {
    '^@myorg/shared/data-access-api$':
      '<rootDir>/src/lib/__mocks__/data-access-api.ts',
    '^@myorg/modules/blockchain/data-access$':
      '<rootDir>/../data-access/src/index.ts',
    '^@myorg/modules/blockchain/util$':
      '<rootDir>/../util/src/index.ts',
  },
  coverageDirectory: '../../../../coverage/libs/modules/blockchain/feature',
};
