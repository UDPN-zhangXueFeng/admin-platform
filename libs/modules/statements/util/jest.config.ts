export default {
  displayName: 'modules-statements-util',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[tj]sx?$': ['@swc/jest'] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../../../coverage/libs/modules/statements/util',
};
