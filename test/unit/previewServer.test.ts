import { expect } from 'chai';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { getPluginCodeOffset, getHarnessCodeOffset, parseGccErrors } from '../../src/errorParser';
import { PreviewServer } from '../../src/previewServer';

const PLUGIN_TEMPLATE_PATH  = path.resolve(__dirname, '../../../server/preview_plugin.cpp.template');
const HARNESS_TEMPLATE_PATH = path.resolve(__dirname, '../../../server/preview_harness.cpp.template');

// ---------------------------------------------------------------------------
// Plugin template structure tests
// ---------------------------------------------------------------------------

describe('previewServer — plugin template', () => {
    it('plugin template file exists', () => {
        expect(fs.existsSync(PLUGIN_TEMPLATE_PATH)).to.equal(true);
    });

    it('plugin template contains {{USER_CODE}} placeholder', () => {
        const content = fs.readFileSync(PLUGIN_TEMPLATE_PATH, 'utf-8');
        expect(content).to.include('{{USER_CODE}}');
    });

    it('plugin template exports CreatePreview as C symbol', () => {
        const content = fs.readFileSync(PLUGIN_TEMPLATE_PATH, 'utf-8');
        expect(content).to.include('extern "C"');
        expect(content).to.include('CreatePreview');
    });

    it('plugin template includes __tag helper', () => {
        const content = fs.readFileSync(PLUGIN_TEMPLATE_PATH, 'utf-8');
        expect(content).to.include('__tag');
    });

    it('plugin template uses -fPIC compatible includes', () => {
        const content = fs.readFileSync(PLUGIN_TEMPLATE_PATH, 'utf-8');
        expect(content).to.include('#include <dali/dali.h>');
    });

    it('plugin template exports animation-scrub control symbols', () => {
        const content = fs.readFileSync(PLUGIN_TEMPLATE_PATH, 'utf-8');
        expect(content).to.include('__RegisterPreviewAnimation');
        expect(content).to.include('__SetPreviewProgress');
        expect(content).to.include('__PreviewAnimationCount');
        expect(content).to.include('__PreviewAnimationDuration');
    });

    it('scrub control pauses at registration and seeks without re-Play (no bake collapse)', () => {
        const content = fs.readFileSync(PLUGIN_TEMPLATE_PATH, 'utf-8');
        // Register pauses the animation so it never finishes + BAKEs its end values.
        const reg = content.slice(
            content.indexOf('void __RegisterPreviewAnimation'),
            content.indexOf('__PreviewAnimationCount'),
        );
        expect(reg).to.include('.Pause()');
        // SetPreviewProgress seeks via SetCurrentProgress only — re-Play()ing would
        // re-capture a drifted/baked start value and collapse the animation range.
        const setProg = content.slice(
            content.indexOf('void __SetPreviewProgress'),
            content.indexOf('{{USER_GLOBALS}}'),
        );
        expect(setProg).to.include('SetCurrentProgress');
        expect(setProg).to.not.include('.Play(');
    });
});

// ---------------------------------------------------------------------------
// getPluginCodeOffset
// ---------------------------------------------------------------------------

describe('previewServer — getPluginCodeOffset()', () => {
    it('returns positive offset for the real plugin template', () => {
        const template = fs.readFileSync(PLUGIN_TEMPLATE_PATH, 'utf-8');
        const offset = getPluginCodeOffset(template);
        expect(offset).to.be.greaterThan(0);
    });

    it('offset points at the {{USER_CODE}} line', () => {
        const template = fs.readFileSync(PLUGIN_TEMPLATE_PATH, 'utf-8');
        const offset = getPluginCodeOffset(template);
        const lines = template.split('\n');
        expect(lines[offset - 1]).to.include('{{USER_CODE}}');
    });

    it('plugin offset is independent from harness offset', () => {
        const pluginTemplate  = fs.readFileSync(PLUGIN_TEMPLATE_PATH, 'utf-8');
        const harnessTemplate = fs.readFileSync(HARNESS_TEMPLATE_PATH, 'utf-8');
        const pluginOffset  = getPluginCodeOffset(pluginTemplate);
        const harnessOffset = getHarnessCodeOffset(harnessTemplate);
        // Both must be valid; values may differ because templates have different preamble lengths
        expect(pluginOffset).to.be.greaterThan(0);
        expect(harnessOffset).to.be.greaterThan(0);
    });
});

