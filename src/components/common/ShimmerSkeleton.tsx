import React from 'react';

interface ShimmerSkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export const ShimmerSkeleton: React.FC<ShimmerSkeletonProps> = ({
  className = '',
  style,
}) => {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-[8px] ${className}`}
      style={style}
    />
  );
};

export const ChatListSkeleton: React.FC = () => {
  return (
    <div className="p-3 space-y-3" aria-busy="true" aria-label="Loading conversations">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <ShimmerSkeleton className="w-10 h-10 rounded-[10px] flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <ShimmerSkeleton className="h-3.5 w-28" />
              <ShimmerSkeleton className="h-3 w-10" />
            </div>
            <ShimmerSkeleton className="h-3 w-40" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const MessageAreaSkeleton: React.FC = () => {
  return (
    <div className="flex-1 p-6 space-y-4" aria-busy="true" aria-label="Loading messages">
      <div className="flex justify-start">
        <div className="flex items-end gap-2.5 max-w-[65%]">
          <ShimmerSkeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <ShimmerSkeleton className="h-16 w-64 rounded-[14px] rounded-bl-[4px]" />
        </div>
      </div>
      <div className="flex justify-end">
        <ShimmerSkeleton className="h-12 w-48 rounded-[14px] rounded-br-[4px]" />
      </div>
      <div className="flex justify-start">
        <div className="flex items-end gap-2.5 max-w-[65%]">
          <ShimmerSkeleton className="w-8 h-8 rounded-full flex-shrink-0" />
          <ShimmerSkeleton className="h-20 w-72 rounded-[14px] rounded-bl-[4px]" />
        </div>
      </div>
      <div className="flex justify-end">
        <ShimmerSkeleton className="h-16 w-56 rounded-[14px] rounded-br-[4px]" />
      </div>
    </div>
  );
};
