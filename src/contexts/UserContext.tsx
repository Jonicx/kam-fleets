import React, { createContext, useCallback, useContext, ReactNode } from 'react';

interface UserContextType {
  userName: string;
  userEmail: string;
  userRole: string;
  profilePictureId?: string;
  setUserInfo: (info: { userName: string; userEmail: string; userRole: string; profilePictureId?: string }) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [userName, setUserName] = React.useState('');
  const [userEmail, setUserEmail] = React.useState('');
  const [userRole, setUserRole] = React.useState('');
  const [profilePictureId, setProfilePictureId] = React.useState<string | undefined>();

  const setUserInfo = useCallback((info: { userName: string; userEmail: string; userRole: string; profilePictureId?: string }) => {
    setUserName(info.userName);
    setUserEmail(info.userEmail);
    setUserRole(info.userRole);
    setProfilePictureId(info.profilePictureId);
  }, []);

  return (
    <UserContext.Provider value={{ userName, userEmail, userRole, profilePictureId, setUserInfo }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
