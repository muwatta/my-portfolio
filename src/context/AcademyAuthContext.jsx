import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { AcademyAuthContext } from "./AcademyAuthContextValue";

export function AcademyAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!mounted) return;
        setSession(data.session);
        setError(sessionError ?? null);
        setLoading(false);
      })
      .catch((sessionError) => {
        if (mounted) {
          setError(sessionError);
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
      .then(({ data, error: profileError }) => {
        if (cancelled) return;
        setProfile(data ?? null);
        setError(profileError ?? null);
        setProfileLoading(false);
      });

    setProfileLoading(true);

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

  const signUp = (email, password, displayName) => {
    if (!supabase) {
      throw new Error("Academy authentication is not configured yet.");
    }
    return supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
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
        profileLoading,
        error,
        isTeacher: profile?.role === "teacher",
        signIn,
        signUp,
        signOut,
        isConfigured: isSupabaseConfigured,
      }}
    >
      {children}
    </AcademyAuthContext.Provider>
  );
}
