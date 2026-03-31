import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { getPluginCodeOffset, getHarnessCodeOffset, parseGccErrors } from '../../src/errorParser';

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
    const PLUGIN_OFFSET = 24; // approximate; actual value comes from template

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
        const offset = 24;
        const gccLine = 30; // line 30 in generated plugin == user line 30 - offset
        const stderr = `/tmp/dali_preview/preview_plugin.cpp:${gccLine}:1: error: bad code`;

        const errors = parseGccErrors(stderr, offset, true);
        expect(errors).to.have.length(1);
        expect(errors[0].line).to.equal(gccLine - offset);
    });

    it('skips errors above the user code region (negative mapped line)', () => {
        const offset = 24;
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
});
