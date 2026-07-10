import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile, Organisation, OrgMember } from '../types';

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organisations: Organisation[];
  memberships: OrgMember[];
  activeOrg: Organisation | null;
  setActiveOrg: (org: Organisation) => void;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [memberships, setMemberships] = useState<OrgMember[]>([]);
  const [activeOrg, setActiveOrg] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUserData(userId: string) {
    const [profileRes, membersRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('organisation_members')
        .select('*, organisations(*)')
        .eq('user_id', userId)
        .eq('active', true),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);

    if (membersRes.data) {
      setMemberships(membersRes.data as OrgMember[]);
      const orgs = membersRes.data
        .map((m: OrgMember & { organisations?: Organisation }) => m.organisations)
        .filter(Boolean) as Organisation[];
      setOrganisations(orgs);
      if (orgs.length > 0 && !activeOrg) setActiveOrg(orgs[0]);
    }
  }

  async function refreshProfile() {
    if (user) await loadUserData(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await loadUserData(session.user.id);
        })();
      } else {
        setProfile(null);
        setOrganisations([]);
        setMemberships([]);
        setActiveOrg(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{
      session, user, profile, organisations, memberships,
      activeOrg, setActiveOrg, loading, signOut, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
