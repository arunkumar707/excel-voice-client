# 🎙️ Voice Excel Assistant — Frontend

A **Next.js 15** web application that lets you fill Excel workbook rows by voice. Speak into your microphone — the app transcribes your speech using **OpenAI Whisper**, applies smart column-aware formatting, and saves data to a **MySQL** database via the NestJS backend.

---

## ✨ Features

- **Voice-to-cell filling** via OpenAI Whisper (record button) or Browser Dictate (Chrome/Edge Web Speech API)
- **Smart column-aware voice processing:**
  - `Sl.no` — spoken words auto-converted to digits (`"one"` → `1`)
  - `Farmer Name / Village Name / AI / MM` — raw text, no modification
  - `Joining Date` — auto-formatted to `DD-MM-YYYY` (`"1952025"` → `19-05-2025`)
  - `Phone Number` — digits only extracted from speech
- **JWT authentication** — login / signup / session persistence
- **Workbook management** — create, open, search, download `.xlsx`, delete
- **Auto-save** — grid syncs to MySQL every 500ms after changes
- **Row-level locking** — fully filled rows are read-only until "Edit" is clicked
- **Row search** — find a row by any column value
- **Download Excel** — exports the current workbook as a `.xlsx` file

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| HTTP Client | Axios |
| Excel parsing | ExcelJS |
| Animations | Framer Motion |
| Voice (Whisper) | OpenAI API (`whisper-1`) |
| Voice (Browser) | Web Speech API (Chrome/Edge) |
| Auth | JWT via NestJS backend |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- NestJS backend running (see `../Excel-Backend/server/`)
- OpenAI API key (for Whisper voice — optional if using Browser Dictate only)

### 1. Install dependencies
```bash
npm install
```

### 2. Create `.env.local`
```env
# NestJS backend — scheme + host only, no trailing slash, no /api/v1
NEXT_PUBLIC_NEST_API_URL=http://127.0.0.1:3005

# OpenAI (enables Record/Whisper button — optional)
OPENAI_API_KEY=sk-proj-...
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_TRANSCRIBE_MODEL=whisper-1
```

### 3. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure

```
app/
  page.tsx              # Home — workbook list
  login/page.tsx        # Login page
  signup/page.tsx       # Sign-up page
  excel/[id]/page.tsx   # Workbook editor
  api/
    transcribe/         # POST — Whisper transcription
    voice-status/       # GET  — Whisper availability check
    clean-text/         # POST — GPT text cleaning (AI/MM columns)
    workbook/           # GET/PUT — session-based workbook ops
    fill-excel/         # POST — fill Excel from mapped data
    map-fields/         # POST — AI field mapping
    parse-excel/        # POST — parse uploaded Excel

components/
  ExcelEditor.tsx       # Main workbook editor + voice integration
  VoiceRecorder.tsx     # Whisper + Browser Dictate buttons
  WorkbookGrid.tsx      # Spreadsheet grid UI

lib/
  nest-api.ts           # getNestApiBase() — resolves backend URL + /api/v1
  nest-auth-fetch.ts    # Axios client with JWT interceptors
  column-voice-filter.ts # Column-aware voice text transformation
  excel-helpers.ts      # ExcelJS read/write helpers
  voice-post-process.ts # GPT transcript cleanup
```

---

## 🌐 API Routes (Next.js → NestJS)

All NestJS calls go through the shared `apiClient` (Axios) which:
- Automatically prepends `NEXT_PUBLIC_NEST_API_URL` + `/api/v1`
- Attaches `Bearer` JWT token from `localStorage`
- Redirects to `/login` on 401

---

## 🔐 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_NEST_API_URL` | ✅ | NestJS backend base URL (host only, no trailing slash) |
| `OPENAI_API_KEY` | Optional | Enables Whisper voice transcription |
| `OPENAI_CHAT_MODEL` | Optional | GPT model for text cleanup (default: `gpt-4o-mini`) |
| `OPENAI_TRANSCRIBE_MODEL` | Optional | Whisper model (default: `whisper-1`) |

---

## 📦 Build for Production

```bash
npm run build
npm start
```

> Set `NEXT_PUBLIC_NEST_API_URL=https://your-api-domain.com` in your deployment platform's environment variables.

---

## 👤 Author

**Arun Kumar A N**
