# Local-mode Docker Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a `local`-runtime user runs "Select Runtime Version" and Docker isn't usable, let them pick a version from the registry, install/fix Docker, download that image, and switch to the Docker runtime — instead of dead-ending on a "docker is not accessible" warning.

**Architecture:** A new pure module `src/localDockerBootstrap.ts` holds two side-effect-free classifiers (`decideLocalVersionAction`, `decideInstallAction`) and one dependency-injected orchestrator (`runLocalDockerBootstrap`) that sequences pick → confirm → install → wait → pull → persist → reload. The extension wires real VS Code / Docker IO into the orchestrator's deps. Two small supporting extractions make the flow testable and let it pull a *chosen* tag: `buildVersionQuickPickItems` (from `checkUpdateCommand.ts`) and `ensureRuntimeImageForTag` (from `pullImageCommand.ts`). The mode switch itself is applied only on full success and takes effect via a window reload (the backend is chosen at activation).

**Tech Stack:** TypeScript (strict), VS Code Extension API, Mocha + Chai + Sinon (unit tests, with a `vscode` module mock required via `out/test/helpers/setup.js`).

## Global Constraints

- TypeScript strict mode; single quotes; `const` over `let`; `async/await` (no raw `.then()` chains). (from CLAUDE.md Code Style)
- Errors/diagnostics go to the injected `outputChannel`, never `console.log`. (from CLAUDE.md)
- `npm run compile` must succeed with zero errors; all existing tests must keep passing; new features must include tests. (from CLAUDE.md Testing Requirements)
- Update `CHANGELOG.md` with a summary of changes. (from CLAUDE.md PR Guidelines)
- Do NOT commit unless the user explicitly asks (user global rule overrides the skill's per-task commit step — keep the `git add`/`commit` steps below staged-and-ready but only run them on the user's go-ahead).
- Runtime is docker-first: default `runtimeMode` is `'docker'`; this feature only changes the `local`-mode branch of `dali.selectRuntimeVersion`. Docker-mode behavior is unchanged.
- Docker access states come from `DockerAccessState` in `src/dockerAccessCheck.ts`: `'ok' | 'docker-not-installed' | 'daemon-not-running' | 'permission-denied' | 'unknown-error'`.

---

### Task 1: Decision classifiers

**Files:**
- Create: `src/localDockerBootstrap.ts`
- Test: `test/unit/localDockerBootstrap.test.ts` (create)

**Interfaces:**
- Consumes: nothing (pure string logic).
- Produces:
  - `decideLocalVersionAction(args: { accessState: string }): 'list-and-switch' | 'setup-then-switch'`
  - `decideInstallAction(accessState: string): 'install' | 'guidance'`
  - `type BootstrapOutcome = 'switched' | 'no-versions' | 'cancelled-pick' | 'declined' | 'setup-gaveup' | 'pull-failed'`

- [ ] **Step 1: Write the failing test**

Create `test/unit/localDockerBootstrap.test.ts`:

```typescript
import { expect } from 'chai';
import { decideLocalVersionAction, decideInstallAction } from '../../src/localDockerBootstrap';

describe('decideLocalVersionAction', () => {
    it('returns list-and-switch when docker is ok', () => {
        expect(decideLocalVersionAction({ accessState: 'ok' })).to.equal('list-and-switch');
    });
    it('returns setup-then-switch for every not-ok state', () => {
        for (const s of ['docker-not-installed', 'daemon-not-running', 'permission-denied', 'unknown-error']) {
            expect(decideLocalVersionAction({ accessState: s })).to.equal('setup-then-switch');
        }
    });
});

describe('decideInstallAction', () => {
    it('routes docker-not-installed to a fresh install', () => {
        expect(decideInstallAction('docker-not-installed')).to.equal('install');
    });
    it('routes daemon/permission problems to guidance (docker already present)', () => {
        expect(decideInstallAction('daemon-not-running')).to.equal('guidance');
        expect(decideInstallAction('permission-denied')).to.equal('guidance');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile`
Expected: FAIL — `Cannot find module '../../src/localDockerBootstrap'` (TS2307).

- [ ] **Step 3: Write minimal implementation**

Create `src/localDockerBootstrap.ts`:

