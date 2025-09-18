/**
 * Enhanced Notification Center
 * Real-time notification management with advanced filtering and actions
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector, useAppDispatch } from '@/store';
import {
  selectNotifications,
  selectUnreadCount,
  selectFilteredNotifications,
  markAsRead,
  markAllAsRead,
  removeNotification,
  setFilters,
  togglePanel,
  acknowledgeNotification,
} from '@/store/slices/notificationSlice';
import { selectUser } from '@/store/slices/authSlice';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  X,
  Filter,
  Settings,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Zap,
  Train,
  Shield,
  Wrench,
  MoreVertical,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// Notification icon mapping
const notificationIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
  emergency: AlertTriangle,
};

const categoryIcons = {
  system: Settings,
  train: Train,
  conflict: AlertTriangle,
  energy: Zap,
  maintenance: Wrench,
  security: Shield,
};

const priorityColors = {
  low: 'text-blue-400 border-blue-400/30',
  medium: 'text-yellow-400 border-yellow-400/30',
  high: 'text-orange-400 border-orange-400/30',
  critical: 'text-red-400 border-red-400/30',
};

const typeColors = {
  info: 'text-blue-400',
  success: 'text-green-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  emergency: 'text-red-500',
};

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(selectFilteredNotifications);
  const unreadCount = useAppSelector(selectUnreadCount);
  const user = useAppSelector(selectUser);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);

  // Auto-mark notifications as read when viewed
  useEffect(() => {
    if (isOpen && notifications.length > 0) {
      const timer = setTimeout(() => {
        const unreadIds = notifications
          .filter(n => !n.read)
          .slice(0, 5) // Mark first 5 as read
          .map(n => n.id);
        
        unreadIds.forEach(id => {
          dispatch(markAsRead(id));
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isOpen, notifications, dispatch]);

  const handleMarkAllRead = () => {
    dispatch(markAllAsRead());
  };

  const handleAcknowledge = (notificationId: string) => {
    if (user?.id) {
      dispatch(acknowledgeNotification({
        id: notificationId,
        userId: user.id,
      }));
    }
  };

  const handleFilterChange = (type: 'category' | 'priority', value: string | null) => {
    if (type === 'category') {
      setSelectedCategory(value);
      dispatch(setFilters({
        categories: value ? [value] : [],
      }));
    } else {
      setSelectedPriority(value);
      dispatch(setFilters({
        priorities: value ? [value] : [],
      }));
    }
  };

  const getNotificationIcon = (notification: any) => {
    const typeKey = (notification?.type ?? 'info') as keyof typeof notificationIcons;
    const categoryKey = (notification?.category ?? 'system') as keyof typeof categoryIcons;
    const TypeIcon = notificationIcons[typeKey];
    const CategoryIcon = categoryIcons[categoryKey];
    return TypeIcon || CategoryIcon || Info;
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-4 top-20 w-96 max-h-[80vh] z-50"
    >
      <Card className="bg-neutral-900/95 border-neutral-800 backdrop-blur-sm shadow-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-cyan-400" />
              <CardTitle className="text-lg">Notifications</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Filter className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleFilterChange('category', null)}>
                    All Categories
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {Object.keys(categoryIcons).map((category) => (
                    <DropdownMenuItem
                      key={category}
                      onClick={() => handleFilterChange('category', category)}
                      className={cn(selectedCategory === category && "bg-neutral-800")}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck className="h-4 w-4" />
              </Button>
              
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[60vh]">
            <div className="space-y-2 p-4">
              <AnimatePresence>
                {notifications.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-neutral-400"
                  >
                    <BellOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No notifications</p>
                  </motion.div>
                ) : (
                  notifications.map((notification, index) => {
                    const Icon = getNotificationIcon(notification);
                    
                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -100 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                          "p-3 rounded-lg border transition-all duration-200 hover:bg-neutral-800/50",
                          notification.read 
                            ? "bg-neutral-900/30 border-neutral-800" 
                            : "bg-neutral-800/50 border-neutral-700",
                          notification.priority === 'critical' && "border-red-500/30 bg-red-500/5"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "p-1.5 rounded-full flex-shrink-0",
                            notification.priority === 'critical' ? "bg-red-500/20" : "bg-neutral-800"
                          )}>
                            <Icon className={cn(
                              "h-4 w-4",
                              typeColors[(notification.type as keyof typeof typeColors) ?? 'info']
                            )} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <h4 className={cn(
                                  "font-medium text-sm",
                                  notification.read ? "text-neutral-300" : "text-white"
                                )}>
                                  {notification.title}
                                </h4>
                                <p className={cn(
                                  "text-xs mt-1",
                                  notification.read ? "text-neutral-500" : "text-neutral-400"
                                )}>
                                  {notification.message}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-xs", priorityColors[notification.priority])}
                                >
                                  {notification.priority}
                                </Badge>
                                
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {!notification.read && (
                                      <DropdownMenuItem onClick={() => dispatch(markAsRead(notification.id))}>
                                        <Check className="h-4 w-4 mr-2" />
                                        Mark as read
                                      </DropdownMenuItem>
                                    )}
                                    {!notification.acknowledgedBy && (
                                      <DropdownMenuItem onClick={() => handleAcknowledge(notification.id)}>
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Acknowledge
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem 
                                      onClick={() => dispatch(removeNotification(notification.id))}
                                      className="text-red-400"
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Remove
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-neutral-500">
                                {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                              </span>
                              
                              {notification.acknowledgedBy && (
                                <span className="text-xs text-green-400">
                                  ✓ Acknowledged
                                </span>
                              )}
                            </div>
                            
                            {notification.actions && notification.actions.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {notification.actions.map((action) => (
                                  <Button
                                    key={action.id}
                                    variant={action.variant === 'primary' ? 'default' : 'outline'}
                                    size="sm"
                                    className="h-7 text-xs"
                                  >
                                    {action.label}
                                  </Button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </motion.div>
  );
}
