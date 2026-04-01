import { expect } from 'chai';
import * as sinon from 'sinon';
import { EventEmitter } from 'events';
import * as childProcess from 'child_process';
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
        const stderr = [
            '/tmp/dali_preview/preview_plugin.cpp:28:5: error: use of undeclared identifier \'foo\'',
            '/tmp/other/unrelated.cpp:5:1: error: unrelated error',
        ].join('\n');

        const errors = parseGccErrors(stderr, PLUGIN_OFFSET, true);
        expect(errors).to.have.length(1);
        expect(errors[0].message).to.include('foo');
    });

    it('ignores preview_harness.cpp errors in plugin mode', () => {
        const stderr =
            '/tmp/dali_preview/preview_harness.cpp:31:3: error: harness error\n' +
            '/tmp/dali_preview/preview_plugin.cpp:28:3: error: plugin error\n';

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
// build_server.sh existence
// ---------------------------------------------------------------------------

describe('previewServer — build_server.sh', () => {
    const BUILD_SCRIPT = path.resolve(__dirname, '../../../server/build_server.sh');

    it('build_server.sh exists', () => {
        expect(fs.existsSync(BUILD_SCRIPT)).to.equal(true);
    });

    it('build_server.sh is executable', () => {
        const stat = fs.statSync(BUILD_SCRIPT);
        // Unix execute bit for owner (0o100)
        expect(stat.mode & 0o100).to.be.greaterThan(0);
    });

    it('build_server.sh targets /tmp/dali_preview output directory', () => {
        const content = fs.readFileSync(BUILD_SCRIPT, 'utf-8');
        // Script uses OUT_DIR=/tmp/dali_preview and OUT_BIN=.../preview_server
        expect(content).to.include('/tmp/dali_preview');
        expect(content).to.include('preview_server');
    });

    it('build_server.sh links with -ldl', () => {
        const content = fs.readFileSync(BUILD_SCRIPT, 'utf-8');
        expect(content).to.include('-ldl');
    });
});

// ---------------------------------------------------------------------------
// preview_server.cpp existence and structure
// ---------------------------------------------------------------------------

describe('previewServer — preview_server.cpp', () => {
    const SERVER_CPP = path.resolve(__dirname, '../../../server/preview_server.cpp');

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

/** Creates a PreviewServer with a controllable fake child process. */
function makeServer(proc?: any) {
    const fakeProc = proc ?? makeProc();
    const server = new PreviewServer('/ext', '/dali', ':99', fakeOutputChannel);
    // Bypass binary compilation — not relevant to IPC behavior tests
    (server as any).ensureServerBinary = async () => {};
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
    fakeProc.stdout.emit('data', Buffer.from('READY\n'));
    await startPromise;
    return { server, proc: fakeProc };
}

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
        proc.stdout.emit('data', Buffer.from('OK:/tmp/a.png\n'));

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
        proc.stdout.emit('data', Buffer.from('ERROR:dlopen failed\n'));

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
        proc.stdout.emit('data', Buffer.from('OK:/tmp/b.png\n'));
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

        const server = new PreviewServer('/ext', '/dali', ':99', fakeOutputChannel);
        (server as any).ensureServerBinary = async () => {};
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
        procs[0].stdout.emit('data', Buffer.from('READY\n'));
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
        proc.stdout.emit('data', Buffer.from('OK:/tmp/a.png\n'));
        await reloadPromise;

        const writtenCmd: string = proc.stdin.write.lastCall.args[0];
        expect(writtenCmd).to.include('#ff8800');
        expect(writtenCmd).to.match(/RELOAD .+ #ff8800\n$/);
    });

    it('reload() omits bgColor field when invalid hex is supplied', async () => {
        const { server, proc } = await startedServer();

        const reloadPromise = server.reload(
            '/tmp/a.so', '/tmp/a.png', '/tmp/a_meta.json', 1024, 600, 'dark', 'invalid'
        );
        proc.stdout.emit('data', Buffer.from('OK:/tmp/a.png\n'));
        await reloadPromise;

        const writtenCmd: string = proc.stdin.write.lastCall.args[0];
        expect(writtenCmd).to.not.include('invalid');
        expect(writtenCmd.trim().split(' ')).to.have.length(7); // no 8th field
    });

    it('reload() omits bgColor field when undefined', async () => {
        const { server, proc } = await startedServer();

        const reloadPromise = server.reload(
            '/tmp/a.so', '/tmp/a.png', '/tmp/a_meta.json', 1024, 600, 'dark', undefined
        );
        proc.stdout.emit('data', Buffer.from('OK:/tmp/a.png\n'));
        await reloadPromise;

        const writtenCmd: string = proc.stdin.write.lastCall.args[0];
        expect(writtenCmd.trim().split(' ')).to.have.length(7);
    });
});

// ---------------------------------------------------------------------------
// preview_server.cpp — HexToColor structure tests
// ---------------------------------------------------------------------------

describe('previewServer — preview_server.cpp HexToColor', () => {
    const SERVER_CPP = path.resolve(__dirname, '../../../server/preview_server.cpp');

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
});