// ---------------------------------------------------------------------------
// parseGccErrors — plugin mode (isPlugin = true)
// ---------------------------------------------------------------------------

describe('previewServer — parseGccErrors() in plugin mode', () => {
    // M5: Derive PLUGIN_OFFSET dynamically from the real template
    const PLUGIN_OFFSET = (() => {
        const template = fs.readFileSync(PLUGIN_TEMPLATE_PATH, 'utf-8');
        return getPluginCodeOffset(template);
    })();

    it('parses errors from preview_plugin.cpp', () => {
        const pluginLine = PLUGIN_OFFSET + 2; // inside the user-code region
        const stderr = [
            `/tmp/dali_preview/preview_plugin.cpp:${pluginLine}:5: error: use of undeclared identifier 'foo'`,
            '/tmp/other/unrelated.cpp:5:1: error: unrelated error',
        ].join('\n');

        const errors = parseGccErrors(stderr, PLUGIN_OFFSET, true);
        expect(errors).to.have.length(1);
        expect(errors[0].message).to.include('foo');
    });

    it('ignores preview_harness.cpp errors in plugin mode', () => {
        const hLine = PLUGIN_OFFSET + 5; // inside the user-code region
        const pLine = PLUGIN_OFFSET + 2;
        const stderr =
            `/tmp/dali_preview/preview_harness.cpp:${hLine}:3: error: harness error\n` +
            `/tmp/dali_preview/preview_plugin.cpp:${pLine}:3: error: plugin error\n`;

        const errorsPlugin  = parseGccErrors(stderr, PLUGIN_OFFSET, true);
        const errorsHarness = parseGccErrors(stderr, PLUGIN_OFFSET, false);

        // Plugin mode: only plugin errors
        expect(errorsPlugin).to.have.length(1);
        expect(errorsPlugin[0].message).to.equal('plugin error');

        // Harness mode: only harness errors
        expect(errorsHarness).to.have.length(1);
        expect(errorsHarness[0].message).to.equal('harness error');
    });

    it('maps plugin line numbers back to user code (subtracts offset)', () => {
        const offset = PLUGIN_OFFSET;
        const gccLine = offset + 6; // a line clearly inside user code
        const stderr = `/tmp/dali_preview/preview_plugin.cpp:${gccLine}:1: error: bad code`;

        const errors = parseGccErrors(stderr, offset, true);
        expect(errors).to.have.length(1);
        expect(errors[0].line).to.equal(gccLine - offset);
    });

    it('skips errors above the user code region (negative mapped line)', () => {
        const offset = PLUGIN_OFFSET;
        const gccLine = 5; // before user code starts
        const stderr = `/tmp/dali_preview/preview_plugin.cpp:${gccLine}:1: error: preamble error`;

        const errors = parseGccErrors(stderr, offset, true);
        expect(errors).to.have.length(0);
    });
});

// ---------------------------------------------------------------------------
// preview_server.cpp existence and structure
// ---------------------------------------------------------------------------

describe('previewServer — preview_server.cpp', () => {
    const SERVER_CPP = path.resolve(__dirname, '../../../docker/preview_server.cpp');

    it('preview_server.cpp exists', () => {
        expect(fs.existsSync(SERVER_CPP)).to.equal(true);
    });

    it('implements RELOAD command handling', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('RELOAD');
    });

    it('outputs READY signal', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('READY');
    });

    it('outputs OK: on success', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('OK:');
    });

    it('outputs ERROR: on failure', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('ERROR:');
    });

    it('uses dlopen for dynamic loading', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('dlopen');
        expect(content).to.include('dlclose');
        expect(content).to.include('dlsym');
    });

    it('uses non-blocking stdin polling', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('O_NONBLOCK');
    });

    it('preview_server.cpp buffers stdin to avoid IPC line loss', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('mStdinBuf');
    });
});

// ---------------------------------------------------------------------------
// PreviewServer TypeScript class — IPC behavior (C6)
// ---------------------------------------------------------------------------

