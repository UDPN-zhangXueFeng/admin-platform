// util-config barrel
export type {
  ProjectConfig,
  ModuleMenuItem,
  DashboardWidget,
} from './lib/config.types';

export { ProjectConfigSchema } from './lib/config.schema';

export { defaultConfig, mergeWithDefaults } from './lib/config.defaults';

export { loadProjectConfig, getAvailableProjects } from './lib/config.loader';

export {
  ConfigProvider,
  useConfig,
  useTheme,
  useModules,
  useFeatures,
} from './lib/config.context';
