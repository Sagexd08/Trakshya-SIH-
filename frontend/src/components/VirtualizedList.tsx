"use client";
import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number | ((index: number) => number);
  renderItem: (item: T, index: number, isVisible: boolean) => React.ReactNode;
  className?: string;
  containerHeight?: number;
  overscan?: number;
  onItemClick?: (item: T, index: number) => void;
  onScroll?: (scrollTop: number, scrollDirection: 'up' | 'down') => void;
  loading?: boolean;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  enableAnimation?: boolean;
  searchQuery?: string;
  filterFn?: (item: T, query: string) => boolean;
  sortFn?: (a: T, b: T) => number;
  groupBy?: (item: T) => string;
  stickyHeaders?: boolean;
}

// Discriminated union for internal list items
type ListEntry<T> =
  | { type: 'header'; data: string }
  | { type: 'item'; data: T; originalIndex?: number };


export interface VirtualizedTrainListProps {
  trains: Array<{
    id: string;
    name: string;
    status: 'on-time' | 'delayed' | 'cancelled';
    delay: number;
    position: { lat: number; lng: number };
    speed: number;
    route: string;
    nextStation: string;
    eta: Date;
  }>;
  onTrainSelect?: (trainId: string) => void;
  searchQuery?: string;
  statusFilter?: string[];
}

