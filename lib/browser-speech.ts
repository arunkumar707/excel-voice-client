/** Chrome / Edge / Safari (webkit) — no API key. Quality varies by browser. */

export type BrowserSpeechCallbacks = {
  onResult: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
};

type SpeechRecLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechResultEventLike) => void) | null;
  onerror: ((e: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechResultEventLike = {
  results: { length: number; [i: number]: { length: number; [j: number]: { transcript: string } } };
};

type SpeechErrorEventLike = { error?: string };

type SpeechRecCtor = new () => SpeechRecLike;

export function isBrowserSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecCtor;
    webkitSpeechRecognition?: SpeechRecCtor;
  };
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function startBrowserSpeech(
  callbacks: BrowserSpeechCallbacks,
  lang = "en-IN"
): (() => void) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecCtor;
    webkitSpeechRecognition?: SpeechRecCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = false;
  rec.lang = lang;

  rec.onresult = (event: SpeechResultEventLike) => {
    const text = event.results[0]?.[0]?.transcript?.trim() ?? "";
    if (text) callbacks.onResult(text);
  };
  rec.onerror = (event: SpeechErrorEventLike) => {
    callbacks.onError(event.error || "speech error");
  };
  rec.onend = () => callbacks.onEnd();

  try {
    rec.start();
  } catch (e) {
    callbacks.onError(e instanceof Error ? e.message : "Could not start");
    return null;
  }

  return () => {
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  };
}