```typescript
/**
 * Local-mode → Docker bootstrap.
 *
 * When the user is on the `local` runtime and Docker is not usable, the
 * "Select Runtime Version" command can't list versions. Instead of dead-ending,
 * this module drives: pick a version from the registry → install/fix Docker →
 * download that image → switch runtimeMode to docker (on success only) → reload.
 *
 * The classifiers are pure; the orchestrator (Task 2) takes injected deps so the
 * whole flow is unit-testable without VS Code or Docker (mirrors the
 * dockerOnboarding.ts pattern).
 */

/** Whether we can list versions now (docker ok) or must bootstrap docker first. */
export function decideLocalVersionAction(args: { accessState: string }):
    'list-and-switch' | 'setup-then-switch' {
    return args.accessState === 'ok' ? 'list-and-switch' : 'setup-then-switch';
}

/** Fresh install vs. fix-an-existing-install (daemon down / socket permission). */
export function decideInstallAction(accessState: string): 'install' | 'guidance' {
    return accessState === 'docker-not-installed' ? 'install' : 'guidance';
}

export type BootstrapOutcome =
    | 'switched'
    | 'no-versions'
    | 'cancelled-pick'
    | 'declined'
    | 'setup-gaveup'
    | 'pull-failed';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/localDockerBootstrap.test.js --require out/test/helpers/setup.js --timeout 10000`
Expected: PASS — 4 passing.

- [ ] **Step 5: Commit (only on user go-ahead)**

```bash
git add src/localDockerBootstrap.ts test/unit/localDockerBootstrap.test.ts
git commit -m "feat(runtime): add local-mode docker bootstrap classifiers"
```

---

### Task 2: Bootstrap orchestrator

**Files:**
- Modify: `src/localDockerBootstrap.ts` (append the deps interface + `runLocalDockerBootstrap`)
- Test: `test/unit/localDockerBootstrap.test.ts` (append a `runLocalDockerBootstrap` describe block)

**Interfaces:**
- Consumes: `BootstrapOutcome` (Task 1).
- Produces:
  - `interface LocalDockerBootstrapDeps { accessState: string; currentTag: string; listRemoteVersions(): Promise<string[]>; pickVersion(tags: string[], current: string): Promise<string | undefined>; confirmSetup(version: string): Promise<boolean>; confirmOfflineFallback(tag: string): Promise<boolean>; beginInstall(accessState: string): Promise<void>; waitForDockerReady(): Promise<'ok' | 'gaveup'>; pullImage(tag: string): Promise<boolean>; persistDockerMode(tag: string): Promise<void>; reload(): Promise<void>; warn(msg: string): Promise<void>; log?(msg: string): void; }`
  - `runLocalDockerBootstrap(deps: LocalDockerBootstrapDeps): Promise<BootstrapOutcome>`

- [ ] **Step 1: Write the failing test**

Append to `test/unit/localDockerBootstrap.test.ts`:

