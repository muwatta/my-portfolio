import { useEffect, useState } from "react";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import {
  getAcademySubmissionHistory,
  markAcademyNotificationRead,
  markLessonComplete,
  markProjectMilestoneComplete,
  requestAcademyDeterministicGrading,
  submitAssignment,
  submitObjectiveAnswer,
} from "../../lib/academy";
import { supabase } from "../../lib/supabase";
import {
  startAcademySync,
  subscribeToAcademySync,
  syncAcademyOperations,
} from "../../lib/academySync";

export default function OfflineStatus() {
  const { user } = useAcademyAuth();
  const [state, setState] = useState({ online: true, status: "idle", pending: 0 });

  useEffect(() => {
    startAcademySync();
    const handlers = {
      assignment_submission: async (payload) => {
        let filePath = null;
        if (payload.file && supabase) {
          const safeName = payload.originalFilename?.replace(/[^a-zA-Z0-9._-]/g, "_") || "submission";
          filePath = `${payload.studentId}/${payload.assignmentId}/${payload.clientOperationId}-${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from("assignment-submissions")
            .upload(filePath, payload.file, { upsert: true });
          if (uploadError) throw uploadError;
        }
        const { error } = await submitAssignment({ ...payload, filePath });
        if (error) throw error;
        const history = await getAcademySubmissionHistory(
          payload.assignmentId,
          payload.studentId,
        );
        if (history.error) throw history.error;
        const submission = history.data?.[0];
        if (submission?.id) {
          const grading = await requestAcademyDeterministicGrading(submission.id);
          if (grading.error) throw grading.error;
        }
      },
      project_milestone_complete: async ({ milestoneId, studentId }) => {
        const { error } = await markProjectMilestoneComplete(milestoneId, studentId);
        if (error) throw error;
      },
      notification_read: async ({ notificationId, studentId }) => {
        const { error } = await markAcademyNotificationRead(
          notificationId,
          studentId,
        );
        if (error) throw error;
      },
      objective_answer: async ({ exerciseId, answer, clientOperationId }) => {
        const { error } = await submitObjectiveAnswer(
          exerciseId,
          answer,
          clientOperationId,
        );
        if (error) throw error;
      },
      lesson_complete: async ({ lessonId, studentId }) => {
        const { error } = await markLessonComplete(lessonId, studentId);
        if (error) throw error;
      },
    };
    const sync = () => {
      if (user?.id && navigator.onLine) {
        void syncAcademyOperations(user.id, handlers);
      }
    };
    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === "ACADEMY_SYNC_REQUESTED") sync();
    };
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);
    const unsubscribe = subscribeToAcademySync((nextState) => {
      setState((current) => ({ ...current, ...nextState }));
      if (nextState.online && nextState.status === "reconnected") sync();
    });
    sync();
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
      unsubscribe();
    };
  }, [user?.id]);

  const label = !state.online
    ? "Offline"
    : state.status === "syncing"
      ? "Syncing"
      : state.pending
        ? `${state.pending} waiting to sync`
        : "Online";

  return (
    <div
      className="flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 sm:px-3 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      role="status"
      aria-live="polite"
    >
      <span
        className={`h-2 w-2 rounded-full ${
          state.online ? "bg-emerald-500" : "bg-amber-500"
        }`}
        aria-hidden="true"
      />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
