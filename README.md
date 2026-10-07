# Travel Life

A development foundation for a private, evidence-based travel history product.
Current stage: Minimum Lovable Product planning for iOS and Android (decision 0008).
Existing `mvp` filenames are from the prior plan and await scope alignment. No application or AI
reconstruction engine has been implemented.

## Start here

- [Project state](docs/project-state.md)
- [Proposed roadmap and prioritized backlog](_bmad-output/planning-artifacts/README.md)
- [Product context](docs/product/context.md)
- [Development workflow](docs/development/workflow.md)
- [Installed frameworks and maintenance](docs/development/frameworks.md)
- [Evaluation mechanism](evals/README.md)
- [Decision log](docs/decisions/README.md)

## Tooling

Node.js 22+ and npm run the local checks. Python 3.11+ and uv run BMAD's scripts.
These are development-tool requirements, not the application technology choices.

```powershell
npm ci --ignore-scripts
uv venv --python 3.12 .venv
npm run check
uv run --no-cache _bmad/scripts/resolve_config.py --project-root .
```

Installed skills are project-local in `.agents/skills/`. They become available to
Codex on the next turn. If the active skill catalog is stale, reopen the project
or start a fresh chat. Continue the active delivery queue with:

> Implement MLP story M1.1 using the working MLP spec and combined BMAD/ECC/evals
> workflow. Use the selected defaults and learn through rollout; no pre-launch
> market research or interview programme is required.

For implementation later, give the agent the approved story and ask it to use
the combined BMAD, ECC, and eval workflow. Plain-language requests work too.

## Directory map

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Short project instructions loaded by coding agents |
| `.agents/skills/` | Pinned upstream skills: BMAD, selected ECC, evals-skills |
| `_bmad/` | Official BMAD runtime, configuration, and workflow catalogs |
| `_bmad-output/` | Planning and implementation artifacts |
| `docs/product/` | Product source, working context, unresolved questions |
| `docs/development/` | Integration, maintenance, story and experiment templates |
| `docs/decisions/` | Decisions with evidence and consequences |
| `evals/` | Trace contract, fixtures, review guidance, local evaluation runner |
| `scripts/` | Framework integrity and foundation checks |
| `.github/workflows/` | CI definition for the foundation, ready for a future remote |

Real personal data belongs in ignored private directories. Do not put raw media
or personal traces beside the committed synthetic fixtures. Git ignore rules
prevent accidental staging; they do not anonymize data or enforce upload policy.
