/** Bank-interact query key factory (project-scoped cache isolation). */
export const bankInteractKeys = {
  all: (projectId: string) => ['project', projectId, 'bank-interact'] as const,
  view: (projectId: string, bankId: number) =>
    [...bankInteractKeys.all(projectId), 'view', bankId] as const,
} as const;
