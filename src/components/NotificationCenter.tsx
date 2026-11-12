import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { notificationsBackend } from '../neon.ts';
import type { AdminNotification } from '../types/notifications.ts';
import { useModalAccessibility } from '../hooks/useModalAccessibility.ts';

interface NotificationCenterProps {
  focusNotificationId?: string | null;
  onOpenNotification: (notification: AdminNotification) => void;
}

const categoryLabel: Record<AdminNotification['category'], string> = {
  pending_account: 'Account review',
  missing_invoice: 'Missing invoice',
  delay: 'Trip delay',
  budget_exceeded: 'Over budget',
  overdue_invoice: 'Overdue invoice',
};

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  focusNotificationId,
  onOpenNotification,
}) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isOpen, setIsOpen] = useState(Boolean(focusNotificationId));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const dialogRef = useModalAccessibility(() => setIsOpen(false), isOpen);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError('');
    try {
      setNotifications(await notificationsBackend.list());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Notifications could not be loaded.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(false), 60_000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    if (focusNotificationId) setIsOpen(true);
  }, [focusNotificationId]);

  useEffect(() => {
    if (!focusNotificationId || !isOpen) return;
    document.getElementById(`notification-${focusNotificationId}`)?.scrollIntoView({ block: 'center' });
  }, [focusNotificationId, isOpen, notifications]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogContentRef.current && !dialogContentRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read_at && !notification.resolved_at).length,
    [notifications],
  );

  const displayCount = unreadCount > 0 ? `${unreadCount} unread` : `${notifications.length} total`;

  const openNotification = async (notification: AdminNotification) => {
    if (!notification.read_at) {
      try {
        await notificationsBackend.markRead(notification.id, true);
        setNotifications((current) => current.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item,
        ));
      } catch (readError) {
        setError(readError instanceof Error ? readError.message : 'The notification could not be marked as read.');
        return;
      }
    }
    setIsOpen(false);
    onOpenNotification(notification);
  };

  const markAllRead = async () => {
    setError('');
    try {
      await notificationsBackend.markAllRead();
      const readAt = new Date().toISOString();
      setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at || readAt })));
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : 'Notifications could not be marked as read.');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsOpen(true);
          void loadNotifications();
        }}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="relative rounded-lg p-2 text-slate-200 transition hover:bg-slate-800 hover:text-white"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-950/40 px-3 pb-3 pt-20 sm:p-5">
          <section
            ref={(node) => {
              dialogRef.current = node as HTMLDivElement | null;
              dialogContentRef.current = node as HTMLDivElement | null;
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-center-title"
            tabIndex={-1}
            className="ml-auto flex max-h-[min(28rem,calc(100dvh-6rem))] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:mt-12 sm:max-h-[min(34rem,calc(100dvh-5rem))]"
          >
            <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
              <div>
                <h2 id="notification-center-title" className="text-base font-bold text-slate-900">Notifications</h2>
                <p className="text-xs text-slate-500">{displayCount}</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close notifications" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
              </button>
            </header>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
              <button type="button" onClick={() => void loadNotifications()} disabled={isLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                Refresh
              </button>
              <button type="button" onClick={() => void markAllRead()} disabled={unreadCount === 0} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Mark all read
              </button>
            </div>

            {error && <p role="alert" className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

            <div className="min-h-0 max-h-96 flex-1 overflow-y-auto p-3" aria-live="polite">
              {isLoading ? (
                <p role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Loading notifications…</p>
              ) : notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Check className="mx-auto h-8 w-8 text-emerald-500" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">You’re all caught up</p>
                  <p className="mobile-explanation mt-1 text-xs text-slate-500">New account reviews, trip delays, budget overruns, and invoice issues will appear here.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {notifications.map((notification) => (
                    <li key={notification.id}>
                      <button
                        id={`notification-${notification.id}`}
                        type="button"
                        onClick={() => void openNotification(notification)}
                        className={`w-full rounded-xl border p-2.5 text-left transition hover:border-blue-300 hover:bg-blue-50/40 ${
                          !notification.read_at ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'
                        } ${notification.id === focusNotificationId ? 'ring-2 ring-amber-400' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-xs font-bold text-slate-900">{notification.title}</span>
                          {!notification.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-snug text-slate-600">{notification.body}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                          <span className="font-semibold">{categoryLabel[notification.category]}</span>
                          <time dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString()}</time>
                        </div>
                        {notification.resolved_at && <span className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Resolved</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
};
