const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
  'aria-hidden': true,
};

export const GripIcon = () => (
  <svg {...base}><circle cx="9" cy="6" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="18" r="1" /></svg>
);
export const UpIcon = () => <svg {...base}><path d="M12 19V5M5 12l7-7 7 7" /></svg>;
export const DownIcon = () => <svg {...base}><path d="M12 5v14M19 12l-7 7-7-7" /></svg>;
export const TrashIcon = () => (
  <svg {...base}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>
);
export const CloseIcon = () => <svg {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const LeftIcon = () => <svg {...base}><path d="M15 18l-6-6 6-6" /></svg>;
export const RightIcon = () => <svg {...base}><path d="M9 18l6-6-6-6" /></svg>;
export const LockIcon = () => (
  <svg {...base}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
);
export const CheckIcon = () => <svg {...base}><path d="M20 6L9 17l-5-5" /></svg>;
export const UploadIcon = () => (
  <svg {...base}><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
);
export const MailIcon = () => (
  <svg {...base}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
);

export const Mark = () => (
  <svg className="wordmark-mark" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="25" cy="32" r="14" fill="none" stroke="#1B1A17" strokeWidth="3.5" />
    <circle cx="39" cy="32" r="14" fill="none" stroke="#8A6A2F" strokeWidth="3.5" />
  </svg>
);
