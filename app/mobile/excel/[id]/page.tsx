"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MobileExcelEditor } from "@/components/MobileExcelEditor";
import { getAccessToken, nestFetch } from "@/lib/nest-auth-fetch";

export default function MobileExcelWorkbookPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(String(params.id), 10);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    if (!Number.isFinite(id)) return;
    if (!getAccessToken()) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await nestFetch<{ name?: string }>(`/excel-workbooks/${id}`);
        if (!cancelled && res.data.name) setName(res.data.name);
        else if (!cancelled) setName(`Workbook ${id}`);
      } catch {
        if (!cancelled) setName(`Workbook ${id}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!Number.isFinite(id)) {
    return (
      <main className="p-8 text-rose-400">
        Invalid workbook id.
      </main>
    );
  }

  return <MobileExcelEditor workbookId={id} workbookName={name || "…"} />;
}
