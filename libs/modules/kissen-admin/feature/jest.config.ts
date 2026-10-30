export default {
  displayName: 'modules-kissen-admin-feature',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': ['@swc/jest'],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@myorg/(.*)$': '<rootDir>/../../../../libs/$1/src/index.ts',
  },
  coverageDirectory: '../../../../coverage/libs/modules/kissen-admin/feature',
};
