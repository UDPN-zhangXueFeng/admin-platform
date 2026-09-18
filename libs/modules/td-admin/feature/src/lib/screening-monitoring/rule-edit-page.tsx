'use client';
import dynamic from 'next/dynamic';
const RuleEditContent = dynamic(() => import('./rule-edit-content').then(m => ({ default: m.RuleEditContent })), { ssr: false });
export function RuleEditPage() { return <RuleEditContent />; }
