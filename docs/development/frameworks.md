# Framework installation and maintenance

Installed 2026-10-06. All skill/workflow content is local to this project. No global
Codex settings, model defaults, MCP credentials, or hook configuration were changed.

| Source | Pin | Integration |
| --- | --- | --- |
| https://github.com/bmad-code-org/BMAD-METHOD | v6.12.1 / 790dae9c8e2a1d73575cb2d40b14dd4963391f29 | Official installer: core + bmm, Codex, 29 skills, no legacy shims |
| https://github.com/affaan-m/ECC | v2.2.3 / c05b2d6614f62f6db0047669aa4eefb223d478f9 | Six selected upstream skills copied unchanged by the Codex skill installer |
| https://github.com/ai-evals-course/evals-skills | 80d5f7b0127c7572ed9e9339937adbfd7240ffeb | All nine evaluation skills copied unchanged by the Codex skill installer |

BMAD main was 6.13.0-next during setup and used a different installation model.
This project deliberately uses the stable 6.12.1 layout. Follow the installed
catalog and versioned source when maintaining it.

## ECC scope

Installed: `coding-standards`, `search-first`, `tdd-workflow`, `verification-loop`,
`security-review`, `strategic-compact`. This is a selected skill integration, not
the complete native ECC plugin. Global memory/instinct learning, automatic hooks,
extra MCP servers, and the full agent catalog are not installed or active.
BMAD provides planning and role workflows; evals-skills is the primary AI evaluation
method. Adding parallel ECC planners/eval frameworks would duplicate those roles.

## Reproduce the installed project

The skills and BMAD runtime are included project files; cloning this repository
and running `npm ci --ignore-scripts` is sufficient for the Node checks. Run
`npm run framework:check` to verify names, inventory, and SHA-256 tree digests.
Python 3.11+ and uv are also required for BMAD renderer/config scripts.

For a clean BMAD regeneration, the original command was:

```powershell
npx --yes --ignore-scripts bmad-method@6.12.1 install --directory . --modules bmm --tools codex --yes --no-shims --set 'core.project_name=Travel Life' --set 'core.user_name=Travel Life team' --set 'core.communication_language=English' --set 'core.document_output_language=English' --set 'core.output_folder=_bmad-output' --set 'bmm.project_knowledge=docs'
```

The ECC and eval skill selections, exact repository revisions, original paths and
installed digests live in `framework.lock.json`. The Codex skill installer used
`--repo`, `--ref <full SHA>`, `--path skills/<name> ...`, and
`--dest <project>/.agents/skills`. It refuses to overwrite existing skill folders.
Do not work around this by deleting local customizations.

## Updates

1. Record the intended version change and inspect upstream release notes/source.
2. Keep one installation method per component. Do not layer a native ECC plugin
   over these copied skills without deliberately retiring the duplicate surface.
3. Stage the new version in a temporary project directory first. Review changed
   skills, scripts, permissions and transitive dependencies. Preserve licenses.
4. Use BMAD's version-matched installer and its supported customization layer.
   Never copy a main-branch installer into a stable installation.
5. Update `framework.lock.json` only after reviewing the intended changes; never
   refresh hashes merely to hide an integrity failure. Run `npm run check` and
   BMAD config/renderer checks, then record the new evidence.

The lock detects local drift relative to this installation. It is not a signature
or a claim that upstream code has received an exhaustive security audit.

## Licenses

ECC and BMAD: MIT. evals-skills: Apache-2.0. Original license texts and BMAD's
trademark notice are preserved in `docs/third-party/`. Travel Life's own license
has not been selected; the private package is not configured for publication.
