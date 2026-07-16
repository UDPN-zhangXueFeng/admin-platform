export default {
  displayName: 'modules-mmf-feature',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[tj]sx?$': ['@swc/jest'] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // Resolve mmf's own sibling libraries to source and stub the shared HTTP
  // client so specs never pull in axios + next-intl's ESM build under @swc/jest.
  // <rootDir> = libs/modules/mmf/feature；util/data-access 均为 mmf 下同级目录。
  moduleNameMapper: {
    '^@myorg/shared/data-access-api$':
      '<rootDir>/src/lib/__mocks__/data-access-api.ts',
    '^@myorg/modules/mmf/data-access$':
      '<rootDir>/../data-access/src/index.ts',
    '^@myorg/modules/mmf/util$': '<rootDir>/../util/src/index.ts',
  },
  coverageDirectory: '../../../../coverage/libs/modules/mmf/feature',
};
