"use client";

// Small flat icons for the action buttons — plain currentColor strokes/fills
// so they inherit each button's text color automatically.

export function HitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <rect x="3" y="5" width="11" height="15" rx="1.5" fill="currentColor" opacity="0.92" />
      <rect x="9" y="3" width="11" height="15" rx="1.5" fill="currentColor" stroke="currentColor" strokeOpacity="0.4" transform="rotate(12 14.5 10.5)" opacity="0.55" />
    </svg>
  );
}

export function StandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <rect x="5" y="11" width="14" height="9" rx="4" fill="currentColor" opacity="0.92" />
      <rect x="6.5" y="3" width="3" height="10" rx="1.5" fill="currentColor" />
      <rect x="10.5" y="2" width="3" height="11" rx="1.5" fill="currentColor" />
      <rect x="14.5" y="3" width="3" height="10" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function DoubleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <ellipse cx="12" cy="17.5" rx="7.5" ry="2.4" fill="currentColor" opacity="0.5" />
      <ellipse cx="12" cy="13.5" rx="7.5" ry="2.4" fill="currentColor" opacity="0.7" />
      <ellipse cx="12" cy="9.5" rx="7.5" ry="2.4" fill="currentColor" opacity="0.9" />
      <ellipse cx="12" cy="6" rx="7.5" ry="2.4" fill="currentColor" />
    </svg>
  );
}

export function SplitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M12 3 L5 12 L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3 L19 12 L19 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="3" r="1.8" fill="currentColor" />
      <circle cx="5" cy="21" r="1.8" fill="currentColor" />
      <circle cx="19" cy="21" r="1.8" fill="currentColor" />
    </svg>
  );
}
