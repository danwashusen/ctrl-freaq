import React from 'react';

type AvatarProps = {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeMap = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

export default function Avatar({ name, imageUrl, size = 'md', className = '' }: AvatarProps) {
  const initials = React.useMemo(() => {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
    return (first + last).toUpperCase();
  }, [name]);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`${sizeMap[size]} inline-block rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-label={name}
      className={`${sizeMap[size]} inline-flex items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-700 ${className}`}
    >
      {initials}
    </div>
  );
}
