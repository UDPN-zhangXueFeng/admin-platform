function isValidPageComponent(value: unknown): boolean {
  if (typeof value === 'function') return true;
  return typeof value === 'object' && value !== null && '$$typeof' in value;
}
function featurePage(name: string): PageLoader {
  return () =>
    import('@myorg/modules/kissen-gateway/feature').then((m) => {
      const Comp = (m as unknown as Record<string, unknown>)[name];
      if (!isValidPageComponent(Comp)) {
        throw new Error(
          `[kissen-gateway] feature export "${name}" is missing or not a component`,
        );
      }
      return { default: Comp as ComponentType<unknown> };
    });
}