```typescript
import * as sinon from 'sinon';
import { runLocalDockerBootstrap, LocalDockerBootstrapDeps } from '../../src/localDockerBootstrap';

describe('runLocalDockerBootstrap', () => {
    function makeDeps(over: Partial<LocalDockerBootstrapDeps> = {}): LocalDockerBootstrapDeps {
        return {
            accessState: 'docker-not-installed',
            currentTag: 'dali_2.5.26',
            listRemoteVersions: sinon.stub().resolves(['latest', 'dali_2.5.26']),
            pickVersion: sinon.stub().resolves('latest'),
            confirmSetup: sinon.stub().resolves(true),
            confirmOfflineFallback: sinon.stub().resolves(true),
            beginInstall: sinon.stub().resolves(undefined),
            waitForDockerReady: sinon.stub().resolves('ok'),
            pullImage: sinon.stub().resolves(true),
            persistDockerMode: sinon.stub().resolves(undefined),
            reload: sinon.stub().resolves(undefined),
            warn: sinon.stub().resolves(undefined),
            ...over,
        };
    }
    afterEach(() => sinon.restore());

    it('happy path: pick → install → wait → pull → persist(tag) → reload', async () => {
        const deps = makeDeps();
        const outcome = await runLocalDockerBootstrap(deps);
        expect(outcome).to.equal('switched');
        expect((deps.beginInstall as sinon.SinonStub).calledOnceWith('docker-not-installed')).to.equal(true);
        expect((deps.pullImage as sinon.SinonStub).calledOnceWith('latest')).to.equal(true);
        expect((deps.persistDockerMode as sinon.SinonStub).calledOnceWith('latest')).to.equal(true);
        expect((deps.reload as sinon.SinonStub).calledOnce).to.equal(true);
        // persist must happen before reload
        expect((deps.persistDockerMode as sinon.SinonStub).calledBefore(deps.reload as sinon.SinonStub)).to.equal(true);
    });

    it('cancelled picker: no install, no persist, no reload', async () => {
        const deps = makeDeps({ pickVersion: sinon.stub().resolves(undefined) });
        expect(await runLocalDockerBootstrap(deps)).to.equal('cancelled-pick');
        expect((deps.beginInstall as sinon.SinonStub).called).to.equal(false);
        expect((deps.persistDockerMode as sinon.SinonStub).called).to.equal(false);
        expect((deps.reload as sinon.SinonStub).called).to.equal(false);
    });

    it('declined confirm: stops before install', async () => {
        const deps = makeDeps({ confirmSetup: sinon.stub().resolves(false) });
        expect(await runLocalDockerBootstrap(deps)).to.equal('declined');
        expect((deps.beginInstall as sinon.SinonStub).called).to.equal(false);
        expect((deps.persistDockerMode as sinon.SinonStub).called).to.equal(false);
    });

    it('poller gives up: warns, stays local (no persist/reload)', async () => {
        const deps = makeDeps({ waitForDockerReady: sinon.stub().resolves('gaveup') });
        expect(await runLocalDockerBootstrap(deps)).to.equal('setup-gaveup');
        expect((deps.pullImage as sinon.SinonStub).called).to.equal(false);
        expect((deps.persistDockerMode as sinon.SinonStub).called).to.equal(false);
        expect((deps.reload as sinon.SinonStub).called).to.equal(false);
        expect((deps.warn as sinon.SinonStub).calledOnce).to.equal(true);
    });

    it('pull fails: warns, does NOT switch mode', async () => {
        const deps = makeDeps({ pullImage: sinon.stub().resolves(false) });
        expect(await runLocalDockerBootstrap(deps)).to.equal('pull-failed');
        expect((deps.persistDockerMode as sinon.SinonStub).called).to.equal(false);
        expect((deps.reload as sinon.SinonStub).called).to.equal(false);
        expect((deps.warn as sinon.SinonStub).calledOnce).to.equal(true);
    });

    it('offline (no remote versions) + fallback accepted: installs with current tag', async () => {
        const deps = makeDeps({
            listRemoteVersions: sinon.stub().resolves([]),
            confirmOfflineFallback: sinon.stub().resolves(true),
        });
        expect(await runLocalDockerBootstrap(deps)).to.equal('switched');
        expect((deps.pickVersion as sinon.SinonStub).called).to.equal(false);
        expect((deps.pullImage as sinon.SinonStub).calledOnceWith('dali_2.5.26')).to.equal(true);
        expect((deps.persistDockerMode as sinon.SinonStub).calledOnceWith('dali_2.5.26')).to.equal(true);
    });

    it('offline + fallback declined: no-versions, nothing changes', async () => {
        const deps = makeDeps({
            listRemoteVersions: sinon.stub().resolves([]),
            confirmOfflineFallback: sinon.stub().resolves(false),
        });
        expect(await runLocalDockerBootstrap(deps)).to.equal('no-versions');
        expect((deps.beginInstall as sinon.SinonStub).called).to.equal(false);
        expect((deps.persistDockerMode as sinon.SinonStub).called).to.equal(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile`
Expected: FAIL — `Module '"../../src/localDockerBootstrap"' has no exported member 'runLocalDockerBootstrap'` (and `LocalDockerBootstrapDeps`).

- [ ] **Step 3: Write minimal implementation**

Append to `src/localDockerBootstrap.ts`:

