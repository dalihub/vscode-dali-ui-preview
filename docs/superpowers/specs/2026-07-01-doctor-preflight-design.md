# `dali-ui-preview-cli doctor` — machine-readable environment preflight

> **한 줄 요약:** 에이전트가 렌더를 시도해 실패(exit 12/13)해야만 환경 문제를 알던 "사후적" 발견을, 렌더 **전에** 돌려서 `{ready, recommended, runtimes}` JSON을 받는 **선제적** 프리플라이트 명령 `doctor`로 바꾼다. 순수 리포트 빌더 + 얇은 비동기 프로브 + 문서 연동.

## Problem

`dali-ui-preview-cli` is already strongly agent-friendly: JSON scene tree on stdout, diagnostics on stderr, structured compile errors (`{phase,message,sourceLine}`), and documented exit codes (0/1/10/11/12/13/20). Two gaps remain against agent-CLI conventions; this spec addresses the higher-priority one.

**Environment-setup discovery is reactive.** The only way an agent learns the runtime is unusable is by *attempting a render* and getting `exit 12` (Docker unavailable) or `exit 13` (local runtime unavailable). There is no machine-readable command an agent can run *before* rendering to ask "is a runtime ready, and which one will a bare render use?" `init` performs this detection but is a human-run, one-time onboarding step whose output is human prose, not agent-parseable.

The building blocks already exist and are unit-tested in isolation — they are simply not composed into a read-only reporting command:
- `isDockerAvailable(): Promise<boolean>` (dockerRunner)
- `localTags(image): Promise<string[]>` (imageManager) — reveals whether the runtime image is present locally
- `checkLocalReadiness({daliPrefix, baseDir}): {ready, issues, prefix}` (localRunner)
- `readConfig(baseDir): {runtime?, daliPrefix?, imageTag?}` (runtime/config)
- `chooseRuntime({flagged, dockerOk, localReady})` (init) — the docker-preferred selection rule

## Goals

- An agent (or MCP wrapper, or shell) can run one command **before** rendering and get a machine-readable readiness report.
- The report names **actionable remediation** (`issues[]`) the agent can relay verbatim to the human — because fixing setup needs `sudo`, which the agent must not do silently.
- `doctor` is offline-cheap: **no network calls** (Docker daemon check, local image-tag check, filesystem checks only), so it is safe to run at the top of every session.
- Exit code lets a shell/agent gate a render: `doctor && render`.

Non-goals (explicitly deferred): unifying the split error contract (usage/docker/runtime errors stay plain-text on stderr — the exit codes already disambiguate them); a `--json` capability/schema dump; making `init`'s output agent-parseable.

## Design

### Command surface
`dali-ui-preview-cli doctor` — a **subcommand**, parallel to `init` (both are environment lifecycle, not render; `init` detects+persists, `doctor` detects+reports). Takes **no render input**. Honors only the overrides that change what a render would probe: `--dali-prefix <path>`, `--image-tag <tag>`, `--image <name>` (runtime image name). Rejects render/verify flags with a usage error (mirrors the `--list-versions`/`--pull` guard).

### stdout — a single JSON line (the machine contract)
```json
{
  "schemaVersion": 1,
  "ready": true,
  "recommended": "docker",
  "configured": "docker",
  "runtimes": {
    "docker": {
      "available": true,
      "imagePulled": false,
      "image": "ghcr.io/lwc0917/dali-preview-runtime:latest",
      "issues": []
    },
    "local": {
      "available": false,
      "prefix": null,
      "issues": ["No DALi install found. Pass --dali-prefix <path>, set DESKTOP_PREFIX, or run `init`."]
    }
  }
}
```

