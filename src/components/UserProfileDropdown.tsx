import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Settings } from 'lucide-react';
import { PROFILE_PICTURES } from '../constants/profilePictures.ts';

interface UserProfileDropdownProps {
  userName: string;
  userEmail: string;
  profilePictureId?: string;
  onSignOut: () => void;
  onOpenProfile: () => void;
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  userName,
  userEmail,
  profilePictureId,
  onSignOut,
  onOpenProfile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const profilePicture = PROFILE_PICTURES.find((p) => p.id === profilePictureId) || PROFILE_PICTURES[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-8 h-8 rounded-full hover:opacity-80 transition-opacity"
        title="Profile"
        style={{ backgroundColor: profilePicture.color }}
      >
        <span className="text-sm">{profilePicture.emoji}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
          {/* Profile Info */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-full ${profilePicture.color} flex items-center justify-center text-2xl`}>
                {profilePicture.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
                <p className="text-xs text-slate-500 truncate">{userEmail}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                onOpenProfile();
                setIsOpen(false);
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings className="h-4 w-4 mr-3 text-slate-400" />
              Profile Settings
            </button>
            <button
              onClick={() => {
                onSignOut();
                setIsOpen(false);
              }}
              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-3" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
