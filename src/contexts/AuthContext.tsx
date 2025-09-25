'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  email?: string;
  native_lang?: string | null;
  [key: string]: any;
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  authLoading: boolean;
  getAuthHeaders: () => Promise<HeadersInit>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      if (!user) {
        setProfile(null);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, native_lang')
        .eq('id', user.id)
        .single();
      if (!error) setProfile((data || null) as UserProfile | null);
    } catch {}
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const safety = setTimeout(() => {
      if (mounted) setAuthLoading(false);
    }, 2000);

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(session?.user || null);
      } catch {}
      finally {
        if (mounted) {
          clearTimeout(safety);
          setAuthLoading(false);
        }
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      if (!mounted) return;
      setUser(session?.user || null);
    });

    return () => {
      mounted = false;
      clearTimeout(safety);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) fetchProfile();
    else setProfile(null);
  }, [user, fetchProfile]);

  const getAuthHeaders = useCallback(async (): Promise<HeadersInit> => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    try {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        try {
          await supabase.auth.refreshSession();
          const result = await supabase.auth.getSession();
          session = result.data.session;
        } catch {}
      }
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    } catch {}
    return headers;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, profile, authLoading, getAuthHeaders, refreshProfile: fetchProfile }),
    [user, profile, authLoading, getAuthHeaders, fetchProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