const fakeOutputChannel = {
    appendLine: () => {},
    append: () => {},
    show: () => {},
    dispose: () => {},
} as any;

function makeProc() {
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin  = { write: sinon.stub() };
    proc.killed = false;
    proc.kill   = sinon.stub().callsFake(() => { proc.killed = true; });
    return proc;
}

// Docker-only: a minimal fake DockerRuntime so spawnServer/buildSpawnCommand
// (which always take the container path now) don't dereference undefined.
const fakeDockerRuntime = {
    imageRef: (tag: string) => `ghcr.io/test/dali-preview-runtime:${tag}`,
    setActiveServerContainer: () => {},
} as any;

/** Creates a PreviewServer with a controllable fake child process. */
function makeServer(proc?: any) {
    const fakeProc = proc ?? makeProc();
    const server = new PreviewServer(
        '/ext', fakeOutputChannel, '/tmp/dali_preview', fakeDockerRuntime, 'test-tag',
    );
    // Bypass binary compilation — not relevant to IPC behavior tests
    (server as any).ensureServerBinary = async () => {};
    // The stale-container cleanup shells out to `docker rm -f`; no-op it so the
    // IPC tests never touch a real docker daemon.
    (server as any)._killStaleContainer = () => {};
    // Inject fake process via overridable _spawn hook
    (server as any)._spawn = () => fakeProc;
    return { server, proc: fakeProc };
}

/** Creates a server, starts it, and emits READY so the server is ready to use. */
async function startedServer(proc?: any) {
    const { server, proc: fakeProc } = makeServer(proc);
    const startPromise = server.start();
    // ensureServerBinary() is an async no-op; one microtask tick lets
    // spawnServer() run and register stdout/exit handlers before we emit.
    await Promise.resolve();
    fakeProc.stdout.emit('data', Buffer.from('>>>READY\n'));
    await startPromise;
    return { server, proc: fakeProc };
}

describe('PreviewServer — docker spawn command', () => {
    it('mounts tmpDir at BOTH its own path and /work (staged image assets)', () => {
        // Regression guard: stageImageAssets rewrites local ImageView URLs to
        // `/work/<name>` in docker mode. If the container has no /work mount, a
        // staged image renders as the broken-image placeholder. Both mounts
        // must be present: tmpDir:tmpDir (scene JSON / png paths) and
        // tmpDir:/work (the rewritten image URLs).
        const { server } = makeServer();
        const [cmd, args] = (server as any).buildSpawnCommand();
        expect(cmd).to.equal('docker');
        // Reconstruct the `-v A:B` pairs so we assert on whole mounts, not
        // substrings (which could match a longer path by accident).
        const mounts: string[] = [];
        for (let i = 0; i < args.length - 1; i++) {
            if (args[i] === '-v') { mounts.push(args[i + 1]); }
        }
        expect(mounts).to.include('/tmp/dali_preview:/tmp/dali_preview');
        expect(mounts).to.include('/tmp/dali_preview:/work');
    });
});

