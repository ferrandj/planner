import type { ReactNode } from 'react';
import type { Lang } from '../types';

const FLAGS: Record<Lang, ReactNode> = {
  fr: <svg viewBox="0 0 30 20" aria-hidden="true"><rect width="10" height="20" fill="#0055A4" /><rect x="10" width="10" height="20" fill="#FFFFFF" /><rect x="20" width="10" height="20" fill="#EF4135" /></svg>,
  en: <svg viewBox="0 0 60 30" aria-hidden="true"><rect width="60" height="30" fill="#012169" /><path d="M0 0L60 30M60 0L0 30" stroke="#FFFFFF" strokeWidth="6" /><path d="M0 0L60 30M60 0L0 30" stroke="#C8102E" strokeWidth="2.5" /><path d="M30 0V30M0 15H60" stroke="#FFFFFF" strokeWidth="10" /><path d="M30 0V30M0 15H60" stroke="#C8102E" strokeWidth="6" /></svg>,
  es: <svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#AA151B" /><rect y="5" width="30" height="10" fill="#F1BF00" /></svg>
};
export const Flag = ({ lang }: { lang: Lang }): ReactNode => FLAGS[lang];
