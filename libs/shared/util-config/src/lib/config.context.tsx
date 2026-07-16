'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ProjectConfig } from './config.types';
import { loadProjectConfig } from './config.loader';
import { mergeWithDefaults } from './config.defaults';

// ---------------------------------------------------------------------------
// Context value
// ---------------------------------------------------------------------------

interface ConfigContextValue {
  config: ProjectConfig;
  projectId: string;
  switchProject: (projectId: string) => Promise<void>;
  isConfigLoading: boolean;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const ConfigContext = createContext<ConfigContextValue | null>(null);

interface ConfigProviderProps {
  initialConfig: ProjectConfig;
  children: ReactNode;
}

export function ConfigProvider({ initialConfig, children }: ConfigProviderProps) {
  const [config, setConfig] = useState<ProjectConfig>(initialConfig);
  const [isConfigLoading, setIsConfigLoading] = useState(false);

  const projectId = config.project.id;

  const switchProject = useCallback(async (newProjectId: string) => {
    setIsConfigLoading(true);
    try {
      const newConfig = await loadProjectConfig(newProjectId);
      setConfig(mergeWithDefaults(newConfig));
    } finally {
      setIsConfigLoading(false);
    }
  }, []);

  const value = useMemo<ConfigContextValue>(
    () => ({ config, projectId, switchProject, isConfigLoading }),
    [config, projectId, switchProject, isConfigLoading],
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Full project config. Use this when you need the entire config object. */
export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useConfig must be used within a <ConfigProvider>');
  }
  return ctx;
}

/** Convenience hook — theme section of the current config. */
export function useTheme() {
  return useConfig().config.theme;
}

/** Convenience hook — modules section of the current config. */
export function useModules() {
  return useConfig().config.modules;
}

/** Convenience hook — features / feature-flags section of the current config. */
export function useFeatures() {
  return useConfig().config.features;
}
