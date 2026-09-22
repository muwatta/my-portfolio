import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { AcademyAuthContext } from "./AcademyAuthContextValue";

export function AcademyAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [adminStatus, setAdminStatus] = useState(false);
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
      if (!nextSession) setAdminStatus(false);
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
    Promise.all([
      supabase
        .from("academy_profiles")
        .select(
          "id, display_name, role, avatar_url, current_course_id, school_id, state, city, student_level, academy_courses!current_course_id(id, slug, title), academy_schools(id, name, code, state, city)",
        )
        .eq("id", session.user.id)
        .maybeSingle(),
      supabase.rpc("academy_is_admin"),
    ])
      .then(([{ data, error: profileError }, { data: isAdmin }]) => {
        if (cancelled) return;
        setProfile(data ?? null);
        setAdminStatus(
          Boolean(isAdmin) ||
            session.user.email?.toLowerCase() ===
              "abdullahmusliudeen@gmail.com",
        );
        setError(profileError ?? null);
        setProfileLoading(false);
      })
      .catch((profileError) => {
        if (!cancelled) {
          setError(profileError);
          setProfileLoading(false);
        }
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

  const signUp = (email, password, displayName, profileDetails = {}) => {
    if (!supabase) {
      throw new Error("Academy authentication is not configured yet.");
    }
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          school_code: profileDetails.schoolCode,
          state: profileDetails.state,
          city: profileDetails.city,
        },
      },
    });
  };

  const sendPasswordReset = (email) => {
    if (!supabase) {
      return Promise.resolve({
        error: new Error("Academy authentication is not configured yet."),
      });
    }
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/academy/reset-password`,
    });
  };

  const updatePassword = (password) =>
    supabase
      ? supabase.auth.updateUser({ password })
      : Promise.resolve({
          error: new Error("Academy authentication is not configured yet."),
        });

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
        role: profile?.role ?? null,
        isAdmin: adminStatus,
        isTeacher: profile?.role === "teacher",
        isStudent: profile?.role === "student",
        signIn,
        signUp,
        sendPasswordReset,
        updatePassword,
        signOut,
        isConfigured: isSupabaseConfigured,
      }}
    >
      {children}
    </AcademyAuthContext.Provider>
  );
}
