# CodeCraft AI

> A cloud-native, full-stack developer platform — combining a multi-language online code editor with real-time execution, community snippet sharing, and a freemium monetisation layer, powered by an embedded AI service module delivering six context-aware code intelligence capabilities.

---

## What It Is

Developers iterating on ideas or learning new languages are constantly context-switching between editors, REPLs, documentation, AI chat tools, and community resources. CodeCraft AI collapses that entire surface into one experience: write code in a Monaco-powered IDE, execute it instantly against a sandboxed remote runtime, get AI-driven guidance — generation, explanation, complexity analysis, debugging, translation, and auto-documentation — without leaving the editor, then publish or discover reusable snippets from the community. A simple authentication + pro-tier model keeps the platform sustainable, with all business rules enforced server-side.

The platform is structured as two cohesive subsystems within a single monorepo:

| Subsystem | Role |
|---|---|
| **Code IDE** (`Code IDE/`) | Next.js 15 frontend + Convex backend — editor, execution, social features, auth, payments |
| **AI Service** (`AI-code-assistant/`) | FastAPI microservice — six typed AI endpoints consumed by the IDE's `/ai-assistant` page |

---

## Architecture & Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                        Next.js 15 App                            │
│                                                                  │
│  ┌──────────────┐   ┌──────────────────┐   ┌─────────────────┐  │
│  │  Monaco IDE  │   │  AI Assistant    │   │    Snippets     │  │
│  │ (EditorPanel)│   │  (/ai-assistant) │   │  (/snippets)    │  │
│  └──────┬───────┘   └────────┬─────────┘   └────────┬────────┘  │
│         │  Zustand store     │                       │           │
│         └────────────────────┘                       │           │
│                  │                                   │           │
│    ┌─────────────▼─────────────────────────────────▼──────────┐ │
│    │            /api/execute  (Next.js Route Handler)          │ │
│    │          server-side JDoodle proxy (credentials hidden)   │ │
│    └──────────────────────────┬────────────────────────────────┘ │
└─────────────────────────────── │ ────────────────────────────────┘
                                 │ HTTP
                          ┌──────▼──────┐
                          │  JDoodle API │  (sandboxed code execution)
                          └─────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                     AI Service Module                            │
