import React from 'react';

export function TgStar({ size = 14, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      style={{ display: 'inline', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <path
        d="M12 2L14.9 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L9.1 8.26L12 2Z"
        fill="#f59e0b"
        stroke="#d97706"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
