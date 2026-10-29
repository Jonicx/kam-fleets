import React, { useState, useEffect } from 'react';
import {
  Truck as TruckIcon,
  Navigation2,
  Users,
  Receipt,
  Database,
  LayoutDashboard,
  BarChart3,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DatabaseStats } from '../types/database.ts';
import { UserProfileDropdown } from './UserProfileDropdown.tsx';
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
}) => {
  const [greeting, setGreeting] = useState(GREETINGS[0]);

  useEffect(() => {
    // Rotate greeting on mount
    const randomIndex = Math.floor(Math.random() * GREETINGS.length);
    setGreeting(GREETINGS[randomIndex]);
  }, []);
  const navItems = [
    { id: 'dashboard', label: 'Operations', icon: LayoutDashboard },
    { id: 'admin', label: 'Admin', icon: BarChart3 },
    { id: 'trips', label: 'Trips', icon: Navigation2, badge: stats.ongoingTrips },
    { id: 'trucks', label: 'Truck Fleet', icon: TruckIcon, badge: stats.totalTrucks },
    { id: 'drivers', label: 'Drivers', icon: Users, badge: stats.totalDrivers },
    { id: 'expenses', label: 'Expenses & Services', icon: Receipt },
  ].filter((item) => isAdmin || item.id !== 'admin');

  return (
    <header className={`${isSticky ? 'sticky' : 'relative'} top-0 z-40 bg-slate-900 border-b rounded-br-3xl sm:rounded-b-3xl border-slate-800 backdrop-blur-md text-white shadow-lg shadow-slate-900/40`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="flex flex-col items-start space-y-0.5">
              <div className="flex flex-row items-start space-x-2">
                <span className="font-extrabold text-md tracking-tight text-white">KAM</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-semibold border border-amber-500/30 shadow-md shadow-orange-500/20">
                  Fleets
                </span>
              </div>
              {userName && (
                <div className="flex items-center space-x-1">
                  <span className="text-[10px] text-slate-400">{greeting}</span>
                  <span className="text-[10px] font-semibold text-slate-300">{userName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Nav Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className="flex flex-col items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold transition-all relative"
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isActive
                            ? 'bg-slate-900 text-slate-200'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {!isActive && (
                    <span className="mt-1 flex h-1 w-8 relative">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-gradient-to-r from-blue-500 via-blue-400 to-slate-900 opacity-75"></span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick CTA Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenNewTripModal}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-sm"
            >
              <Navigation2 className="h-3.5 w-3.5 fill-current" />
              <span>Plan Trip</span>
            </button>
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

        {/* Mobile Sub-Navigation */}
        <div className="flex lg:hidden overflow-x-auto py-2 space-x-1 border-t rounded-t-sm border-slate-700 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </div>
                {isActive && (
                  <span className="mt-1 flex h-0.5 w-10 relative">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-gradient-to-r from-blue-600 via-blue-300 to-slate-900 opacity-75"></span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