describe('PreviewServer — IPC behavior', () => {
    afterEach(() => {
        sinon.restore();
    });

    it('start() resolves true after READY signal', async () => {
        const { server } = await startedServer();
        expect(server.isRunning).to.equal(true);
    });

    it('processStdoutBuffer: OK: response resolves reload() with pngPath and stored metadataPath', async () => {
        const { server, proc } = await startedServer();

        const reloadPromise = server.reload(
            '/tmp/a.so', '/tmp/a.png', '/tmp/a_metadata.json', 1024, 600
        );
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/a.png\n'));

        const result = await reloadPromise;
        expect(result.success).to.equal(true);
        expect(result.pngPath).to.equal('/tmp/a.png');
        // metadataPath comes from stored pendingRequest, not derived from pngPath
        expect(result.metadataPath).to.equal('/tmp/a_metadata.json');
    });

    it('processStdoutBuffer: ERROR: response resolves reload() with {success:false}', async () => {
        const { server, proc } = await startedServer();

        const reloadPromise = server.reload(
            '/tmp/a.so', '/tmp/a.png', '/tmp/a_metadata.json', 1024, 600
        );
        proc.stdout.emit('data', Buffer.from('>>>ERROR:dlopen failed\n'));

        const result = await reloadPromise;
        expect(result.success).to.equal(false);
        expect(result.error).to.equal('dlopen failed');
    });

    it('concurrent reload() — first caller receives "already in progress" error', async () => {
        const { server, proc } = await startedServer();

        const first  = server.reload('/tmp/a.so', '/tmp/a.png', '/tmp/a_meta.json', 1024, 600);
        const second = server.reload('/tmp/b.so', '/tmp/b.png', '/tmp/b_meta.json', 1024, 600);

        const firstResult = await first;
        expect(firstResult.success).to.equal(false);
        expect(firstResult.error).to.include('already in progress');

        // Resolve second to avoid test hanging
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/b.png\n'));
        const secondResult = await second;
        expect(secondResult.success).to.equal(true);
    });

    it('server crash resolves pending reload() with {success:false}', async () => {
        const { server, proc } = await startedServer();

        const reloadPromise = server.reload(
            '/tmp/a.so', '/tmp/a.png', '/tmp/a_meta.json', 1024, 600
        );
        proc.emit('exit', 1);

        const result = await reloadPromise;
        expect(result.success).to.equal(false);
        expect(result.error).to.include('exited');
    });

    it('MAX_RESTARTS exceeded — no further _spawn after 3 consecutive crashes', async () => {
        const procs: any[] = [];
        let spawnCount = 0;

        const server = new PreviewServer(
            '/ext', fakeOutputChannel, '/tmp/dali_preview', fakeDockerRuntime, 'test-tag',
        );
        (server as any).ensureServerBinary = async () => {};
        (server as any)._killStaleContainer = () => {};
        (server as any)._spawn = () => {
            spawnCount++;
            const p = makeProc();
            procs.push(p);
            return p;
        };

        const clock = sinon.useFakeTimers();

        // Start and let server become READY (restartCount resets to 0)
        const startPromise = server.start();
        await Promise.resolve();
        procs[0].stdout.emit('data', Buffer.from('>>>READY\n'));
        await startPromise;

        // Crash 3 times WITHOUT emitting READY so restartCount accumulates: 0→1→2→3
        procs[0].emit('exit', 1);
        await clock.tickAsync(501); // proc[1] spawned, restartCount=1

        procs[1].emit('exit', 1);
        await clock.tickAsync(501); // proc[2] spawned, restartCount=2

        procs[2].emit('exit', 1);
        await clock.tickAsync(501); // proc[3] spawned, restartCount=3

        const countAfter3Restarts = spawnCount; // 4 (1 initial + 3 restarts)

        // Fourth crash: restartCount=3, 3 < MAX_RESTARTS(3) is false → NO restart
        procs[3].emit('exit', 1);
        await clock.tickAsync(501);

        expect(spawnCount).to.equal(countAfter3Restarts);
        clock.restore();
    });

    it('start() returns false on READY_TIMEOUT', async () => {
        const clock = sinon.useFakeTimers();
        const { server } = makeServer();
        const startPromise = server.start();

        await clock.tickAsync(15001);

        const result = await startPromise;
        expect(result).to.equal(false);
        clock.restore();
    });

    it('reload() rejects paths containing whitespace', async () => {
        const { server } = await startedServer();

        const result = await server.reload(
            '/tmp/a b.so', '/tmp/a.png', '/tmp/a_meta.json', 1024, 600
        );
        expect(result.success).to.equal(false);
        expect(result.error).to.include('invalid characters');
    });

    it('reload() appends valid bgColor to RELOAD command', async () => {
        const { server, proc } = await startedServer();

        const reloadPromise = server.reload(
            '/tmp/a.so', '/tmp/a.png', '/tmp/a_meta.json', 1024, 600, 'dark', '#ff8800'
        );
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/a.png\n'));
        await reloadPromise;

        const writtenCmd: string = proc.stdin.write.lastCall.args[0];
        expect(writtenCmd).to.include('#ff8800');
        // IPC format: RELOAD so png meta w h theme bgColor locale fontScale font
        const parts = writtenCmd.trim().split(' ');
        expect(parts).to.have.length(11);
        expect(parts[7]).to.equal('#ff8800');
    });

    it('reload() uses - placeholder for bgColor when invalid hex is supplied', async () => {
        const { server, proc } = await startedServer();

        const reloadPromise = server.reload(
            '/tmp/a.so', '/tmp/a.png', '/tmp/a_meta.json', 1024, 600, 'dark', 'invalid'
        );
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/a.png\n'));
        await reloadPromise;

        const writtenCmd: string = proc.stdin.write.lastCall.args[0];
        expect(writtenCmd).to.not.include('invalid');
        // bgColor field should be '-' placeholder, full 11 fields still sent
        const parts = writtenCmd.trim().split(' ');
        expect(parts).to.have.length(11);
        expect(parts[7]).to.equal('-');
    });

    it('reload() uses - placeholder for bgColor when undefined', async () => {
        const { server, proc } = await startedServer();

        const reloadPromise = server.reload(
            '/tmp/a.so', '/tmp/a.png', '/tmp/a_meta.json', 1024, 600, 'dark', undefined
        );
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/a.png\n'));
        await reloadPromise;

        const writtenCmd: string = proc.stdin.write.lastCall.args[0];
        const parts = writtenCmd.trim().split(' ');
        expect(parts).to.have.length(11);
        expect(parts[7]).to.equal('-');
    });

    it('reload() passes locale, fontScale, font in correct positions', async () => {
        const { server, proc } = await startedServer();

        const reloadPromise = server.reload(
            '/tmp/a.so', '/tmp/a.png', '/tmp/a_meta.json', 1024, 600, 'dark',
            undefined, 'ko_KR', 1.5, 'NotoSansKR.ttf'
        );
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/a.png\n'));
        await reloadPromise;

        const writtenCmd: string = proc.stdin.write.lastCall.args[0];
        const parts = writtenCmd.trim().split(' ');
        expect(parts).to.have.length(11);
        expect(parts[8]).to.equal('ko_KR');
        expect(parts[9]).to.equal('1.5');
        expect(parts[10]).to.equal('NotoSansKR.ttf');
    });

    it('reload() uses - placeholders when locale/fontScale/font are omitted', async () => {
        const { server, proc } = await startedServer();

        const reloadPromise = server.reload(
            '/tmp/a.so', '/tmp/a.png', '/tmp/a_meta.json', 1024, 600
        );
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/a.png\n'));
        await reloadPromise;

        const writtenCmd: string = proc.stdin.write.lastCall.args[0];
        const parts = writtenCmd.trim().split(' ');
        expect(parts).to.have.length(11);
        expect(parts[8]).to.equal('-');
        expect(parts[9]).to.equal('-');
        expect(parts[10]).to.equal('-');
    });
});