│                  (FastAPI — AI-code-assistant/)                  │
│                                                                  │
│  Client (HTTP POST /api/v1/*)                                    │
│         │                                                        │
│  ┌──────▼────────┐   HTTP layer only — Pydantic validation,      │
│  │  api/routes   │   delegates to service, shapes typed response  │
│  └──────┬────────┘                                               │
│         │ typed dict                                             │
│  ┌──────▼────────┐   All AI logic lives here.                    │
│  │  ai_service   │   APIKeyRotator → _call_ai_with_rotation()    │
│  │               │   → generate_content() → sanitize / parse     │
│  └──────┬────────┘                                               │
│         │ reads                                                  │
│  ┌──────▼────────┐   Pydantic-settings singleton (lru_cache'd).  │
│  │  core/config  │   All prompts, keys, model name from .env.    │
│  └───────────────┘                                               │
│         │                                                        │
│      AI Model                                                    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                       Convex Backend                             │
│                                                                  │
│  ┌──────────┐  ┌─────────────┐  ┌────────────────────────────┐  │
│  │ users.ts │  │ snippets.ts │  │     codeExecutions.ts      │  │
│  │ syncUser │  │ CRUD+Stars  │  │  saveExecution (pro-gated) │  │
│  │upgradePro│  │  Comments   │  │       getUserStats         │  │
│  └─────┬────┘  └──────┬──────┘  └─────────────┬──────────────┘  │
│        │              │                        │                 │
│  ┌─────▼──────────────▼────────────────────────▼──────────────┐ │
│  │                   Convex Document DB                        │ │
│  │    users | snippets | snippetComments | stars |             │ │
│  │    codeExecutions                                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  http.ts  (Convex HTTP router)                           │   │
│  │  POST /clerk-webhook       → syncUser                    │   │
│  │  POST /lemon-squeezy-webhook → upgradeToPro              │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘

External services
  Clerk        ──►  Auth + svix-verified webhook → syncUser (Convex)
  LemonSqueezy ──►  Payment webhook → upgradeToPro mutation (Convex)
```

**Critical path for `analyze-complexity`:** Unlike the other five AI endpoints, this route passes `response_mime_type="application/json"` to the underlying model, forcing structured output. The service then parses and validates the returned JSON keys before constructing the response — providing a deterministic schema guarantee even from a generative model.

---

## How Components Correlate

**Zustand as the single source of truth for the editor session.**
`useCodeEditorStore` holds the live Monaco instance, current language, theme, font size, and the last execution result. All three panels — `EditorPanel`, `OutputPanel`, and `RunButton` — subscribe to the same store slice, so the output panel never polls; it reacts the moment `runCode()` resolves. `setCode()` also writes back to `localStorage` keyed by language, so switching languages doesn't erase work-in-progress. The same `code` field is read by the AI Assistant page after a route change, letting the AI service see the current editor content without prop drilling or a shared URL.

**Next.js `/api/execute` as a security proxy.**
The JDoodle credentials (`clientId`/`clientSecret`) are server-side-only env vars, never exposed to the browser. The route handler acts as a thin proxy: it receives the user's code and language, injects the credentials server-side, and forwards the response. Execution intentionally lives in a Next.js Route Handler rather than Convex — Convex actions excel at data, but the JDoodle call belongs closest to the secret storage.

**The AI Service module is a discrete, independently deployable FastAPI process.**
It exposes six typed endpoints at `/api/v1/*` that the IDE's `/ai-assistant` page calls over HTTP. `routes.py` is intentionally thin — its only job is HTTP: deserialize into a typed Pydantic model, delegate to `ai_service.py`, and wrap the returned `dict` in a typed response. All AI interaction (prompt construction, model calls, output sanitization) is encapsulated inside `ai_service.py`, keeping LLM logic independently testable without spinning up FastAPI.

**`config.py` is the AI service keystone.**
Every module imports `get_settings()` (cached via `lru_cache`) rather than touching environment variables directly. All configuration — including all six system prompts — lives in `.env`, not in Python. Swapping a prompt, model version, or API key requires zero code changes.

**`APIKeyRotator` solves quota exhaustion without retrying the same key.**
The rotator holds an ordered list of API keys parsed from a single comma-separated env var. On any 429/quota error it marks the current key exhausted and transparently switches to the next one — all within the same request lifecycle. Routes and schemas have no knowledge this rotation exists; it is entirely encapsulated inside the service layer.

**Convex handles persistence, real-time social features, and business rule enforcement.**
After a successful execution, `saveExecution` (a Convex mutation) checks `isPro` before allowing non-JavaScript runs — making pro-gating a server-side invariant rather than a UI concern. Snippets use three related tables (`snippets`, `snippetComments`, `stars`) with compound indexes (`by_user_id_and_snippet_id`) to make toggle-star O(1). Cascade deletion of comments and stars on snippet delete is handled transactionally inside the mutation, avoiding orphaned records.

**Clerk + Convex webhook pipeline for identity sync.**
Clerk is the auth provider; Convex owns the application-level user record (with `isPro`). On `user.created`, Clerk POSTs a svix-verified webhook to Convex's HTTP router, which calls `syncUser` with `isPro: false`. This decoupled approach means the Next.js app never needs to manually create users — Clerk events drive Convex state asynchronously.

**LemonSqueezy closes the monetisation loop.**
On `order_created`, LemonSqueezy POSTs a webhook to Convex's HTTP router. After signature verification (via a Convex internal action), `upgradeToPro` patches the user's record. From that point forward, every `saveExecution` mutation enforces the pro language gate server-side. The UI reflects `isPro` by querying the same Convex user record, giving instant consistency with no extra API call.

**`main.py` lifespan validation provides a fail-fast guarantee.**
Calling `get_settings()` inside the ASGI lifespan context means a misconfigured deployment fails at server startup with a named `ValidationError` rather than at the first request — making container healthchecks and deployment pipelines reliable.

**Schema evolution is independent per AI endpoint.**
Request and response models are kept as separate Pydantic classes (not shared base types). This allows `AnalyzeComplexityResponse` to carry four structured fields while `ExplainCodeResponse` carries a single Markdown string — without forcing a common contract that artificially couples unrelated endpoints.

---

## Key Features

### Code IDE
- **Multi-language sandbox** — 10 languages (Python, JavaScript, TypeScript, Java, Go, Rust, C++, C#, Ruby, Swift) executed via JDoodle, with per-language default code and Monaco syntax highlighting.
- **Persistent editor state** — language, theme, font size, and per-language code drafts survive page refreshes through `localStorage`, hydrated into Zustand on mount.
- **Community snippet hub** — create, star, comment on, and delete public code snippets with real-time-reactive Convex queries and compound-indexed social graphs.
- **Freemium gate** — free tier is limited to JavaScript; all other languages require a Pro subscription enforced at the Convex mutation layer, not the client.
- **Webhook-driven identity & payment** — Clerk and LemonSqueezy events propagate into Convex via verified webhooks, keeping user state consistent without polling.
- **Dark-first, animated UI** — Monaco themes, Framer Motion micro-animations, and Tailwind glassmorphism components throughout.

### AI Service Module
- **Six discrete AI endpoints** — generate, explain, analyze complexity, rubber-duck debug, translate, and auto-document code; each with its own typed Pydantic request/response contract.
- **Transparent API key rotation** — `APIKeyRotator` cycles through a pool of AI provider keys on quota exhaustion, returning `429` only when all keys are spent.
- **Prompt-as-configuration** — all six system prompts are environment variables; zero hardcoded strings in Python, enabling prompt iteration without redeployment.
- **Structured JSON mode for complexity analysis** — enforces `response_mime_type="application/json"` so the Big-O response always carries parseable `time_complexity`, `space_complexity`, and `bottlenecks` fields.
- **Strict layer separation** — HTTP handling, AI logic, and configuration are in distinct modules with no cross-layer leakage, keeping each independently testable.
- **Auto-documented OpenAPI** — every endpoint, schema field, and example is surfaced in the interactive Swagger UI at `/docs` and ReDoc at `/redoc`.

---

## Tech Stack

### Code IDE

| Category | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 RC, Tailwind CSS 3, Framer Motion |
| Code Editor | Monaco Editor (`@monaco-editor/react`) |
| State Management | Zustand 5 |
| Backend / DB | Convex (real-time document store + serverless functions) |
| Authentication | Clerk (`@clerk/nextjs`) |
| Webhook Verification | Svix |
| Code Execution | JDoodle API (remote sandbox) |
| Payments | LemonSqueezy |
| Notifications | react-hot-toast |
| Markdown Rendering | react-markdown + remark-gfm + react-syntax-highlighter |

### AI Service Module

| Category | Technology |
|---|---|
| Web framework | FastAPI 0.111+ |
| ASGI server | Uvicorn (with standard extras) |
| Config & validation | Pydantic v2 + pydantic-settings |
| Language | Python 3.11+ |

---

## Project Structure

```
CodeCraft AI/
│
├── Code IDE/                          # Next.js frontend + Convex backend
│   ├── convex/                        # Serverless backend (Convex)
│   │   ├── schema.ts                  # Data model: users, snippets, stars, comments, executions
│   │   ├── users.ts                   # syncUser, getUser, upgradeToPro mutations/queries
│   │   ├── snippets.ts                # Full CRUD + star/comment operations
│   │   ├── codeExecutions.ts          # saveExecution (pro-gated), getUserStats
│   │   ├── http.ts                    # Webhook router: /clerk-webhook, /lemon-squeezy-webhook
│   │   ├── lemonSqueezy.ts            # Webhook signature verification (internal action)
│   │   └── auth.config.ts             # Clerk JWT config for Convex auth
│   │
│   └── src/
│       ├── middleware.ts               # Clerk auth middleware (runs on every route)
│       ├── store/
│       │   └── useCodeEditorStore.ts  # Global editor state (Zustand)
│       ├── types/                     # Shared TypeScript interfaces
│       ├── hooks/
│       │   └── useMounted.ts          # SSR hydration guard
│       └── app/
│           ├── layout.tsx             # Root layout (ConvexProvider, ClerkProvider, Toaster)
│           ├── api/
│           │   └── execute/
│           │       └── route.ts       # Server-side JDoodle proxy (credentials hidden)
│           ├── (root)/                # Main IDE page
│           │   ├── _constants/        # LANGUAGE_CONFIG, Monaco theme definitions
│           │   └── _components/       # EditorPanel, OutputPanel, RunButton, LanguageSelector, ThemeSelector
│           ├── ai-assistant/
│           │   └── page.tsx           # AI chat page (reads code from Zustand store, calls AI Service)
│           ├── snippets/              # Community snippets gallery + detail view
│           ├── pricing/               # Pro tier pricing page
│           └── profile/               # User profile + execution history
│
└── AI-code-assistant/                 # AI Service Module (FastAPI)
    ├── app/
    │   ├── main.py                    # App factory, CORS, lifespan, health check
    │   ├── api/
    │   │   └── routes.py              # Six HTTP route handlers (HTTP layer only)
    │   ├── core/
    │   │   └── config.py              # Settings (pydantic-settings), lru_cache'd singleton
    │   ├── models/
    │   │   └── schemas.py             # Pydantic request/response pairs for every endpoint
    │   └── services/
    │       └── ai_service.py          # APIKeyRotator, _call_ai_with_rotation, 6 public fns
    └── requirements.txt
```
