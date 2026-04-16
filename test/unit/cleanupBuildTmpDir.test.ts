import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { cleanupBuildTmpDir } from '../../src/buildRunner';

describe('cleanupBuildTmpDir()', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dali-cleanup-'));
    });

    afterEach(() => {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
    });

    it('removes all files except preview_server', () => {
        fs.writeFileSync(path.join(tmpDir, 'preview_plugin.cpp'), 'a');
        fs.writeFileSync(path.join(tmpDir, 'preview_plugin.so'),  'b');
        fs.writeFileSync(path.join(tmpDir, 'preview.png'),        'c');
        fs.writeFileSync(path.join(tmpDir, 'preview_metadata.json'), 'd');
        fs.writeFileSync(path.join(tmpDir, 'preview_server'),     'KEEP');

        const removed = cleanupBuildTmpDir(tmpDir);

        expect(removed).to.equal(4);
        expect(fs.existsSync(path.join(tmpDir, 'preview_server'))).to.equal(true);
        expect(fs.existsSync(path.join(tmpDir, 'preview_plugin.cpp'))).to.equal(false);
        expect(fs.existsSync(path.join(tmpDir, 'preview_plugin.so'))).to.equal(false);
        expect(fs.existsSync(path.join(tmpDir, 'preview.png'))).to.equal(false);
        expect(fs.existsSync(path.join(tmpDir, 'preview_metadata.json'))).to.equal(false);
    });

    it('recursively removes subdirectories like anim_frames', () => {
        const framesDir = path.join(tmpDir, 'anim_frames');
        fs.mkdirSync(framesDir);
        fs.writeFileSync(path.join(framesDir, 'frame_000.png'), 'x');
        fs.writeFileSync(path.join(framesDir, 'frame_001.png'), 'y');

        const removed = cleanupBuildTmpDir(tmpDir);

        expect(removed).to.equal(1);
        expect(fs.existsSync(framesDir)).to.equal(false);
    });

    it('preserves preview_server even alongside many other files', () => {
        fs.writeFileSync(path.join(tmpDir, 'preview_server'), 'binary');
        for (let i = 0; i < 10; i++) {
            fs.writeFileSync(path.join(tmpDir, `preview_plugin_${i}.so`), 'x');
        }

        cleanupBuildTmpDir(tmpDir);

        expect(fs.existsSync(path.join(tmpDir, 'preview_server'))).to.equal(true);
        expect(fs.readFileSync(path.join(tmpDir, 'preview_server'), 'utf-8')).to.equal('binary');
        for (let i = 0; i < 10; i++) {
            expect(fs.existsSync(path.join(tmpDir, `preview_plugin_${i}.so`))).to.equal(false);
        }
    });

    it('returns 0 when the directory does not exist', () => {
        const missing = path.join(tmpDir, 'does-not-exist');
        expect(cleanupBuildTmpDir(missing)).to.equal(0);
    });

    it('returns 0 when the directory is empty', () => {
        expect(cleanupBuildTmpDir(tmpDir)).to.equal(0);
    });
});