```typescript
export interface LocalDockerBootstrapDeps {
    /** The docker access state observed just before this flow started. */
    accessState: string;
    /** The currently-configured runtime image tag (offline fallback target). */
    currentTag: string;
    /** Registry tag list — works without Docker (HTTPS). Return [] on failure. */
    listRemoteVersions: () => Promise<string[]>;
    /** Show the version picker; resolves to the chosen tag or undefined if cancelled. */
    pickVersion: (tags: string[], current: string) => Promise<string | undefined>;
    /** Confirm the heavier consequences (install + ~290 MB + mode switch). */
    confirmSetup: (version: string) => Promise<boolean>;
    /** Registry unreachable: confirm installing with the current tag instead. */
    confirmOfflineFallback: (tag: string) => Promise<boolean>;
    /** Kick off the install (fresh) or the daemon/permission fix, per accessState. */
    beginInstall: (accessState: string) => Promise<void>;
    /** Wait until Docker is reachable in THIS session; 'gaveup' on timeout/cancel. */
    waitForDockerReady: () => Promise<'ok' | 'gaveup'>;
    /** Download the chosen image tag. Resolves true on success. */
    pullImage: (tag: string) => Promise<boolean>;
    /** Persist runtimeMode=docker AND daliVersionTag=tag (success only). */
    persistDockerMode: (tag: string) => Promise<void>;
    /** Reload the window so the docker backend is picked at the next activation. */
    reload: () => Promise<void>;
    /** Surface a non-fatal warning to the user. */
    warn: (msg: string) => Promise<void>;
    /** Optional progress logging. */
    log?: (msg: string) => void;
}

/**
 * Orchestrate the local→docker bootstrap. Pure control flow over injected IO so
 * it is fully unit-testable. Persists the mode switch ONLY on complete success,
 * so a cancel/failure at any step leaves the user cleanly on the local runtime.
 */
export async function runLocalDockerBootstrap(
    deps: LocalDockerBootstrapDeps,
): Promise<BootstrapOutcome> {
    const log = deps.log ?? (() => {});

    // 1. Choose a version. The registry list needs no Docker; if it's empty
    //    (offline), offer to install with the current tag rather than dead-end.
    const remote = await deps.listRemoteVersions();
    let chosen: string;
    if (remote.length === 0) {
        log('[LocalBootstrap] No remote versions available — offering current-tag fallback.');
        if (!(await deps.confirmOfflineFallback(deps.currentTag))) {
            return 'no-versions';
        }
        chosen = deps.currentTag;
    } else {
        const pick = await deps.pickVersion(remote, deps.currentTag);
        if (!pick) {
            return 'cancelled-pick';
        }
        if (!(await deps.confirmSetup(pick))) {
            return 'declined';
        }
        chosen = pick;
    }

    // 2. Install Docker (or fix daemon/permission on an existing install).
    await deps.beginInstall(deps.accessState);

    // 3. Wait until this session can reach Docker (setfacl grants it, no reload).
    const ready = await deps.waitForDockerReady();
    if (ready === 'gaveup') {
        await deps.warn('Docker did not become available — staying on the local runtime.');
        return 'setup-gaveup';
    }

    // 4. Download the chosen image BEFORE the reload, so docker mode comes up ready.
    const pulled = await deps.pullImage(chosen);
    if (!pulled) {
        await deps.warn('Could not download the DALi runtime image — staying on the local runtime.');
        return 'pull-failed';
    }

    // 5. Commit the switch (mode + tag) only now, then reload to re-pick the backend.
    await deps.persistDockerMode(chosen);
    await deps.reload();
    log(`[LocalBootstrap] Switched to the docker runtime on '${chosen}'.`);
    return 'switched';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/localDockerBootstrap.test.js --require out/test/helpers/setup.js --timeout 10000`
Expected: PASS — 4 (Task 1) + 7 (Task 2) = 11 passing.

- [ ] **Step 5: Commit (only on user go-ahead)**

```bash
git add src/localDockerBootstrap.ts test/unit/localDockerBootstrap.test.ts
git commit -m "feat(runtime): orchestrate local→docker bootstrap (pick→install→pull→switch)"
```

---

### Task 3: Extract `buildVersionQuickPickItems`

