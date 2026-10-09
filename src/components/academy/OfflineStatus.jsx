import { useEffect, useState } from "react";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import {
  getAcademySubmissionHistory,
  markAcademyNotificationRead,
  markLessonComplete,
  markProjectMilestoneComplete,
  requestAcademyDeterministicGrading,
  saveAcademyExamAnswer,
  submitAssignment,
  submitAcademyExamAttempt,
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
  const [state, setState] = useState({
    online: true,
    status: "idle",
    pending: 0,
    failed: 0,
  });

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
      // Replayed exam writes go through the same server functions as a live
      // save, so the deadline and the last-write-wins rule are enforced by the
      // database rather than by whatever the queued payload claims.
      exam_answer: async ({ attemptId, questionId, selectedKey, clientAnsweredAt }) => {
        const { error } = await saveAcademyExamAnswer(
          attemptId,
          questionId,
          selectedKey,
          clientAnsweredAt,
        );
        if (error) throw error;
      },
      exam_submit: async ({ attemptId, reason, clientSubmittedAt }) => {
        const { error } = await submitAcademyExamAttempt(
          attemptId,
          reason,
          clientSubmittedAt,
        );
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
      : state.failed
        ? `${state.failed} need${state.failed === 1 ? "s" : ""} attention`
      : state.pending
        ? `${state.pending} waiting to sync`
        : "Online";

  return (
    <div
      className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 text-[0.68rem] font-semibold text-slate-600 sm:min-h-11 sm:gap-2 sm:px-3 sm:text-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      role="status"
      aria-live="polite"
      aria-label={
        state.failed
          ? `${label}. ${state.lastError || "An offline item could not be synchronized."}`
          : label
      }
      title={state.failed ? state.lastError : undefined}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          state.failed
            ? "bg-red-500"
            : state.online
              ? "bg-emerald-500"
              : "bg-amber-500"
        }`}
        aria-hidden="true"
      />
      <span className="inline sm:hidden">
        {!state.online
          ? "Offline"
          : state.status === "syncing"
            ? "Syncing"
            : state.failed
              ? `${state.failed} need attention`
            : state.pending
              ? `${state.pending} queued`
              : "Online"}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}