Field semantics:
- **`ready`** — `docker.available || local.available`. Docker being `available` (daemon up) counts as ready even when `imagePulled:false`, because the first render auto-pulls; `imagePulled` lets the agent warn the human about the one-time ~290 MB download.
- **`recommended`** — the runtime a no-flag render will actually succeed with: `configured` if it is available, else Docker if available, else local if available, else `null`. (This is the availability-aware refinement of `chooseRuntime`, with the persisted `configured` choice winning when usable.)
- **`configured`** — `readConfig().runtime` (what `.dali/config.json` persists), or `null`. Reported for transparency so an agent can see why `recommended` was chosen.
- **`docker.available`** — Docker daemon reachable (`isDockerAvailable`).
- **`docker.imagePulled`** — the target `<image>:<tag>` tag is present in `localTags(image)`. Best-effort; `false` when the daemon is down.
- **`docker.issues` / `local.issues`** — actionable, human-relayable strings. For Docker: the same daemon-unavailable guidance the render path prints. For local: `checkLocalReadiness().issues` verbatim.
- **`local.prefix`** — the resolved DALi prefix, or `null`.

The JSON is printed to stdout in **both** the ready and not-ready cases — the report is the successful output of a diagnosis, most valuable precisely when nothing is ready. (This is a deliberate, documented departure from the render path's "stdout empty on failure" rule; `doctor`'s non-zero exit is *not* a tool error.)

### Exit codes
- `0` — `ready` (at least one runtime available; safe to render).
- `13` — nothing ready (reuse `EXIT.RUNTIME_UNAVAILABLE`; "no usable runtime" is a coherent shared meaning). Enables `doctor && render` gating, consistent with the tool's "branch on `$?`" philosophy.

A genuine tool error while probing (e.g. an unexpected throw) still exits `1` with a plain stderr line, like the other commands.

### Module boundaries (isolation)
- **`src/doctor.ts`**
  - `buildDoctorReport(inputs): DoctorReport` — **pure**, no I/O. Inputs: `{ dockerOk, dockerImagePulled, image, tag, local: LocalReadiness, configured }`. Computes `ready`, `recommended`, and assembles the JSON shape. Deterministic → unit-testable with a truth-table, exactly like `chooseRuntime`.
  - `runDoctor(argv): Promise<number>` — the thin async probe: parse the doctor-scoped flags, call `isDockerAvailable` / `localTags` / `checkLocalReadiness` / `readConfig`, hand the results to `buildDoctorReport`, write the JSON line, return the exit code. The only place that touches the environment.
- **`src/cli.ts`** — dispatch `argv[0] === 'doctor'` to `runDoctor` (next to the existing `init` dispatch), and add the `doctor` line + exit-code note to `USAGE`.

### Testing
- Unit-test `buildDoctorReport` across the matrix: docker-only ready, local-only ready, both ready, neither ready, `configured` set but that runtime unavailable (recommended falls back), Docker up but `imagePulled:false` (still ready). Assert `ready`, `recommended`, `configured`, per-runtime fields, and that `issues[]` is populated when a runtime is unavailable.
- Because the probe is a thin wrapper over already-tested helpers, no new spawning integration test is required; the existing e2e `render-modes.sh` continues to cover the real runtimes. A real `doctor` invocation in this repo is run as a manual verification step.

### Documentation (agent communication)
The point of the feature is that agents *use* it, so the instruction files must tell them to:
- **`skills/dali-preview/SKILL.md`** — add a first "Setup" step: run `dali-ui-preview-cli doctor` before rendering; if `ready:false`, relay `issues` to the human (setup needs `sudo` — don't run it silently); add `doctor` to the exit-code list (`13` shared with "no usable runtime").
- **`templates/agent-verification-loop.md`** (the block `init` writes into `AGENTS.md`) — mirror the same first step and note.
- **`README.md` / `README.ko.md`** — document `doctor` in the command list with an example report.
- **`src/cli.ts` USAGE** — the `doctor` synopsis line and exit-code note.
- **`CHANGELOG.md`** — an entry under the CLI's next version.

## Risks / trade-offs
- **`13` now has two contexts** — render-time "selected local runtime unavailable" and doctor-time "no usable runtime." Both mean "you have no runtime you can use," so the overload is coherent; documented in both places.
- **`imagePulled` requires a `docker images` call** — cheap and local, tolerant of a down daemon (returns `false`). No network.
- **Departure from "stdout empty on failure"** — scoped to `doctor` only and documented; the render/verify contract is untouched.