**Files:**
- Modify: `src/checkUpdateCommand.ts` (extract the item-builder; `selectRuntimeVersionCommand` calls it)
- Test: `test/unit/checkUpdateCommand.test.ts` (append a `buildVersionQuickPickItems` describe block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `buildVersionQuickPickItems(orderedTags: string[], ctx: { current: string; localSet: Set<string>; versionByTag: Map<string, string | undefined> }): vscode.QuickPickItem[]`

**Context:** The item-mapping currently lives inline in `selectRuntimeVersionCommand` at `src/checkUpdateCommand.ts:185-199`. Extracting it lets the new remote-only picker (Task 5) reuse the exact label/description/detail rules. The existing `selectRuntimeVersionCommand` ordering tests (`checkUpdateCommand.test.ts:178-220`) must stay green — this is a behavior-preserving extraction.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/checkUpdateCommand.test.ts` (the file already imports `chai`; add `buildVersionQuickPickItems` to the existing import from `../../src/checkUpdateCommand`):

```typescript
describe('buildVersionQuickPickItems', () => {
    it('labels current, downloaded, and will-download; adds DALi detail for rolling tags', () => {
        const items = buildVersionQuickPickItems(['latest', 'dali_2.5.26', 'dali_2.5.18'], {
            current: 'latest',
            localSet: new Set(['latest', 'dali_2.5.26']),
            versionByTag: new Map([['latest', '2.5.26']]),
        });
        expect(items.map((i) => i.label)).to.deep.equal(['latest', 'dali_2.5.26', 'dali_2.5.18']);
        expect(items[0].description).to.contain('current');
        expect(items[0].description).to.contain('downloaded');
        expect(items[0].detail).to.equal('DALi 2.5.26');       // rolling tag → concrete version line
        expect(items[1].detail).to.equal(undefined);           // version-named tag needs no detail
        expect(items[2].description).to.contain('will download');
    });

    it('marks everything will-download when nothing is cached (docker unusable)', () => {
        const items = buildVersionQuickPickItems(['latest', 'dali_2.5.26'], {
            current: 'dali_2.5.26',
            localSet: new Set<string>(),
            versionByTag: new Map(),
        });
        expect(items.every((i) => (i.description ?? '').includes('will download'))).to.equal(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile`
Expected: FAIL — `Module '"../../src/checkUpdateCommand"' has no exported member 'buildVersionQuickPickItems'`.

- [ ] **Step 3: Write minimal implementation**

In `src/checkUpdateCommand.ts`, add the exported helper (place it just above `selectRuntimeVersionCommand`):

```typescript
/**
 * Map ordered runtime tags to QuickPick items with the shared label/description/
 * detail rules. Pure (the `vscode.QuickPickItem` annotation is erased at runtime)
 * so it is unit-testable and reused by the local→docker bootstrap picker.
 */
export function buildVersionQuickPickItems(
    orderedTags: string[],
    ctx: { current: string; localSet: Set<string>; versionByTag: Map<string, string | undefined> },
): vscode.QuickPickItem[] {
    return orderedTags.map((t) => {
        const cached = ctx.localSet.has(t);
        const parts = [
            t === ctx.current ? 'current' : '',
            cached ? 'downloaded' : 'will download (~290 MB)',
        ].filter(Boolean);
        const item: vscode.QuickPickItem = { label: t, description: parts.join(' · ') };
        const version = ctx.versionByTag.get(t);
        if (version && !/\d+\.\d+\.\d+/.test(t)) {
            item.detail = `DALi ${version}`;
        }
        return item;
    });
}
```

Then replace the inline mapping in `selectRuntimeVersionCommand` (`src/checkUpdateCommand.ts:185-199`) — the block that currently builds `const items: vscode.QuickPickItem[] = orderedTags.map(...)` — with a single call:

```typescript
    const items = buildVersionQuickPickItems(orderedTags, { current, localSet, versionByTag });
```

(Leave the surrounding `const current`, `rank`, `orderedTags`, and the `showQuickPick` call unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/checkUpdateCommand.test.js --require out/test/helpers/setup.js --timeout 10000`
Expected: PASS — the new 2 tests AND the pre-existing `selectRuntimeVersionCommand` ordering/detail tests all pass (behavior preserved).

- [ ] **Step 5: Commit (only on user go-ahead)**

```bash
git add src/checkUpdateCommand.ts test/unit/checkUpdateCommand.test.ts
git commit -m "refactor(runtime): extract buildVersionQuickPickItems for reuse"
```

---

### Task 4: Tag-explicit image ensure (`ensureRuntimeImageForTag`)

**Files:**
- Modify: `src/pullImageCommand.ts` (add `ensureRuntimeImageForTag`; make `ensureRuntimeImage` delegate)
- Test: `test/unit/pullImageCommand.test.ts` (append an `ensureRuntimeImageForTag` describe block)

**Interfaces:**
- Consumes: existing `DockerRuntime` (`hasImage`, `pullImage`, `imageRef`), `checkDockerAccess`.
- Produces: `ensureRuntimeImageForTag(runtime: DockerRuntime, tag: string, outputChannel: vscode.OutputChannel): Promise<boolean>`

**Context:** `ensureRuntimeImage` reads the tag from `ConfigurationService`. The bootstrap must pull the *chosen* tag while `runtimeMode`/`daliVersionTag` are still unchanged (persist-on-success). Extracting a tag-parameterized variant keeps the in-flight coalescing and lets `ensureRuntimeImage` delegate — behavior-preserving.

- [ ] **Step 1: Write the failing test**

Append to `test/unit/pullImageCommand.test.ts` (add `ensureRuntimeImageForTag` to the import from `../../src/pullImageCommand`; the file already imports `chai`/`sinon` — if it does not import `dockerAccessCheck`, add `import * as dockerAccessCheck from '../../src/dockerAccessCheck';`):

```typescript
describe('ensureRuntimeImageForTag', () => {
    const fakeOut = { appendLine: () => {}, append: () => {}, show: () => {}, dispose: () => {} } as any;
    function makeRt(over: Record<string, any> = {}) {
        return {
            hasImage: sinon.stub().resolves(false),
            pullImage: sinon.stub().resolves(undefined),
            imageRef: (t: string) => `ghcr.io/test/img:${t}`,
            ...over,
        } as any;
    }
    afterEach(() => sinon.restore());

    it('returns false without pulling when docker is not accessible', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'permission-denied' } as any);
        const rt = makeRt();
        expect(await ensureRuntimeImageForTag(rt, 'dali_2.5.26', fakeOut)).to.equal(false);
        expect(rt.pullImage.called).to.equal(false);
    });

    it('returns true without pulling when the tag is already cached', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRt({ hasImage: sinon.stub().resolves(true) });
        expect(await ensureRuntimeImageForTag(rt, 'dali_2.5.26', fakeOut)).to.equal(true);
        expect(rt.pullImage.called).to.equal(false);
    });

    it('pulls the SPECIFIED tag when missing', async () => {
        sinon.stub(dockerAccessCheck, 'checkDockerAccess').resolves({ state: 'ok' } as any);
        const rt = makeRt();
        expect(await ensureRuntimeImageForTag(rt, 'dali_2.5.26', fakeOut)).to.equal(true);
        expect(rt.pullImage.calledOnce).to.equal(true);
        expect(rt.pullImage.firstCall.args[0]).to.equal('dali_2.5.26');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run compile`
Expected: FAIL — `Module '"../../src/pullImageCommand"' has no exported member 'ensureRuntimeImageForTag'`.

- [ ] **Step 3: Write minimal implementation**

In `src/pullImageCommand.ts`, add the tag-explicit function (place it directly above `ensureRuntimeImage`) and rewrite `ensureRuntimeImage` to delegate:

```typescript
/**
 * Like `ensureRuntimeImage`, but for an EXPLICIT tag rather than the configured
 * one — used by the local→docker bootstrap to download the tag the user just
 * picked while `daliVersionTag` is still unchanged. Never throws.
 */
export async function ensureRuntimeImageForTag(
    runtime: DockerRuntime,
    tag: string,
    outputChannel: vscode.OutputChannel,
): Promise<boolean> {
    const access = await checkDockerAccess();
    if (access.state !== 'ok') {
        outputChannel.appendLine(
            `[Runtime] ensureRuntimeImageForTag skipped — docker state ${access.state}`,
        );
        return false;
    }

    if (await runtime.hasImage(tag)) {
        return true;
    }

    const existing = inFlightPulls.get(tag);
    if (existing) {
        outputChannel.appendLine(
            `[Runtime] Joining in-flight pull for ${runtime.imageRef(tag)} (no duplicate download).`,
        );
        return existing;
    }

    const pull = pullWithProgress(runtime, tag, outputChannel);
    inFlightPulls.set(tag, pull);
    try {
        return await pull;
    } finally {
        inFlightPulls.delete(tag);
    }
}
```

Replace the body of `ensureRuntimeImage` (`src/pullImageCommand.ts:262-297`) with a delegation:

```typescript
export async function ensureRuntimeImage(
    runtime: DockerRuntime,
    outputChannel: vscode.OutputChannel,
): Promise<boolean> {
    const tag = ConfigurationService.getInstance().daliVersionTag;
    return ensureRuntimeImageForTag(runtime, tag, outputChannel);
}
```

(Keep the `inFlightPulls` map and `pullWithProgress` where they are — `ensureRuntimeImageForTag` uses them.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run compile && npx mocha out/test/unit/pullImageCommand.test.js --require out/test/helpers/setup.js --timeout 10000`
Expected: PASS — the new 3 tests plus all pre-existing `formatPullMessage`/`analyzePullError` tests.

- [ ] **Step 5: Commit (only on user go-ahead)**

```bash
git add src/pullImageCommand.ts test/unit/pullImageCommand.test.ts
git commit -m "refactor(runtime): add ensureRuntimeImageForTag; ensureRuntimeImage delegates"
```

---

### Task 5: Wire the command + CHANGELOG + full verify

**Files:**
- Modify: `src/extension.ts` (imports; add `waitForDockerReadyWithProgress`; rewrite the `local` branch of the `dali.selectRuntimeVersion` handler at `src/extension.ts:559-577`)
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: `decideLocalVersionAction`, `decideInstallAction`, `runLocalDockerBootstrap`, `LocalDockerBootstrapDeps` (Tasks 1-2); `buildVersionQuickPickItems` (Task 3); `ensureRuntimeImageForTag` (Task 4); existing `checkDockerAccess`, `showDockerSetupGuidance`, `installDockerCommand`, `DockerAccessPoller`, `listRemoteTags`, `DockerRuntime`, `selectRuntimeVersionCommand`, `ConfigurationService`.
- Produces: no new exports (extension wiring). This is thin VS Code glue — its decision/sequencing logic is already unit-tested via Tasks 1-4; verification here is compile + full suite + a documented manual smoke test.

- [ ] **Step 1: Add imports**

In `src/extension.ts`, extend the existing imports:

- Add to the `./checkUpdateCommand` import (currently `checkRuntimeUpdateCommand, maybeAutoCheckRuntimeUpdate, selectRuntimeVersionCommand`): add `buildVersionQuickPickItems`.
- Add to the `./pullImageCommand` import (currently `pullRuntimeImageCommand, ensureRuntimeImage`): add `ensureRuntimeImageForTag`.
- Add new imports:

```typescript
import { listRemoteTags } from './registryClient';
import {
    decideLocalVersionAction,
    decideInstallAction,
    runLocalDockerBootstrap,
} from './localDockerBootstrap';
```

- [ ] **Step 2: Add the `waitForDockerReadyWithProgress` helper**

Add this module-scope function near the bottom of `src/extension.ts` (e.g. beside the other module helpers). It wraps `DockerAccessPoller` in a cancellable progress notification and resolves `'ok'`/`'gaveup'`:

```typescript
/**
 * Wait for Docker to become reachable in this session, showing a cancellable
 * progress notification. Resolves 'ok' the moment access is granted (setfacl,
 * no reload) or 'gaveup' on timeout/cancel. Used by the local→docker bootstrap.
 */
function waitForDockerReadyWithProgress(): Promise<'ok' | 'gaveup'> {
    return new Promise((resolve) => {
        void vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'DALi Preview · Docker setup',
                cancellable: true,
            },
            (progress, token) => new Promise<void>((done) => {
                progress.report({ message: 'Waiting for Docker to become available…' });
                const poller = new DockerAccessPoller({
                    onTick: (a, max) => progress.report({ message: `Waiting for Docker… (${a}/${max})` }),
                    onOk: () => { resolve('ok'); done(); },
                    onGiveUp: () => { resolve('gaveup'); done(); },
                });
                token.onCancellationRequested(() => { poller.stop(); resolve('gaveup'); done(); });
                poller.start();
            }),
        );
    });
}
```

- [ ] **Step 3: Rewrite the `local` branch of the command handler**

Replace the body of the `dali.selectRuntimeVersion` handler (`src/extension.ts:559-577`) with:

```typescript
        vscode.commands.registerCommand('dali.selectRuntimeVersion', async () => {
            if (!isLocalRuntime && dockerRuntime) {
                await selectRuntimeVersionCommand(dockerRuntime, outputChannel, async () => { await initPreviewServer(); });
                return;
            }
            // Local mode. If docker is reachable we can list versions and switch
            // (existing path). If not, bootstrap docker: pick from the registry,
            // install/fix, pull the chosen image, then switch to docker + reload.
            const cfg = ConfigurationService.getInstance();
            const runtime = new DockerRuntime(cfg.dockerImage);
            const access = await checkDockerAccess();

            if (decideLocalVersionAction({ accessState: access.state }) === 'list-and-switch') {
                const picked = await selectRuntimeVersionCommand(runtime, outputChannel, async () => {});
                if (!picked) {
                    return; // cancelled — stay in local mode
                }
                await cfg.update('runtimeMode', 'docker', vscode.ConfigurationTarget.Global);
                const choice = await vscode.window.showInformationMessage(
                    `DALi Preview: switching to the Docker runtime (${picked}). Reload the window to apply.`,
                    'Reload Window',
                );
                if (choice === 'Reload Window') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
                return;
            }

            // Docker not usable yet — run the bootstrap flow.
            await runLocalDockerBootstrap({
                accessState: access.state,
                currentTag: cfg.daliVersionTag,
                listRemoteVersions: async () => {
                    try { return await listRemoteTags(runtime.getImageName()); }
                    catch { return []; }
                },
                pickVersion: async (tags, current) => {
                    // Docker is unusable, so nothing is cached locally → all "will download".
                    const items = buildVersionQuickPickItems(tags, {
                        current,
                        localSet: new Set<string>(),
                        versionByTag: new Map<string, string | undefined>(),
                    });
                    const pick = await vscode.window.showQuickPick(items, {
                        placeHolder: 'Select a DALi runtime version to install and preview with',
                        ignoreFocusOut: true,
                    });
                    return pick?.label;
                },
                confirmSetup: async (version) => {
                    const choice = await vscode.window.showInformationMessage(
                        `DALi Preview will install Docker, download the ${version} runtime image (~290 MB), ` +
                        'and switch to the Docker runtime. Enter your password once — the rest is automatic.',
                        { modal: true },
                        'Set Up Docker',
                    );
                    return choice === 'Set Up Docker';
                },
                confirmOfflineFallback: async (tag) => {
                    const choice = await vscode.window.showWarningMessage(
                        'Could not reach the registry to list versions. Install Docker and download the ' +
                        `current runtime image (${tag}) instead?`,
                        { modal: true },
                        'Set Up Docker',
                    );
                    return choice === 'Set Up Docker';
                },
                beginInstall: async (state) => {
                    if (decideInstallAction(state) === 'install') {
                        await installDockerCommand();
                    } else {
                        await showDockerSetupGuidance(access, outputChannel);
                    }
                },
                waitForDockerReady: () => waitForDockerReadyWithProgress(),
                pullImage: (tag) => ensureRuntimeImageForTag(runtime, tag, outputChannel),
                persistDockerMode: async (tag) => {
                    await cfg.update('daliVersionTag', tag, vscode.ConfigurationTarget.Global);
                    await cfg.update('runtimeMode', 'docker', vscode.ConfigurationTarget.Global);
                },
                reload: async () => { await vscode.commands.executeCommand('workbench.action.reloadWindow'); },
                warn: async (msg) => { await vscode.window.showWarningMessage(msg); },
                log: (msg) => outputChannel.appendLine(msg),
            });
        }),
```

- [ ] **Step 4: Verify compile**

Run: `npm run compile`
Expected: PASS — zero errors.

- [ ] **Step 5: Update CHANGELOG**

Open `CHANGELOG.md`, and under the top-most "Unreleased" / next-version heading (match the existing format — add an `### Added` bullet), insert:

```markdown
- Local runtime users can now bootstrap Docker directly from **DALi Preview: Select Runtime Version**: when Docker isn't installed/usable, the command lets you pick a version from the registry, installs/fixes Docker, downloads that image, and switches to the Docker runtime (previously it dead-ended with a "docker is not accessible" warning).
```

- [ ] **Step 6: Run the full unit suite**

Run: `npm run test:unit:no-coverage`
Expected: PASS — all suites, including the new `localDockerBootstrap` (11), the extended `checkUpdateCommand` and `pullImageCommand` tests, and every pre-existing test (no regressions).

- [ ] **Step 7: Manual smoke test (documented — not automated)**

Real Docker install can't be automated safely. Record these manual steps in the PR description:
1. In VS Code User settings, set `"daliPreview.runtimeMode": "local"`; ensure `docker` is uninstalled (or daemon stopped).
2. Run **DALi Preview: Select Runtime Version**.
3. Expect: registry version picker → confirm modal → Docker install terminal (one password) → "Waiting for Docker…" progress → image download → window reload into Docker mode with the chosen version.
4. Cancel at the picker / confirm → expect no settings change, still local runtime.

- [ ] **Step 8: Commit (only on user go-ahead)**

```bash
git add src/extension.ts CHANGELOG.md
git commit -m "feat(runtime): bootstrap Docker from Select Runtime Version in local mode"
```

---

## Self-Review

**1. Spec coverage:**
- Scope: local-only, command-triggered, all not-ok states → Tasks 1 (`decideLocalVersionAction` all states) + 5 (handler gates on `isLocalRuntime`). ✓
- Version-first flow (registry list → pick → confirm → install → wait → pull → switch) → Task 2 orchestrator + Task 5 wiring. ✓
- All not-ok states handled (install vs guidance) → `decideInstallAction` (Task 1) + `beginInstall` wiring (Task 5). ✓
- Persist on success only → Task 2 (persist/reload after successful pull) + tests for gaveup/pull-failed. ✓
- Offline fallback → Task 2 (`confirmOfflineFallback` branch) + tests. ✓
- Pull the CHOSEN tag before reload → Task 4 (`ensureRuntimeImageForTag`) + Task 5 (`pullImage` dep) + Task 2 happy-path asserts `pullImage('latest')`. ✓
- Testing strategy (pure classifiers + orchestration seam + picker helper) → Tasks 1-4 tests. ✓
- e2e honesty (machine-level not automatable) → Task 5 Step 7 manual smoke. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step has full code. ✓

**3. Type consistency:** `BootstrapOutcome` values match across Task 2 impl and tests (`switched`/`no-versions`/`cancelled-pick`/`declined`/`setup-gaveup`/`pull-failed`). `waitForDockerReady(): Promise<'ok' | 'gaveup'>` matches `waitForDockerReadyWithProgress` (Task 5). `pullImage(tag)`/`persistDockerMode(tag)` signatures match wiring. `buildVersionQuickPickItems(orderedTags, { current, localSet, versionByTag })` identical in Tasks 3 and 5. `ensureRuntimeImageForTag(runtime, tag, outputChannel)` identical in Tasks 4 and 5. ✓
