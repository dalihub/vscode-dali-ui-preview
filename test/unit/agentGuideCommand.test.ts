import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeAgentGuide } from '../../src/agentGuideCommand';

describe('writeAgentGuide (AGENTS.md scaffolding)', () => {
    let dir: string;
    let target: string;
    const BODY = '## DALi guide\nWrite previewable code.';

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentguide-'));
        target = path.join(dir, 'AGENTS.md');
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('creates AGENTS.md with the marked guide block when absent', () => {
        expect(writeAgentGuide(target, BODY)).to.equal('created');
        const txt = fs.readFileSync(target, 'utf8');
        expect(txt).to.contain('# AGENTS.md');
        expect(txt).to.contain('dali-preview:agent-guide');
        expect(txt).to.contain('Write previewable code.');
    });

    it('updates only the marked block, preserving the user\'s other content', () => {
        fs.writeFileSync(
            target,
            '# AGENTS.md\n\nMy own rules.\n\n<!-- dali-preview:agent-guide -->\nOLD\n<!-- /dali-preview:agent-guide -->\n\nFooter.',
        );
        expect(writeAgentGuide(target, '## New\nfresh.')).to.equal('updated');
        const txt = fs.readFileSync(target, 'utf8');
        expect(txt).to.contain('My own rules.'); // preserved
        expect(txt).to.contain('Footer.');        // preserved
        expect(txt).to.contain('fresh.');         // new content
        expect(txt).to.not.contain('OLD');        // replaced
        expect(txt.split('<!-- dali-preview:agent-guide -->').length).to.equal(2); // exactly one block
    });

    it('appends the block to an existing AGENTS.md that has no block', () => {
        fs.writeFileSync(target, '# AGENTS.md\n\nExisting project rules.');
        expect(writeAgentGuide(target, BODY)).to.equal('appended');
        const txt = fs.readFileSync(target, 'utf8');
        expect(txt).to.contain('Existing project rules.'); // preserved
        expect(txt).to.contain('dali-preview:agent-guide');
    });
});
