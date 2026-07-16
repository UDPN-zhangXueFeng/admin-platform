export default {
  displayName: 'modules-mmf-ui',
  preset: '../../../../jest.preset.js',
  testEnvironment: 'jsdom',
  transform: { '^.+\\.[tj]sx?$': ['@swc/jest'] },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  // next-intl ships pure ESM that @swc/jest can't transform from node_modules;
  // swap it for a CJS stub (see src/lib/__mocks__/next-intl.ts).
  // @myorg/modules/mmf/util resolves via the Nx jest resolver's tsconfig paths
  // (tsconfig.base.json), no explicit mapper needed — same as the feature lib.
  moduleNameMapper: {
    '^next-intl$': '<rootDir>/src/lib/__mocks__/next-intl.ts',
  },
  coverageDirectory: '../../../../coverage/libs/modules/mmf/ui',
};