// ---------------------------------------------------------------------------
// PreviewServer — renderJson() IPC behavior
// ---------------------------------------------------------------------------

describe('PreviewServer — renderJson() IPC behavior', () => {
    let fsMkdirStub: sinon.SinonStub;
    let fsWriteFileStub: sinon.SinonStub;

    beforeEach(() => {
        fsMkdirStub  = sinon.stub(fs.promises, 'mkdir').resolves();
        fsWriteFileStub = sinon.stub(fs.promises, 'writeFile').resolves();
    });

    afterEach(() => {
        sinon.restore();
    });

    const scene = {
        type: 'View',
        constructorArgs: [],
        properties: {},
        children: [],
    };

    it('resolves {success:true, pngPath} when server responds OK:', async () => {
        const { server, proc } = await startedServer();

        const renderPromise = server.renderJson(scene, '/tmp/a.png', '/tmp/a_meta.json', 1024, 600);
        // Wait for async mkdir/writeFile stubs to resolve so pendingRequest is set
        await Promise.resolve(); await Promise.resolve();
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/a.png\n'));

        const result = await renderPromise;
        expect(result.success).to.equal(true);
        expect(result.pngPath).to.equal('/tmp/a.png');
        expect(result.metadataPath).to.equal('/tmp/a_meta.json');
    });

    it('resolves {success:false} when server responds ERROR:', async () => {
        const { server, proc } = await startedServer();

        const renderPromise = server.renderJson(scene, '/tmp/a.png', '/tmp/a_meta.json', 1024, 600);
        await Promise.resolve(); await Promise.resolve();
        proc.stdout.emit('data', Buffer.from('>>>ERROR:scene parse failed\n'));

        const result = await renderPromise;
        expect(result.success).to.equal(false);
        expect(result.error).to.equal('scene parse failed');
    });

    it('returns {success:false} immediately when server is not running', async () => {
        const { server } = makeServer();
        const result = await server.renderJson(scene, '/tmp/a.png', '/tmp/a_meta.json', 1024, 600);
        expect(result.success).to.equal(false);
        expect(result.error).to.include('not running');
    });

    it('rejects pngPath containing whitespace', async () => {
        const { server } = await startedServer();
        const result = await server.renderJson(scene, '/tmp/a b.png', '/tmp/a_meta.json', 1024, 600);
        expect(result.success).to.equal(false);
        expect(result.error).to.include('invalid characters');
    });

    it('rejects metadataPath containing newline', async () => {
        const { server } = await startedServer();
        const result = await server.renderJson(scene, '/tmp/a.png', '/tmp/a\nmeta.json', 1024, 600);
        expect(result.success).to.equal(false);
        expect(result.error).to.include('invalid characters');
    });

    it('writes scene JSON to a unique /tmp/dali_preview/scene-*.json file', async () => {
        const { server, proc } = await startedServer();

        const renderPromise = server.renderJson(scene, '/tmp/a.png', '/tmp/a_meta.json', 1024, 600);
        await Promise.resolve(); await Promise.resolve();
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/a.png\n'));
        await renderPromise;

        expect(fsWriteFileStub.calledOnce).to.be.true;
        const writtenPath: string = fsWriteFileStub.firstCall.args[0];
        expect(writtenPath).to.match(/^\/tmp\/dali_preview\/scene-\d+\.json$/);
    });

    it('sends RENDER_JSON command to server stdin', async () => {
        const { server, proc } = await startedServer();

        const renderPromise = server.renderJson(scene, '/tmp/a.png', '/tmp/a_meta.json', 1024, 600);
        await Promise.resolve(); await Promise.resolve();
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/a.png\n'));
        await renderPromise;

        const writtenCmd: string = proc.stdin.write.lastCall.args[0];
        expect(writtenCmd).to.include('RENDER_JSON');
        expect(writtenCmd).to.include('/tmp/a.png');
        expect(writtenCmd).to.include('/tmp/a_meta.json');
    });

    it('concurrent renderJson() — first caller receives "already in progress" error', async () => {
        const { server, proc } = await startedServer();

        // Both calls are started; first is displaced by second during the async setup
        const first  = server.renderJson(scene, '/tmp/a.png', '/tmp/a_meta.json', 1024, 600);
        await Promise.resolve(); await Promise.resolve();
        const second = server.renderJson(scene, '/tmp/b.png', '/tmp/b_meta.json', 1024, 600);
        await Promise.resolve(); await Promise.resolve();

        const firstResult = await first;
        expect(firstResult.success).to.equal(false);
        expect(firstResult.error).to.include('already in progress');

        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/b.png\n'));
        const secondResult = await second;
        expect(secondResult.success).to.equal(true);
    });

    it('resolves {success:false} when writeFile throws', async () => {
        fsWriteFileStub.rejects(new Error('disk full'));
        const { server } = await startedServer();

        const result = await server.renderJson(scene, '/tmp/a.png', '/tmp/a_meta.json', 1024, 600);
        expect(result.success).to.equal(false);
        expect(result.error).to.include('disk full');
    });
});

