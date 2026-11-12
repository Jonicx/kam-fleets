import React, { useCallback, useEffect, useState } from 'react';
import { X, Mail, Phone, User as UserIcon, Bell, BellOff, LoaderCircle } from 'lucide-react';
import { PROFILE_PICTURES } from '../constants/profilePictures.ts';
import { useModalAccessibility } from '../hooks/useModalAccessibility.ts';
import { notificationsBackend } from '../neon.ts';

function applicationServerKey(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
  return bytes.buffer;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  userPhone?: string;
  profilePictureId?: string;
  userRole?: string;
  onSave: (data: { name: string; email: string; phone?: string; profilePictureId: string }) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  userName,
  userEmail,
  userPhone = '',
  profilePictureId,
  userRole,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile');
  const isAdmin = userRole === 'Admin';
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(userEmail);
  const [phone, setPhone] = useState(userPhone);
  const [selectedPictureId, setSelectedPictureId] = useState(profilePictureId || PROFILE_PICTURES[0].id);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushBusy, setIsPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const dialogRef = useModalAccessibility(onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      setName(userName);
      setEmail(userEmail);
      setPhone(userPhone);
      setSelectedPictureId(profilePictureId || PROFILE_PICTURES[0].id);
    }
  }, [isOpen, userName, userEmail, userPhone, profilePictureId]);

  useEffect(() => {
    if (!isOpen) return;
    const checkPushSubscription = async () => {
      try {
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const registration = await navigator.serviceWorker.ready;
          const existing = await registration.pushManager.getSubscription();
          setIsPushEnabled(!!existing);
        }
      } catch {
        setIsPushEnabled(false);
      }
    };
    void checkPushSubscription();
  }, [isOpen]);

  const togglePush = useCallback(async () => {
    setIsPushBusy(true);
    setPushError('');
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        throw new Error('Push notifications are not supported by this browser.');
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        if (isPushEnabled) {
          await notificationsBackend.removePushSubscription(existing.endpoint);
          await existing.unsubscribe();
          setIsPushEnabled(false);
          return;
        }
        await notificationsBackend.savePushSubscription(existing.toJSON());
        setIsPushEnabled(true);
        return;
      }

      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') throw new Error('Allow notifications in your browser settings to receive push alerts.');

      const publicKey = await notificationsBackend.getPushPublicKey();
      if (!publicKey) throw new Error('Push alerts are not configured on the server yet. The in-app notification center remains available.');
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey(publicKey),
      });
      await notificationsBackend.savePushSubscription(subscription.toJSON());
      setIsPushEnabled(true);
    } catch (pushError) {
      setPushError(pushError instanceof Error ? pushError.message : 'Push alerts could not be updated.');
    } finally {
      setIsPushBusy(false);
    }
  }, [isPushEnabled]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave({ name, email, phone, profilePictureId: selectedPictureId });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="profile-modal-title" tabIndex={-1} className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 id="profile-modal-title" className="text-xl font-bold text-slate-900">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'profile'
                ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Profile
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'notifications'
                  ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Notifications
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'profile' ? (
            <div className="space-y-6">
              {/* Profile Picture Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Profile Picture
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {PROFILE_PICTURES.map((pic) => (
                    <button
                      key={pic.id}
                      onClick={() => setSelectedPictureId(pic.id)}
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-all ${
                        selectedPictureId === pic.id
                          ? `${pic.color} ring-4 ring-offset-2 ring-slate-900 scale-110`
                          : `${pic.color} hover:scale-105`
                      }`}
                      title={pic.name}
                    >
                      {pic.emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
                    placeholder="Enter your email"
                  />
                  <p className="mt-1 text-xs text-slate-500">Email is managed by your authentication provider</p>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Phone Number (Optional)
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                    placeholder="Enter your phone number"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Push Notifications Card */}
              <div className="border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Bell className="h-5 w-5 text-slate-700" />
                      <h3 className="text-sm font-semibold text-slate-900">Push Notifications</h3>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      Receive browser push notifications for account reviews, trip delays, budget alerts, and invoice issues.
                    </p>
                    {pushError && (
                      <p role="alert" className="text-xs font-semibold text-rose-700 mb-2">{pushError}</p>
                    )}
                  </div>
                  <button
                    onClick={() => void togglePush()}
                    disabled={isPushBusy}
                    className={`ml-4 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                      isPushEnabled
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isPushBusy ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : isPushEnabled ? (
                      <>
                        <BellOff className="h-4 w-4 inline mr-1" />
                        Disable
                      </>
                    ) : (
                      <>
                        <Bell className="h-4 w-4 inline mr-1" />
                        Enable
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer - only show on Profile tab */}
        {activeTab === 'profile' && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors shadow-sm"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
