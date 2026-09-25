import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { AcademyAuthContext } from "./AcademyAuthContextValue";
import {
  clearOfflineUser,
  getOfflineRecord,
  putOfflineRecord,
  OFFLINE_STORES,
} from "../lib/offlineStore";

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
    let cachedProfile = null;
    setProfileLoading(true);
    void getOfflineRecord(OFFLINE_STORES.profile, session.user.id, "profile")
      .then((cached) => {
        if (!cancelled && cached) {
          cachedProfile = cached;
          if (!navigator.onLine) {
            setProfile(cached);
            setProfileLoading(false);
          }
        }
      })
      .catch(() => undefined);
    const hydrateProfile = async (profileData) => {
      const base = profileData ?? {};
      if (base.academy_registration_codes?.registration_number) return base;
      try {
        const { data: claimed } = await supabase.rpc(
          "academy_claim_registration_from_metadata",
        );
        if (!claimed) return base;
        return {
          ...base,
          academy_registration_codes: { registration_number: claimed, status: "claimed" },
        };
      } catch {
        return base;
      }
    };
    Promise.all([
      supabase
        .from("academy_profiles")
        .select(
          "id, display_name, role, avatar_url, current_course_id, school_id, state, city, student_level, registration_code_id, academy_registration_codes!academy_profiles_registration_code_id_fkey(registration_number, status), academy_courses!academy_profiles_current_course_id_fkey(id, slug, title), academy_schools!academy_profiles_school_id_fkey(id, name, code, state, city)",
        )
        .eq("id", session.user.id)
        .maybeSingle(),
      supabase.rpc("academy_is_admin"),
    ])
      .then(async ([{ data, error: profileError }, { data: isAdmin }]) => {
        const resolved = await hydrateProfile(data);
        if (cancelled) return;
        setProfile(resolved ?? cachedProfile ?? null);
        if (resolved)
          void putOfflineRecord(OFFLINE_STORES.profile, session.user.id, "profile", resolved);
        setAdminStatus(
          Boolean(isAdmin),
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

  const signUp = (email, password, displayName, registrationNumber) => {
    if (!supabase) {
      throw new Error("Academy authentication is not configured yet.");
    }
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          registration_number: registrationNumber,
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

  const signOut = async () => {
    const result = supabase ? await supabase.auth.signOut() : { error: null };
    if (session?.user?.id) {
      try {
        await clearOfflineUser(session.user.id, { preserveQueue: true });
      } catch {
        setError(null);
      }
    }
    return result;
  };

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
