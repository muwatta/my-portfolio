import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import { supabase } from "../../lib/supabase";
import AcademyLoadingScreen from "./AcademyLoadingScreen";

export default function AcademyGraderGuard() {
  const { initializing, user } = useAcademyAuth();
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (initializing) return undefined;
    if (!user?.id || !supabase) {
      setAllowed(false);
      return undefined;
    }
    supabase.rpc("academy_can_grade").then(({ data, error }) => {
      if (!cancelled) setAllowed(!error && data === true);
    }).catch(() => {
      if (!cancelled) setAllowed(false);
    });
    return () => {
      cancelled = true;
    };
  }, [initializing, user?.id]);

  if (initializing || allowed === null) {
    return <AcademyLoadingScreen title="Checking grading access" />;
  }
  return allowed ? <Outlet /> : <Navigate to="/academy/login" replace />;
}
