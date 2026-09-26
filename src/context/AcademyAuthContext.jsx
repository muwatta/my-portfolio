import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { AcademyAuthContext } from "./AcademyAuthContextValue";
import {
  clearOfflineUser,
  getOfflineRecord,
  putOfflineRecord,
  OFFLINE_STORES,
} from "../lib/offlineStore";

const SESSION_HINT_KEY = "academy-session-hint";
const SESSION_HINT_MAX_AGE = 1000 * 60 * 60 * 12;

function readCachedProfileHint() {
  try {
    const raw = localStorage.getItem(SESSION_HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId || !parsed?.savedAt) return null;
    if (Date.now() - parsed.savedAt > SESSION_HINT_MAX_AGE) {
      localStorage.removeItem(SESSION_HINT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(userId, value) {
  if (!userId) return;
  try {
    localStorage.setItem(
      SESSION_HINT_KEY,
      JSON.stringify({ ...value, userId, savedAt: Date.now() }),
    );
  } catch {
    return;
  }
}

function clearSessionCache() {
  try {
    localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    return;
  }
}

export function AcademyAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(() => {
    const cached = readCachedProfileHint();
    return cached?.profile ?? null;
  });
  const [adminStatus, setAdminStatus] = useState(() => {
    const cached = readCachedProfileHint();
    return Boolean(cached?.isAdmin);
  });
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSettled, setProfileSettled] = useState(() =>
    Boolean(readCachedProfileHint()),
  );
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
        const userId = data.session?.user?.id ?? null;
        const hint = readCachedProfileHint();
        if (!userId) {
          clearSessionCache();
          setProfile(null);
          setAdminStatus(false);
        } else if (hint && hint.userId !== userId) {
          clearSessionCache();
          setProfile(null);
          setAdminStatus(false);
          setProfileSettled(false);
        }
        setSession(data.session);
        setProfileSettled((current) => current && Boolean(hint && hint.userId === userId) ? true : !userId);
        setError(sessionError ?? null);
        setLoading(false);
      })
      .catch((sessionError) => {
        if (mounted) {
          setError(sessionError);
          setProfileSettled(true);
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfileSettled(!nextSession);
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
    if (!supabase || !session?.user?.id) {
      setProfileSettled(true);
      return undefined;
    }

    let cancelled = false;
    let cachedProfile = null;
    setProfileLoading(true);
    setProfileSettled(false);
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
        const nextProfile = resolved ?? cachedProfile ?? null;
        setProfile(nextProfile);
        if (resolved)
          void putOfflineRecord(OFFLINE_STORES.profile, session.user.id, "profile", resolved);
        setAdminStatus(Boolean(isAdmin));
        if (nextProfile) {
          writeSessionCache(session.user.id, {
            profile: nextProfile,
            isAdmin: Boolean(isAdmin),
          });
        }
        setError(profileError ?? null);
        setProfileLoading(false);
        setProfileSettled(true);
      })
      .catch((profileError) => {
        if (!cancelled) {
          setError(profileError);
          setProfileLoading(false);
          setProfileSettled(true);
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
    clearSessionCache();
    setProfile(null);
    setAdminStatus(false);
    setProfileSettled(true);
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
        initializing: loading || (Boolean(session?.user?.id) && !profileSettled),
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
