export function EyeLogo({ className = "w-7 h-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className}>
      <path
        d="M3 14 Q14 5 25 14 Q14 23 3 14 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="14" cy="14" r="4.2" fill="#1a1830" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="14" cy="14" r="1.7" fill="#080808" />
    </svg>
  );
}