// ---------------------------------------------------------------------------
// renderAt() + >>>ANIM parsing (animation scrubbing)
// ---------------------------------------------------------------------------

describe('PreviewServer — renderAt() + animation info', () => {
    afterEach(() => sinon.restore());

    it('renderAt() writes a RENDER_AT command with progress + paths + size', async () => {
        const { server, proc } = await startedServer();
        const pr = server.renderAt(0.37, '/tmp/s.png', '/tmp/s_meta.json', 360, 640, 'dark');
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/s.png\n'));
        await pr;
        const parts: string[] = proc.stdin.write.lastCall.args[0].trim().split(' ');
        expect(parts[0]).to.equal('RENDER_AT');
        expect(parts[1]).to.equal('0.37');
        expect(parts[2]).to.equal('/tmp/s.png');
        expect(parts[3]).to.equal('/tmp/s_meta.json');
        expect(parts[4]).to.equal('360');
        expect(parts[5]).to.equal('640');
    });

    it('renderAt() clamps progress into [0,1]', async () => {
        const { server, proc } = await startedServer();
        const pr = server.renderAt(1.8, '/tmp/s.png', '/tmp/m.json', 360, 640);
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/s.png\n'));
        await pr;
        const parts: string[] = proc.stdin.write.lastCall.args[0].trim().split(' ');
        expect(parts[1]).to.equal('1');
    });

    it('reload result carries animationCount + durationMs from a >>>ANIM line', async () => {
        const { server, proc } = await startedServer();
        const pr = server.reload('/tmp/x.so', '/tmp/x.png', '/tmp/x.json', 360, 640, 'dark');
        proc.stdout.emit('data', Buffer.from('>>>ANIM:2:3000\n>>>OK:/tmp/x.png\n'));
        const result = await pr;
        expect(result.success).to.equal(true);
        expect(result.animationCount).to.equal(2);
        expect(result.animationDurationMs).to.equal(3000);
    });

    it('reload without a >>>ANIM line leaves animationCount undefined', async () => {
        const { server, proc } = await startedServer();
        const pr = server.reload('/tmp/x.so', '/tmp/x.png', '/tmp/x.json', 360, 640);
        proc.stdout.emit('data', Buffer.from('>>>OK:/tmp/x.png\n'));
        const result = await pr;
        expect(result.animationCount).to.equal(undefined);
    });
});

