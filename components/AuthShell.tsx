"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";

const easeOut = [0.22, 1, 0.36, 1] as const;

export function AuthShell({
  title,
  subtitle,
  children,
  footerLink,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footerLink: { href: string; label: string };
}) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-violet-600/25 blur-3xl"
          animate={{ x: [0, 24, 0], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-20 bottom-1/4 h-80 w-80 rounded-full bg-sky-600/20 blur-3xl"
          animate={{ y: [0, -20, 0], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute left-1/3 top-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-teal-500/15 blur-2xl"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: easeOut }}
      >
        <div className="mb-8 text-center">
          <motion.h1
            className="text-2xl font-bold tracking-tight text-white sm:text-3xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45, ease: easeOut }}
          >
            {title}
          </motion.h1>
          <motion.p
            className="mt-2 text-sm text-slate-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.4 }}
          >
            {subtitle}
          </motion.p>
        </div>

        <motion.div
          className="rounded-2xl border border-slate-700/80 bg-slate-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-md"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.12, duration: 0.5, ease: easeOut }}
        >
          {children}
        </motion.div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link
            href={footerLink.href}
            className="font-medium text-sky-400 transition-colors hover:text-sky-300"
          >
            {footerLink.label}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
