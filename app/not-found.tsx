import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-slate-200">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/" className="text-blue-400 underline hover:text-blue-300">
        Back to home
      </Link>
    </main>
  );
}
