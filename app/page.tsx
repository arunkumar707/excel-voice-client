"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { DesignerCredit } from "@/components/DesignerCredit";
import { UrlToast } from "@/components/UrlToast";
import {
  clearAccessToken,
  getAccessToken,
  nestFetch,
} from "@/lib/nest-auth-fetch";

const QUOTES = [
  "Speak once — your sheet updates.",
  "Voice to text to Excel, without the clutter.",
  "One workbook at a time. Saved in MySQL.",
  "Create a book, fill rows, download when ready.",
];

type Wb = { id: number; name: string; createdAt?: string };

type Me = { username: string; role: string };

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <UrlToast />
      </Suspense>
      <HomeClient />
    </>
  );
}

function HomeClient() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [list, setList] = useState<Wb[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadList = useCallback(
    async (qParam: string) => {
      setErr(null);
      setLoading(true);
      try {
        const q = qParam.trim()
          ? `?q=${encodeURIComponent(qParam.trim())}`
          : "";
        const res = await nestFetch<Wb[]>(`/excel-workbooks${q}`);
        setList(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setErr(
          e instanceof Error
            ? e.message
            : "Is Nest running? Try: npm run server:dev"
        );
        setList([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    void loadList("");
    void (async () => {
      try {
        const res = await nestFetch<Me>("/auth/me");
        setMe(res.data);
      } catch {
        // session may not be ready yet; ignore
      }
    })();
  }, [loadList, router]);

  useEffect(() => {
    const t = setInterval(() => {
      setQuoteIdx((i) => (i + 1) % QUOTES.length);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  const createWorkbook = async () => {
    const n = newName.trim();
    if (!n) return;
    setCreating(true);
    setErr(null);
    try {
      const res = await nestFetch<Wb>(`/excel-workbooks`, {
        method: "post",
        data: { name: n },
      });
      setShowCreate(false);
      setNewName("");
      window.location.href = `/excel/${res.data.id}`;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const downloadOne = async (id: number, name: string) => {
    try {
      const res = await nestFetch<ArrayBuffer>(`/excel-workbooks/${id}/download`, {
        responseType: "arraybuffer",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErr("Download failed");
    }
  };

  const confirmDeleteWorkbook = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErr(null);
    try {
      await nestFetch(`/excel-workbooks/${deleteTarget.id}`, {
        method: "delete",
      });
      setDeleteTarget(null);
      void loadList(search);
    } catch {
      setErr("Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Voice Excel Assistant
          </h1>
          <p
            key={quoteIdx}
            className="mt-4 min-h-[3rem] text-lg text-sky-200/90 transition-opacity duration-500"
          >
            {QUOTES[quoteIdx]}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Welcome — search your workbooks or create a new one.
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Search by Excel name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void loadList(search)}
            className="flex-1 rounded-xl border border-slate-600 bg-slate-900/80 px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            type="button"
            onClick={() => void loadList(search)}
            className="rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Create Excel
          </button>
        </div>

        {err ? (
          <p className="mb-4 rounded-lg border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
            {err}
          </p>
        ) : null}

        <section className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-4 shadow-xl backdrop-blur">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
            Your Excels
          </h2>
          {loading ? (
            <p className="text-slate-500">Loading…</p>
          ) : list.length === 0 ? (
            <p className="text-slate-500">
              No workbooks yet. Click <strong>Create Excel</strong>.
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-3"
                >
                  <span className="font-medium text-white">{w.name}</span>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/excel/${w.id}`}
                      className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-600"
                    >
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => void downloadOne(w.id, w.name)}
                      className="rounded-lg border border-violet-500/50 bg-violet-950/40 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-900/50"
                    >
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({ id: w.id, name: w.name })
                      }
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-rose-300"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DesignerCredit />
      </div>

      {showCreate ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white">New Excel name</h3>
            <p className="mt-1 text-sm text-slate-400">
              This name is saved in the database. You can open the grid next.
            </p>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Farmers April 2026"
              className="mt-4 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-white focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              onKeyDown={(e) => e.key === "Enter" && void createWorkbook()}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={creating || !newName.trim()}
                onClick={() => void createWorkbook()}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {creating ? "Saving…" : "Save & open"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-excel-title"
        >
          <button
            type="button"
            aria-label="Close"
            disabled={deleting}
            onClick={() => !deleting && setDeleteTarget(null)}
            className="absolute inset-0 cursor-default bg-transparent disabled:cursor-not-allowed"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-2xl">
            <h3
              id="delete-excel-title"
              className="text-lg font-semibold text-white"
            >
              Delete this Excel?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              You will lose all data related to this Excel workbook:{" "}
              <span className="font-medium text-slate-200">
                {deleteTarget.name}
              </span>
              . This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => !deleting && setDeleteTarget(null)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void confirmDeleteWorkbook()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="fixed bottom-4 right-4 z-40 flex min-w-0 max-w-[min(100vw-2rem,28rem)] flex-nowrap items-center justify-between gap-3 rounded-xl border border-slate-600/90 bg-slate-950/95 px-3 py-2 text-sm shadow-lg backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        {me ? (
          <>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="min-w-0 truncate text-slate-400">
                Signed in as{" "}
                <span className="font-semibold text-white">{me.username}</span>
              </span>
              {me.role === "super_admin" ? (
                <span className="shrink-0 rounded-full bg-amber-500/25 px-2.5 py-0.5 text-xs font-medium text-amber-200">
                  Super admin
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => {
                clearAccessToken();
                router.replace("/login?toast=logout");
              }}
              className="shrink-0 rounded-lg border border-slate-500 px-3 py-1.5 text-white hover:bg-slate-800"
            >
              Log out
            </button>
          </>
        ) : (
          <span className="text-slate-500">Loading session…</span>
        )}
      </div>
    </main>
  );
}
