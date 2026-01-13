'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface GuestSession {
  sessionId: string;
  temporaryId: string;
  guestUserId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  preferences?: any;
  cartItems?: any[];
  expiresAt: string;
}

interface GuestContextType {
  session: GuestSession | null;
  isGuest: boolean;
  createGuestSession: (email?: string) => Promise<GuestSession>;
  getGuestSession: () => Promise<GuestSession | null>;
  updateGuestPreferences: (preferences: any) => Promise<void>;
  saveGuestCart: (cartItems: any[]) => Promise<void>;
  convertToAccount: (data: any) => Promise<any>;
  clearGuestSession: () => void;
}

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export function GuestSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<GuestSession | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Load guest session from localStorage on mount
    const loadSession = async () => {
      const savedSessionId = localStorage.getItem('guestSessionId');
      if (savedSessionId) {
        try {
          const response = await fetch(`/api/user?endpoint=guest-session&sessionId=${savedSessionId}`);
          if (response.ok) {
            const sessionData = await response.json();
            setSession(sessionData);
          }
        } catch (error) {
          console.error('Failed to load guest session:', error);
          localStorage.removeItem('guestSessionId');
        }
      }
    };
    loadSession();
  }, []);

  const createGuestSession = async (email?: string): Promise<GuestSession> => {
    try {
      const response = await fetch('/api/user?endpoint=guest-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          deviceId: navigator.userAgent,
          userAgent: navigator.userAgent
        })
      });
      
      if (!response.ok) throw new Error('Failed to create guest session');
      
      const sessionData = await response.json();
      localStorage.setItem('guestSessionId', sessionData.sessionId);
      setSession(sessionData);
      
      return sessionData;
    } catch (error) {
      console.error('Error creating guest session:', error);
      throw error;
    }
  };

  const getGuestSession = async (): Promise<GuestSession | null> => {
    const sessionId = localStorage.getItem('guestSessionId');
    if (!sessionId) return null;
    
    try {
      const response = await fetch(`/api/user?endpoint=guest-session&sessionId=${sessionId}`);
      if (!response.ok) throw new Error('Failed to get guest session');
      
      const sessionData = await response.json();
      setSession(sessionData);
      return sessionData;
    } catch (error) {
      console.error('Error getting guest session:', error);
      localStorage.removeItem('guestSessionId');
      return null;
    }
  };

  const updateGuestPreferences = async (preferences: any) => {
    if (!session) return;
    
    try {
      const response = await fetch('/api/user?endpoint=guest-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: session.sessionId,
          preferences 
        })
      });
      
      if (!response.ok) throw new Error('Failed to update preferences');
      
      const updated = await response.json();
      setSession(prev => prev ? { ...prev, preferences: updated.preferences } : null);
    } catch (error) {
      console.error('Error updating preferences:', error);
    }
  };

  const saveGuestCart = async (cartItems: any[]) => {
    if (!session) return;
    
    try {
      await fetch('/api/user?endpoint=guest-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: session.sessionId,
          cartItems 
        })
      });
    } catch (error) {
      console.error('Error saving cart:', error);
    }
  };

  const convertToAccount = async (userData: any) => {
    if (!session) throw new Error('No guest session found');
    
    const response = await fetch('/api/user?endpoint=guest-convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.sessionId,
        ...userData
      })
    });
    
    if (!response.ok) throw new Error('Failed to convert account');
    
    const result = await response.json();
    
    // Clear guest session
    localStorage.removeItem('guestSessionId');
    setSession(null);
    
    // Save new user token
    if (result.accessToken) {
      localStorage.setItem('token', result.accessToken);
      localStorage.setItem('refreshToken', result.refreshToken);
    }
    
    return result;
  };

  const clearGuestSession = () => {
    localStorage.removeItem('guestSessionId');
    setSession(null);
  };

  const value: GuestContextType = {
    session,
    isGuest: !!session,
    createGuestSession,
    getGuestSession,
    updateGuestPreferences,
    saveGuestCart,
    convertToAccount,
    clearGuestSession
  };

  return (
    <GuestContext.Provider value={value}>
      {children}
    </GuestContext.Provider>
  );
}

export const useGuestSession = () => {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuestSession must be used within a GuestSessionProvider');
  }
  return context;
};