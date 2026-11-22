# Your Gear

**Your Gear** is a configurable, extensible AI agent harness focused on a reliable terminal-first developer experience.

> Status: **Milestone 0 — foundation and architecture (in progress)**. No runtime implementation is shipped yet.

## Goals

- Small, maintainable core; real extension points only when justified.
- Agent sessions, streaming, tools, context, and predictable recovery.
- Human approval for sensitive operations; traceable tool execution.
- Provider-independent configuration with **provider-authorized** authentication.
- CLI first; a friendly TUI, skills, MCP, and workflows can be added incrementally.
- First-class tests and documentation, without premature microservices or multi-agent orchestration.

## Documentation

- [Vision](docs/vision.md)
- [Architecture](docs/architecture.md)
- [Technology evaluation](docs/tech-stack.md)
- [Milestone 0 tracker](docs/milestones/milestone-0.md)
- [Roadmap](docs/roadmap.md)
- [Decisions](docs/decisions/)

## Working principles

1. Decide with evidence: document alternatives, trade-offs, and a reversible choice.
2. Avoid rebuilding working agent-loop/session/tool primitives without a concrete requirement.
3. Keep credentials out of the repository and logs. Do not treat technical OAuth support as permission to use subscription credentials in a third-party harness.
4. Prefer a working vertical slice to frameworks and abstractions.
5. Maintain documentation and acceptance criteria with each milestone.

## Next step

Validate an SDK-based Pi spike: start a local agent session, stream responses, try a read-only tool, inspect session lifecycle and policy interception, and test cleanup/error handling. This must use an authorized model credential; no secrets or subscription tokens are checked in.

See [Milestone 0](docs/milestones/milestone-0.md) for the checklist.

## License

To be determined before public distribution.
