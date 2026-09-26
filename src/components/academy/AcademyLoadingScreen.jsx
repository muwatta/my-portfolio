import { motion } from "framer-motion";

const BARS = [
  { id: "bar-1", width: "62%" },
  { id: "bar-2", width: "88%" },
  { id: "bar-3", width: "45%" },
  { id: "bar-4", width: "74%" },
];

export default function AcademyLoadingScreen({
  title = "Loading Academy",
  subtitle = "Preparing your learning space",
}) {
  return (
    <div
      className="grid min-h-screen place-items-center bg-slate-50 px-6 dark:bg-slate-950"
      role="status"
      aria-live="polite"
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600 text-lg font-bold text-white shadow-lg shadow-blue-600/20"
          >
            <motion.span
              animate={{ rotate: [0, 8, -8, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            >
              A
            </motion.span>
          </motion.div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide text-slate-800 dark:text-slate-100">
              {title}
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {BARS.map((bar, index) => (
            <motion.div
              key={bar.id}
              className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                initial={{ width: "0%" }}
                animate={{ width: bar.width }}
                transition={{ duration: 0.9, ease: "easeOut", delay: index * 0.08 }}
              />
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-6 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="h-full w-1/3 rounded-full bg-cyan-400"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
