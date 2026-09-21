import { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AcademyAuthContext = createContext(null);

export function AcademyAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setProfile(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user?.id) return undefined;

    let cancelled = false;
    supabase
      .from("academy_profiles")
      .select("id, display_name, role, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile(data ?? null);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const signIn = (email, password) => {
    if (!supabase) {
      throw new Error("Academy authentication is not configured yet.");
    }
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = () =>
    supabase ? supabase.auth.signOut() : Promise.resolve();

  return (
    <AcademyAuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signIn,
        signOut,
        isConfigured: isSupabaseConfigured,
      }}
    >
      {children}
    </AcademyAuthContext.Provider>
  );
}

export function useAcademyAuth() {
  return useContext(AcademyAuthContext);
}
