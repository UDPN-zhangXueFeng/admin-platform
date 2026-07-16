export default {
  displayName: 'modules-pledge-feature',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[tj]sx?$': ['@swc/jest'] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Resolve pledge's own sibling libraries to source and stub the shared HTTP
  // client so specs never pull in axios + next-intl's ESM build under @swc/jest.
  // <rootDir> = libs/modules/pledge/feature；util/data-access 均为同级目录。
  // 对齐 cross-chain feature 的 moduleNameMapper。
  moduleNameMapper: {
    '^@myorg/shared/data-access-api$':
      '<rootDir>/src/lib/__mocks__/data-access-api.ts',
    '^@myorg/modules/pledge/data-access$':
      '<rootDir>/../data-access/src/index.ts',
    '^@myorg/modules/pledge/util$': '<rootDir>/../util/src/index.ts',
  },
  coverageDirectory: '../../../../coverage/libs/modules/pledge/feature',
};
