import { useMutation, useQueryClient } from '@tanstack/react-query';
import { editRule, operateRule, processSuspicious, retrySuspicious, saveRule } from '../screening-monitoring.api';
import type { RuleOperateParams, RuleSaveParams, SuspiciousProcessParams, SuspiciousRetryParams } from '../screening-monitoring.model';
import { screeningKeys } from './screening-monitoring.keys';

export const useSaveRule = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (p: RuleSaveParams) => saveRule(p), onSuccess: () => { qc.invalidateQueries({ queryKey: screeningKeys.all }); } }); };
export const useEditRule = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (p: RuleSaveParams) => editRule(p), onSuccess: () => { qc.invalidateQueries({ queryKey: screeningKeys.all }); } }); };
export const useOperateRule = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (p: RuleOperateParams) => operateRule(p), onSuccess: () => { qc.invalidateQueries({ queryKey: screeningKeys.all }); } }); };
export const useProcessSuspicious = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (p: SuspiciousProcessParams) => processSuspicious(p), onSuccess: () => { qc.invalidateQueries({ queryKey: screeningKeys.all }); } }); };
export const useRetrySuspicious = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (p: SuspiciousRetryParams) => retrySuspicious(p), onSuccess: () => { qc.invalidateQueries({ queryKey: screeningKeys.all }); } }); };
