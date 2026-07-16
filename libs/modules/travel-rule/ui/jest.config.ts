export default {
  displayName: 'modules-travel-rule-ui',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[tj]sx?$': ['@swc/jest'],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^@myorg/(.*)$': '<rootDir>/../../../../libs/$1/src/index.ts',
  },
  coverageDirectory: '../../../../coverage/libs/modules/travel-rule/ui',
};
