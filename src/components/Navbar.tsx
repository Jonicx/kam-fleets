import React, { useState, useEffect, useRef } from 'react';
import {
  Truck as TruckIcon,
  Navigation2,
  Users,
  Building2,
  Receipt,
  LayoutDashboard,
  BarChart3,
} from 'lucide-react';
import { DatabaseStats } from '../types/database.ts';
import { UserProfileDropdown } from './UserProfileDropdown.tsx';
import { NotificationCenter } from './NotificationCenter.tsx';
import type { AdminNotification } from '../types/notifications.ts';
import { GREETINGS } from '../constants/profilePictures.ts';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  stats: DatabaseStats;
  onResetDb: () => void;
  onOpenNewTripModal: () => void;
  isSticky?: boolean;
  isAdmin?: boolean;
  userName?: string;
  userEmail?: string;
  profilePictureId?: string;
  onSignOut?: () => void;
  onOpenProfile?: () => void;
  notificationFocusId?: string | null;
  onOpenNotification?: (notification: AdminNotification) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  stats,
  onResetDb,
  onOpenNewTripModal,
  isSticky = true,
  isAdmin = true,
  userName = '',
  userEmail = '',
  profilePictureId,
  onSignOut,
  onOpenProfile,
  notificationFocusId,
  onOpenNotification,
}) => {
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [moreMenuPlacement, setMoreMenuPlacement] = useState<'desktop' | 'medium' | 'mobile' | null>(null);
  const [featuredMoreTab, setFeaturedMoreTab] = useState<string | null>(null);
  const [mobileMorePosition, setMobileMorePosition] = useState({ left: 16, top: 112 });

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * GREETINGS.length);
    setGreeting(GREETINGS[randomIndex]);
  }, []);

  const navItems = [
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: BarChart3 }] : []),
    { id: 'dashboard', label: 'Operations', icon: LayoutDashboard },
    { id: 'trips', label: 'Trips', icon: Navigation2, badge: stats.ongoingTrips },
    { id: 'trucks', label: 'Truck Fleet', icon: TruckIcon, badge: stats.totalTrucks },
    { id: 'drivers', label: 'Drivers', icon: Users, badge: stats.totalDrivers },
    { id: 'clients', label: 'Clients', icon: Building2 },
    { id: 'expenses', label: 'Expenses & Services', icon: Receipt },
  ];
  const basePrimaryNavItems = navItems.filter((item) =>
    (isAdmin ? ['admin', 'trips', 'expenses'] : ['dashboard', 'trips', 'expenses']).includes(item.id),
  );
  const featuredNavItem = navItems.find((item) => item.id === featuredMoreTab);
  const primaryNavItems = basePrimaryNavItems.map((item) =>
    item.id === 'expenses' && featuredNavItem ? featuredNavItem : item,
  );
  const moreNavItems = navItems.filter((item) => !primaryNavItems.includes(item));

  useEffect(() => {
    if (!isMoreOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-navbar-more]')) {
        setIsMoreOpen(false);
        setMoreMenuPlacement(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
        setMoreMenuPlacement(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreOpen, moreMenuPlacement]);

  const navigateToHome = () => setActiveTab(isAdmin ? 'admin' : 'dashboard');
  const renderNavItem = (item: (typeof navItems)[number], isMoreItem = false) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          setActiveTab(item.id);
          if (isMoreItem) {
            setFeaturedMoreTab(item.id === 'expenses' ? null : item.id);
          }
          setIsMoreOpen(false);
          setMoreMenuPlacement(null);
        }}
        aria-current={isActive ? 'page' : undefined}
        title={isMoreItem ? item.label : undefined}
        className={`flex items-center gap-2 overflow-hidden whitespace-nowrap rounded-lg py-2 text-xs font-semibold transition-colors ${
          isMoreItem
            ? 'w-full min-w-0 border border-slate-700 bg-slate-800/70 px-2 text-slate-200 hover:border-slate-500 hover:bg-slate-700 hover:text-white'
            : `shrink-0 px-3 ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={isMoreItem ? 'min-w-0 flex-1 truncate' : undefined}>{item.label}</span>
        {item.badge !== undefined && (
          <span className="shrink-0 rounded-full border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const renderMoreMenu = (placement: 'desktop' | 'medium' | 'mobile') => {
    if (!moreNavItems.length) return null;
    const menuId = `navbar-more-destinations-${placement}`;
    const isOpen = isMoreOpen && moreMenuPlacement === placement;

    return (
      <div className="relative shrink-0" data-navbar-more>
        <button
          type="button"
          onClick={(event) => {
            if (placement === 'mobile') {
              const rect = event.currentTarget.getBoundingClientRect();
              const panelWidth = Math.min(288, window.innerWidth - 32);
              setMobileMorePosition({
                left: Math.max(16, Math.min(rect.left, window.innerWidth - panelWidth - 16)),
                top: rect.bottom + 8,
              });
            }
            setIsMoreOpen(!isOpen);
            setMoreMenuPlacement(isOpen ? null : placement);
          }}
          aria-expanded={isOpen}
          aria-controls={menuId}
          aria-label="More destinations"
          className="flex shrink-0 items-center gap-2 rounded-xl border-0 bg-transparent px-3 py-2 text-xs font-bold text-slate-200 shadow-none transition-colors hover:bg-white/5 hover:text-white"
        >
          <span className="flex items-center gap-0.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          </span>
          <span>More</span>
        </button>
        {isOpen && (
          <div
            id={menuId}
            role="region"
            aria-label="More destinations"
            style={placement === 'mobile'
              ? {
                  position: 'fixed',
                  top: mobileMorePosition.top,
                  left: mobileMorePosition.left,
                  width: 'min(18rem, calc(100vw - 2rem))',
                  maxHeight: '70vh',
                  overflowY: 'auto',
                }
              : undefined}
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl shadow-slate-950/40"
          >
            <div className="grid grid-cols-2 gap-2">
              {moreNavItems.map((item) => renderNavItem(item, true))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <header className={`${isSticky ? 'sticky' : 'relative'} top-0 z-40 bg-slate-900 border-b rounded-br-3xl sm:rounded-b-3xl border-slate-800 backdrop-blur-md text-white shadow-lg shadow-slate-900/40`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <button type="button" className="flex items-center space-x-3 text-left" onClick={navigateToHome} aria-label="Go to home dashboard">
            <img
              src={`${import.meta.env.BASE_URL}brand-logo.png`}
              alt="KAM Fleets"
              className="h-12 w-[80px] shrink-0 object-contain sm:h-14 sm:w-[100px]"
            />
            {userName && (
              <div className="flex-col items-start space-y-0.5 flex">
                <span className="text-[10px] text-slate-400">{greeting}</span>
                <span className="text-[10px] font-semibold text-slate-300">{userName}</span>
              </div>
            )}
          </button>

          <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-1">
            {primaryNavItems.map((item) => renderNavItem(item))}
            {renderMoreMenu('desktop')}
          </nav>

          <div className="flex items-center space-x-2">
            {isAdmin && onOpenNotification && (
              <NotificationCenter
                focusNotificationId={notificationFocusId}
                onOpenNotification={onOpenNotification}
              />
            )}
            {onSignOut && onOpenProfile && (
              <UserProfileDropdown
                userName={userName}
                userEmail={userEmail}
                profilePictureId={profilePictureId}
                onSignOut={onSignOut}
                onOpenProfile={onOpenProfile}
              />
            )}
          </div>
        </div>

        <nav aria-label="Primary navigation" className="hidden md:flex lg:hidden items-center gap-1 overflow-x-auto py-2 border-t border-slate-700">
          {primaryNavItems.map((item) => renderNavItem(item))}
          {renderMoreMenu('medium')}
        </nav>

        <nav aria-label="Primary navigation" className="flex md:hidden overflow-x-auto py-2 space-x-1 border-t rounded-t-sm border-slate-700 scrollbar-none">
          {primaryNavItems.map((item) => renderNavItem(item))}
          {renderMoreMenu('mobile')}
        </nav>
      </div>
    </header>
  );
};
