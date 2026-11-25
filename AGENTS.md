<!-- BEGIN ytk-memory-init:codex -->
## YTK Memory

Project: `your-gear`. Apply the `ytk-memory` skill for meaningful project work and whenever the user asks about saved YTK Memory. If the skill is unavailable, follow `.ytk-memory/YTK-MEMORY.md`. Never store secrets.
<!-- END ytk-memory-init:codex -->

## Project references

Use [docs/references.md](docs/references.md) to consult Your Harness v0 and Agent Harness Lab before designing equivalent capabilities. Your Gear retains its own architecture, policies and roadmap.

## Documentation maintenance

Use [docs/architecture.md](docs/architecture.md) for implemented architecture, [docs/roadmap.md](docs/roadmap.md) for current progress, and milestone documents for historical evidence. Update usage, ADRs, security boundaries and acceptance guides when changing behavior. Distinguish merged code/CI from real-model and real-YTK acceptance. The managed YTK skill is for contributors using a configured MCP host, not runtime authorization in Your Gear. The portable fallback under `.ytk-memory/` is local/ignored by git; if the tool and fallback are unavailable, continue without memory and disclose the limitation. Do not read the SQLite database directly or invent memory entries.

## Product direction

Follow [docs/vision.md](docs/vision.md), [docs/target-architecture.md](docs/target-architecture.md), [docs/roadmap.md](docs/roadmap.md) and [ADR-005](docs/decisions/ADR-005-local-agentic-platform.md) for the agreed long-term direction. Keep current implementation distinct from target design. Preserve Hitos 0–3 and advance incrementally; 3.E is next. Keep connectors optional, authorization outside models, retries safe with bounded budgets, telemetry local/opt-in for export, and UI separate from application logic. Do not implement a generic framework just to match the target diagram.