// ---------------------------------------------------------------------------
// docker/preview_server.cpp — RENDER_AT / animation contract
// ---------------------------------------------------------------------------

describe('previewServer — preview_server.cpp animation contract', () => {
    const SERVER_CPP = path.resolve(__dirname, '../../../docker/preview_server.cpp');

    it('server handles the RENDER_AT command via DoRenderAt', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('RENDER_AT');
        expect(content).to.include('DoRenderAt');
    });

    it('server drives the plugin via __SetPreviewProgress and reports >>>ANIM', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('__SetPreviewProgress');
        expect(content).to.include('>>>ANIM:');
    });
});

// ---------------------------------------------------------------------------
// preview_server.cpp — HexToColor structure tests
// ---------------------------------------------------------------------------

describe('previewServer — preview_server.cpp HexToColor', () => {
    const SERVER_CPP = path.resolve(__dirname, '../../../docker/preview_server.cpp');

    it('preview_server.cpp contains HexToColor function', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('HexToColor');
    });

    it('preview_server.cpp parses optional bgColor token from RELOAD command', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('bgColor');
    });

    it('preview_server.cpp HexToColor uses try/catch for stoul safety', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('try');
        expect(content).to.include('catch');
    });

    it('preview_server.cpp applies locale via setenv("LANG")', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('setenv');
        expect(content).to.include('LANG');
    });

    it('preview_server.cpp applies font scale via setenv("DALI_FONT_SCALE")', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('DALI_FONT_SCALE');
    });

    it('preview_server.cpp applies font directory via FontClient::Get().AddCustomFontDirectory', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('AddCustomFontDirectory');
    });
});

// ---------------------------------------------------------------------------
// preview_server.cpp — RENDER_JSON structure tests
// ---------------------------------------------------------------------------

describe('previewServer — preview_server.cpp RENDER_JSON', () => {
    const SERVER_CPP = path.resolve(__dirname, '../../../docker/preview_server.cpp');

    it('implements RENDER_JSON command handling', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('RENDER_JSON');
    });

    it('contains DoRenderJson function', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('DoRenderJson');
    });

    it('contains JSON parser for scene data (JParseNode)', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('JParseNode');
    });

    it('contains scene builder (SBBuildNode)', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('SBBuildNode');
    });

    it('isJson flag dispatches from RELOAD to RENDER_JSON path', () => {
        const content = fs.readFileSync(SERVER_CPP, 'utf-8');
        expect(content).to.include('isJson');
    });
});
