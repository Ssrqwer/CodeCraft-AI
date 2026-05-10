```markdown
# CodeCraft AI — AI Coding Assistant API

A production-ready FastAPI microservice that wraps a cloud AI service to deliver six context-aware code intelligence endpoints over a clean, versioned REST API.

---

## Problem & Solution

Developers constantly context-switch between their editor, documentation, and AI chat tools to understand, debug, and transform code. This service eliminates that friction by exposing discrete, composable AI capabilities (generation, explanation, complexity analysis, debugging, translation, documentation) as first-class HTTP endpoints. Architecturally, the system enforces a strict separation between HTTP concerns and LLM logic, making it trivially embeddable in any frontend or CI pipeline.

---

## Architecture & Data Flow

The system is a single-process FastAPI application structured into four layers. No database; all state is ephemeral per-request.

```
  Client (HTTP POST)
        │
        ▼
┌───────────────────┐
│  main.py          │  App factory, CORS, lifespan validation,
│  (FastAPI app)    │  global exception handler, health endpoint
└────────┬──────────┘
         │ /api/v1/*
         ▼
┌───────────────────┐
│  api/routes.py    │  Route handlers — HTTP only.
│  (APIRouter)      │  Validates request via Pydantic, delegates to service,
│                   │  shapes typed response. No LLM logic here.
└────────┬──────────┘
         │ typed dict
         ▼
┌───────────────────┐
│  services/        │  All AI interaction lives here.
│  ai_service       │  APIKeyRotator → _call_ai_with_rotation()
│                   │  → AI model generate_content()
│                   │  → sanitize / parse → return dict
└────────┬──────────┘
         │ reads
         ▼
┌───────────────────┐
│  core/config.py   │  Pydantic-settings — single lru_cache'd Settings object.
│  models/schemas   │  All prompts, keys, and model name sourced from env.
└───────────────────┘
         │
         ▼
   AI Model API
   (fast, capable LLM)
```

**Critical path for `analyze-complexity`:** Unlike the other five endpoints, this route passes `response_mime_type="application/json"` to the AI model, forcing structured output. The service then parses and validates the returned JSON keys before constructing the response — providing a deterministic schema guarantee even from a generative model.

---

## How Components Correlate

**`config.py` is the keystone.** Every other module imports `get_settings()` (cached via `lru_cache`) rather than touching environment variables directly. This single indirection means all configuration — including the six system prompts — lives in `.env`, not in Python. Swapping a prompt, model version, or API key requires zero code changes.

**`routes.py` is intentionally thin.** Its only job is HTTP: deserialize the request body into a typed Pydantic model, call the appropriate service function, and wrap the returned `dict` in a typed response model. This separation means the LLM logic in `ai_service.py` can be tested in isolation without spinning up FastAPI.

**`APIKeyRotator` solves quota exhaustion without retrying the same key.** The rotator holds an ordered list of API keys parsed from a single comma-separated env var. On any 429/quota error it marks the current key exhausted and transparently switches to the next one — all within the same request lifecycle. The routes and schemas have no knowledge this rotation exists; it is entirely encapsulated inside the service layer.

**Schema evolution is independent per endpoint.** Request and response models are kept as separate Pydantic classes (not shared base types). This allows, for example, the `AnalyzeComplexityResponse` to carry four structured fields while `ExplainCodeResponse` carries a single Markdown string — without forcing a common contract that would artificially couple unrelated endpoints.

**`main.py` lifespan validation provides a fail-fast guarantee.** Calling `get_settings()` inside the ASGI lifespan context means a misconfigured deployment fails at server startup with a named `ValidationError` rather than at the first request — making container healthchecks and deployment pipelines reliable.

---

## Key Features

- **Six discrete AI endpoints** — generate, explain, analyze complexity, rubber-duck debug, translate, and auto-document code; each with its own typed Pydantic contract.
- **Transparent API key rotation** — `APIKeyRotator` cycles through a pool of AI provider keys on quota exhaustion, returning `429` only when all keys are spent.
- **Prompt-as-configuration** — all six system prompts are environment variables; zero hardcoded strings in Python, enabling prompt iteration without redeployment.
- **Structured JSON mode for complexity analysis** — enforces `response_mime_type="application/json"` so the Big-O response always carries parseable `time_complexity`, `space_complexity`, and `bottlenecks` fields.
- **Strict layer separation** — HTTP handling, LLM logic, and configuration are in distinct modules with no cross-layer leakage, keeping each independently testable.
- **Fail-fast startup** — pydantic-settings validation in the ASGI lifespan context surfaces misconfiguration before the server accepts any traffic.
- **Auto-documented OpenAPI** — every endpoint, schema field, and example is surfaced in the interactive Swagger UI at `/docs` and ReDoc at `/redoc`.

---

## Tech Stack

| Category | Technology |
|---|---|
| Web framework | FastAPI 0.111+ |
| ASGI server | Uvicorn (with standard extras) |
| LLM provider | Cloud AI model (via API) |
| Config & validation | Pydantic v2 + pydantic-settings |
| Language | Python 3.11+ |

---

## Project Structure

```
AI-code-assistant/
├── app/
│   ├── main.py               # App factory, CORS, lifespan, health check
│   ├── api/
│   │   └── routes.py         # Six HTTP route handlers (HTTP layer only)
│   ├── core/
│   │   └── config.py         # Settings (pydantic-settings), lru_cache'd singleton
│   ├── models/
│   │   └── schemas.py        # Pydantic request/response pairs for every endpoint
│   └── services/
│       └── ai_service.py     # APIKeyRotator, _call_ai_with_rotation, 6 public fns
└── requirements.txt
```