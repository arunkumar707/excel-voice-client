"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isBrowserSpeechSupported, startBrowserSpeech } from "@/lib/browser-speech";
import type { VoiceIntent } from "@/lib/voice-intent";
import { transcriptResponseToIntent } from "@/lib/transcript-to-intent";

type Props = {
  onTranscript: (intent: VoiceIntent) => void;
  disabled?: boolean;
  /**
   * Toolbar row: left = `leading` + Whisper + Browser; right = `trailing` (e.g. Download + sync).
   * Notes render below the row, prefixed with “Note :”.
   */
  compactToolbar?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

const DEFAULT_VOICE_INSTRUCTION =
  "Voice uses the selected cell. Say “next row”, “next column”, or “clear”; otherwise the value is filled. Long dictate auto-moves after 2s pause.";

export function VoiceRecorder({
  onTranscript,
  disabled,
  compactToolbar = false,
  leading = null,
  trailing = null,
}: Props) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whisperOk, setWhisperOk] = useState<boolean | null>(null);
  const [browserListening, setBrowserListening] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stopBrowserRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/voice-status")
      .then((r) => r.json())
      .then((d: { whisper?: boolean }) => {
        if (!cancelled) setWhisperOk(Boolean(d.whisper));
      })
      .catch(() => {
        if (!cancelled) setWhisperOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [longDictate, setLongDictate] = useState(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptRef = useRef("");

  const stopAndSend = useCallback(async () => {
    const rec = mediaRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.stop();
    setRecording(false);
    setBusy(true);
    setError(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        try {
          const fd = new FormData();
          fd.set("audio", blob, "clip.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: fd });
          const data = (await res.json()) as {
            text?: string;
            action?: string | null;
            error?: string;
            code?: string;
          };
          if (!res.ok) throw new Error(data.error ?? res.statusText);
          onTranscript(transcriptResponseToIntent(data));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Transcription failed");
        } finally {
          setBusy(false);
        }
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone access denied");
    }
  }, [onTranscript]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const startBrowser = useCallback(() => {
    setError(null);
    if (!isBrowserSpeechSupported()) {
      setError("Browser speech is not supported here. Use Chrome or Edge, or set OPENAI_API_KEY for Whisper.");
      return;
    }

    transcriptRef.current = "";
    const isLong = longDictate;

    const stop = startBrowserSpeech(
      {
        onResult: (text) => {
          if (!isLong) {
            onTranscript(transcriptResponseToIntent({ text }));
            setBrowserListening(false);
            stopBrowserRef.current = null;
          } else {
            // Long dictate logic
            transcriptRef.current = text;
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
              const finalVal = transcriptRef.current.trim();
              if (finalVal) {
                onTranscript(transcriptResponseToIntent({ text: finalVal }));
              }
              // Restart for fresh transcript for next cell
              stopBrowserRef.current?.();
              startBrowser();
            }, 2000);
          }
        },
        onError: (msg) => {
          setError(msg === "not-allowed" ? "Microphone blocked for browser speech." : msg);
          setBrowserListening(false);
          stopBrowserRef.current = null;
          clearSilenceTimer();
        },
        onEnd: () => {
          if (!isLong) {
            setBrowserListening(false);
            stopBrowserRef.current = null;
          }
        },
      },
      "en-IN",
      isLong
    );

    if (!stop) {
      setError("Could not start browser speech.");
      return;
    }
    stopBrowserRef.current = stop;
    setBrowserListening(true);
  }, [onTranscript, longDictate, clearSilenceTimer]);

  const stopBrowser = useCallback(() => {
    stopBrowserRef.current?.();
    stopBrowserRef.current = null;
    setBrowserListening(false);
    clearSilenceTimer();
  }, [clearSilenceTimer]);

  const browserSupported = typeof window !== "undefined" && isBrowserSpeechSupported();

  const whisperButton =
    whisperOk !== false ? (
      !recording ? (
        <button
          type="button"
          disabled={disabled || busy || whisperOk === null}
          onClick={start}
          className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Working…" : whisperOk === null ? "…" : "Record (Whisper)"}
        </button>
      ) : (
        <button
          type="button"
          onClick={stopAndSend}
          className="shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          Stop & transcribe
        </button>
      )
    ) : null;

  const browserButton = browserSupported ? (
    <div className="flex items-center gap-2">
      {!browserListening ? (
        <button
          type="button"
          disabled={disabled}
          onClick={startBrowser}
          className="shrink-0 rounded-lg border border-sky-500/60 bg-sky-950/40 px-4 py-2 text-sm font-medium text-sky-200 hover:bg-sky-900/50 disabled:opacity-50"
        >
          Browser dictate
        </button>
      ) : (
        <button
          type="button"
          onClick={stopBrowser}
          className="shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
        >
          Stop listening
        </button>
      )}

      {/* Blue border box for long dictate checkbox */}
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-sky-500/50 bg-sky-500/5 px-2 py-2 text-xs font-medium text-sky-300 transition-colors hover:border-sky-400 hover:bg-sky-500/10">
        <input
          type="checkbox"
          checked={longDictate}
          onChange={(e) => setLongDictate(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-sky-500/50 bg-slate-900 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
        />
        <span>Long browser dictate</span>
      </label>
    </div>
  ) : whisperOk === false ? (
    <p className="shrink-0 text-xs text-slate-500 sm:text-right">
      Browser dictate needs Chrome or Edge.
    </p>
  ) : null;

  const hints =
    whisperOk === false ? (
      <p className="text-sm text-amber-200/90">
        Whisper is off (no <code className="text-amber-100/80">OPENAI_API_KEY</code>). Add
        it to <code className="text-amber-100/80">.env.local</code> and restart{" "}
        <code className="text-amber-100/80">npm run dev</code> for best accuracy — or use
        browser dictate.
      </p>
    ) : (
      <p className="text-xs text-slate-500">
        Tip: quiet room; speak clearly, e.g. &quot;Arun&quot; or &quot;Village Whitefield&quot;
        or &quot;9876543210&quot;. After recording, Whisper runs then GPT cleans names/places
        and detects &quot;next row&quot;, &quot;next column&quot;, or &quot;clear&quot;.
      </p>
    );

  const compactNotes = (
    <p className="text-xs leading-relaxed text-slate-500">
      <span className="font-semibold text-slate-400">Note :</span>{" "}
      {DEFAULT_VOICE_INSTRUCTION}{" "}
      {whisperOk === false ? (
        <span className="text-amber-200/90">
          Whisper is off (no <code className="text-amber-100/80">OPENAI_API_KEY</code>). Add it
          to <code className="text-amber-100/80">.env.local</code> and restart{" "}
          <code className="text-amber-100/80">npm run dev</code>, or use browser dictate.
        </span>
      ) : (
        <>
          Use a quiet room; speak clearly, e.g. &quot;Arun&quot;, &quot;Village Whitefield&quot;,
          or &quot;9876543210&quot;. After recording, Whisper runs, then GPT cleans names and
          places and detects &quot;next row&quot;, &quot;next column&quot;, or &quot;clear&quot;.
        </>
      )}
    </p>
  );

  if (compactToolbar) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {leading}
            {whisperButton}
            {browserButton}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">{trailing}</div>
        </div>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        {compactNotes}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {hints}

      <div className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-4">
        <div className="flex shrink-0 items-center gap-2">{whisperButton}</div>

        <div className="flex shrink-0 items-center justify-end gap-2">{browserButton}</div>
      </div>
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
    </div>
  );
}
