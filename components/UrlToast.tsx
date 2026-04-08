"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const MESSAGES: Record<string, string> = {
  registered: "Account created. Please sign in.",
  logout: "You're signed out.",
  welcome: "Signed in successfully.",
  session: "Session expired. Sign in again.",
};

const TOAST_MS = 3000;

export function UrlToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const processed = useRef<string | null>(null);

  // Read ?toast=… and strip the query. Do not attach the auto-hide timer here — replacing the URL
  // re-runs this effect and would clear the timeout before it fires.
  useEffect(() => {
    const key = searchParams.get("toast");
    if (!key || !MESSAGES[key]) {
      processed.current = null;
      return;
    }
    const token = `${pathname}:${key}`;
    if (processed.current === token) return;
    processed.current = token;
    setMessage(MESSAGES[key]);
    setOpen(true);
    router.replace(pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (!open) return;
    const hide = setTimeout(() => {
      setOpen(false);
      processed.current = null;
    }, TOAST_MS);
    return () => clearTimeout(hide);
  }, [open]);

  return (
    <AnimatePresence>
      {open && message ? (
        <motion.div
          key={message}
          role="status"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ type: "spring", damping: 26, stiffness: 380 }}
          className="pointer-events-none fixed left-1/2 z-[100] w-[min(calc(100vw-2rem),16rem)] -translate-x-1/2 rounded-xl border border-slate-600/90 bg-slate-950/95 px-3 py-2 text-center text-xs font-medium leading-snug text-slate-100 break-words shadow-lg shadow-black/40 backdrop-blur-sm top-[max(0.5rem,env(safe-area-inset-top,0px)+0.25rem)]"
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
