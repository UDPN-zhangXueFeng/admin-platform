export default {
  displayName: 'modules-cross-chain-ui',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[tj]sx?$': ['@swc/jest'] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // next-intl ships pure ESM that @swc/jest can't transform from node_modules;
  // swap it for a CJS stub (see src/lib/__mocks__/next-intl.ts).
  moduleNameMapper: {
    '^next-intl$': '<rootDir>/src/lib/__mocks__/next-intl.ts',
  },
  coverageDirectory: '../../../../coverage/libs/modules/cross-chain/ui',
};