// Generic virtualized list component
export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  className,
  containerHeight = 400,
  overscan = 5,
  onItemClick,
  onScroll,
  loading = false,
  loadingComponent,
  emptyComponent,
  enableAnimation = true,
  searchQuery = '',
  filterFn,
  sortFn,
  groupBy,
  stickyHeaders = false,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  const lastScrollTop = useRef(0);

  // Filter and sort items
  const processedItems = useMemo(() => {
    let filtered = items;

    // Apply search filter
    if (searchQuery && filterFn) {
      filtered = filtered.filter(item => filterFn(item, searchQuery));
    }

    // Apply sorting
    if (sortFn) {
      filtered = [...filtered].sort(sortFn);
    }

    return filtered;
  }, [items, searchQuery, filterFn, sortFn]);

  // Group items if groupBy is provided
  const groupedItems = useMemo(() => {
    if (!groupBy) return processedItems;

    const groups = processedItems.reduce((acc, item, index) => {
      const groupKey = groupBy(item);
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push({ item, originalIndex: index });
      return acc;
    }, {} as Record<string, Array<{ item: T; originalIndex: number }>>);

    // Flatten groups with headers
    const flattened: Array<ListEntry<T>> = [];
    Object.entries(groups).forEach(([groupKey, groupItems]) => {
      flattened.push({ type: 'header', data: groupKey });
      groupItems.forEach(({ item, originalIndex }) => {
        flattened.push({ type: 'item', data: item, originalIndex });
      });
    });

    return flattened;
  }, [processedItems, groupBy]);

  const finalItems: Array<ListEntry<T>> = groupBy
    ? (groupedItems as Array<ListEntry<T>>)
    : processedItems.map(item => ({ type: 'item', data: item }));

  // Virtualization
  const virtualizer = useVirtualizer({
    count: finalItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((index: number) => {
      if (groupBy && finalItems[index]?.type === 'header') {
        return 40; // Header height
      }
      return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight;
    }, [itemHeight, groupBy, finalItems]),
    overscan,
  });

  // Handle scroll events
  useEffect(() => {
    const element = parentRef.current;
    if (!element || !onScroll) return;

    const handleScroll = () => {
      const scrollTop = element.scrollTop;
      const direction = scrollTop > lastScrollTop.current ? 'down' : 'up';
      setScrollDirection(direction);
      lastScrollTop.current = scrollTop;
      onScroll(scrollTop, direction);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [onScroll]);

  // Loading state
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ height: containerHeight }}>
        {loadingComponent || (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-neutral-400">Loading...</span>
          </div>
        )}
      </div>
    );
  }

  // Empty state
  if (finalItems.length === 0) {
    return (
      <div className={cn("flex items-center justify-center", className)} style={{ height: containerHeight }}>
        {emptyComponent || (
          <div className="text-center">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-neutral-400">No items found</p>
            {searchQuery && (
              <p className="text-sm text-neutral-500 mt-1">
                Try adjusting your search criteria
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <AnimatePresence mode="popLayout">
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = finalItems[virtualItem.index];
            const isHeader = item?.type === 'header';
            const isVisible = true; // All virtualized items are considered visible

            return (
              <motion.div
                key={virtualItem.key}
                initial={enableAnimation ? { opacity: 0, y: 20 } : undefined}
                animate={{ opacity: 1, y: 0 }}
                exit={enableAnimation ? { opacity: 0, y: -20 } : undefined}
                transition={{ duration: 0.2, delay: virtualItem.index * 0.01 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className={cn(
                  isHeader && stickyHeaders && "sticky top-0 z-10 bg-neutral-900 border-b border-neutral-700"
                )}
              >
                {isHeader ? (
                  <div className="flex items-center px-4 py-2 font-medium text-neutral-300 bg-neutral-800">
                    <span className="text-sm uppercase tracking-wide">{item.data}</span>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "cursor-pointer transition-colors hover:bg-neutral-800/50",
                      onItemClick && "cursor-pointer"
                    )}
                    onClick={() => {
                      if (onItemClick && !isHeader) {
                        onItemClick(item.data, item.originalIndex || virtualItem.index);
                      }
                    }}
                  >
                    {renderItem(item.data, item.originalIndex || virtualItem.index, isVisible)}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Specialized train list component
export function VirtualizedTrainList({
  trains,
  onTrainSelect,
  searchQuery = '',
  statusFilter = [],
}: VirtualizedTrainListProps) {
  const filterFn = useCallback((train: any, query: string) => {
    const matchesSearch = train.name.toLowerCase().includes(query.toLowerCase()) ||
                         train.id.toLowerCase().includes(query.toLowerCase()) ||
                         train.route.toLowerCase().includes(query.toLowerCase());

    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(train.status);

    return matchesSearch && matchesStatus;
  }, [statusFilter]);

  const sortFn = useCallback((a: any, b: any) => {
    // Sort by status priority (delayed first, then on-time, then cancelled)
    const statusPriority = { delayed: 0, 'on-time': 1, cancelled: 2 };
    const aPriority = statusPriority[a.status as keyof typeof statusPriority];
    const bPriority = statusPriority[b.status as keyof typeof statusPriority];

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Then sort by delay (highest first)
    return b.delay - a.delay;
  }, []);

  const groupByFn = useCallback((train: any) => {
    return train.status.charAt(0).toUpperCase() + train.status.slice(1);
  }, []);

  const renderTrainItem = useCallback((train: any, index: number, isVisible: boolean) => {
    const statusColors = {
      'on-time': 'text-green-400',
      delayed: 'text-red-400',
      cancelled: 'text-gray-400',
    };

    const statusBgColors = {
      'on-time': 'bg-green-400/10',
      delayed: 'bg-red-400/10',
      cancelled: 'bg-gray-400/10',
    };

    return (
      <div className="flex items-center justify-between p-4 border-b border-neutral-800 last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className={cn(
                "w-3 h-3 rounded-full",
                train.status === 'on-time' ? 'bg-green-400' :
                train.status === 'delayed' ? 'bg-red-400' : 'bg-gray-400'
              )} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-medium text-white truncate">
                  {train.name}
                </h3>
                <span className="text-xs text-neutral-500">#{train.id}</span>
              </div>

              <div className="flex items-center space-x-4 mt-1">
                <span className="text-xs text-neutral-400 truncate">
                  {train.route}
                </span>
                <span className="text-xs text-neutral-400">
                  → {train.nextStation}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 flex-shrink-0">
          <div className="text-right">
            <div className={cn("text-xs font-medium", statusColors[(train.status as keyof typeof statusColors)])}>
              {train.status.replace('-', ' ').toUpperCase()}
            </div>
            {train.delay > 0 && (
              <div className="text-xs text-red-400">
                +{train.delay}m
              </div>
            )}
          </div>

          <div className="text-right">
            <div className="text-xs text-neutral-400">
              {train.speed} km/h
            </div>
            <div className="text-xs text-neutral-500">
              ETA: {train.eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className={cn(
            "px-2 py-1 rounded text-xs font-medium",
            statusBgColors[(train.status as keyof typeof statusBgColors)],
            statusColors[(train.status as keyof typeof statusColors)]
          )}>
            {train.status === 'on-time' ? '✓' :
             train.status === 'delayed' ? '⚠' : '✕'}
          </div>
        </div>
      </div>
    );
  }, []);

  return (
    <VirtualizedList
      items={trains}
      itemHeight={80}
      renderItem={renderTrainItem}
      containerHeight={600}
      searchQuery={searchQuery}
      filterFn={filterFn}
      sortFn={sortFn}
      groupBy={groupByFn}
      stickyHeaders={true}
      enableAnimation={true}
      onItemClick={(train) => onTrainSelect?.(train.id)}
      className="bg-neutral-900 border border-neutral-700 rounded-lg"
      emptyComponent={
        <div className="text-center py-8">
          <div className="text-4xl mb-2">🚂</div>
          <p className="text-neutral-400">No trains found</p>
          <p className="text-sm text-neutral-500 mt-1">
            Try adjusting your search or filter criteria
          </p>
        </div>
      }
      loadingComponent={
        <div className="flex items-center justify-center space-x-2">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-neutral-400">Loading trains...</span>
        </div>
      }
    />
  );
}
