"use client";

/**
 * Footer credit with gradient shimmer, sweep line, and gentle motion.
 */
export function DesignerCredit() {
  return (
    <footer className="mt-10 flex flex-col items-center gap-5 px-2 pb-4">
      <div className="relative h-px w-full max-w-[min(20rem,85vw)] overflow-hidden rounded-full bg-slate-800/90">
        <div className="credit-sweep-bar absolute inset-y-0 w-[45%] rounded-full bg-gradient-to-r from-transparent via-sky-400/80 to-transparent" />
      </div>

      <div className="credit-float text-center">
        <p className="credit-shimmer text-sm font-medium tracking-[0.2em] text-slate-500 uppercase">
          Designed &amp; developed by
        </p>
        <p className="credit-name mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
          Arun Kumar A N
        </p>
      </div>

      <div className="flex gap-1 opacity-50" aria-hidden>
        <span className="credit-dot h-1 w-1 rounded-full bg-sky-400" />
        <span className="credit-dot h-1 w-1 rounded-full bg-violet-400" />
        <span className="credit-dot h-1 w-1 rounded-full bg-sky-400" />
      </div>
    </footer>
  );
}
