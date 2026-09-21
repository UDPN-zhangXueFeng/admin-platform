export default {
  displayName: 'modules-td-admin-feature',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[tj]sx?$': ['@swc/jest'] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@myorg/shared/util-i18n-messages/(.*)$':
      '<rootDir>/../../../../libs/shared/util-i18n-messages/src/lib/$1',
    '^@myorg/modules/td-admin/feature/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@myorg/modules/td-admin/data-access/lib/(.*)$':
      '<rootDir>/../data-access/src/lib/$1',
    '^@myorg/(.*)$': '<rootDir>/../../../../libs/$1/src/index.ts',
  },
  coverageDirectory: '../../../../coverage/libs/modules/td-admin/feature',
};
