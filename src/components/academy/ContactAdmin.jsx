const WHATSAPP_NUMBER = "2348142797233";
const WHATSAPP_DISPLAY = "+234 814 279 7233";

function defaultMessage(context) {
  return context
    ? `Hello Algorise Tech Explorers, I need help with ${context}. My email is `
    : "Hello Algorise Tech Explorers, I need help with my account. My email is ";
}

// Shown wherever a student is stuck, most importantly on a failed password
// reset, where the usual advice of checking spam does not help someone who no
// longer has the mailbox the account was made with. WhatsApp is what a parent
// or a student will actually reach for, so it is a real tap rather than a
// number to copy by hand.
export default function ContactAdmin({
  context = "",
  tone = "default",
  className = "",
}) {
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    defaultMessage(context),
  )}`;

  const tones = {
    default:
      "border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
    light: "border border-amber-300 bg-white dark:border-amber-800 dark:bg-slate-900",
  };

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 ${
        tones[tone] ?? tones.default
      } ${className}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
          Cannot fix it yourself?
        </p>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
          Message us on WhatsApp and an administrator will help. They can correct
          a wrong email address, or reset your access.
        </p>
      </div>
      <a
        className="button-primary shrink-0"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        WhatsApp {WHATSAPP_DISPLAY}
      </a>
    </div>
  );
}

export { WHATSAPP_DISPLAY, WHATSAPP_NUMBER };
