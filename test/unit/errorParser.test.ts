import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
    parseGccErrors,
    getHarnessCodeOffset,
    formatErrorsForDisplay,
    ParsedError,
} from '../../src/errorParser';

// Path to the real harness template
// __dirname at runtime is out/test/unit, so we go up three levels to project root
const TEMPLATE_PATH = path.resolve(__dirname, '../../../server/preview_harness.cpp.template');

describe('errorParser', () => {
    // -----------------------------------------------------------------
    // getHarnessCodeOffset
    // -----------------------------------------------------------------
    describe('getHarnessCodeOffset()', () => {
        it('returns correct offset for the real template', () => {
            const template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
            const offset = getHarnessCodeOffset(template);

            // {{USER_CODE}} is on line 21 of the template (1-based)
            expect(offset).to.be.greaterThan(0);

            // Verify by checking the actual line content
            const lines = template.split('\n');
            expect(lines[offset - 1]).to.include('{{USER_CODE}}');
        });

        it('returns 0 for a template without {{USER_CODE}}', () => {
            const offset = getHarnessCodeOffset('no placeholder here\nstill nothing\n');
            expect(offset).to.equal(0);
        });
    });

    // -----------------------------------------------------------------
    // parseGccErrors
    // -----------------------------------------------------------------
    describe('parseGccErrors()', () => {
        const harnessOffset = 21; // typical offset for the test template

        it('parses a standard gcc error line', () => {
            const stderr = '/tmp/preview_harness.cpp:25:10: error: use of undeclared identifier \'Foo\'';
            const errors = parseGccErrors(stderr, harnessOffset);

            expect(errors).to.have.length(1);
            expect(errors[0].line).to.equal(25 - harnessOffset); // mapped to user code
            expect(errors[0].column).to.equal(10);
            expect(errors[0].severity).to.equal('error');
            expect(errors[0].message).to.include('undeclared identifier');
        });

        it('parses warnings and notes', () => {
            const stderr = [
                '/tmp/preview_harness.cpp:22:5: warning: unused variable \'x\'',
                '/tmp/preview_harness.cpp:22:5: note: declared here',
            ].join('\n');

            const errors = parseGccErrors(stderr, harnessOffset);
            expect(errors).to.have.length(2);
            expect(errors[0].severity).to.equal('warning');
            expect(errors[1].severity).to.equal('note');
        });

        it('maps line numbers relative to user code (0-based)', () => {
            // Error on harness line 23, offset 21 -> user code line 2 (0-based)
            const stderr = '/tmp/preview_harness.cpp:23:1: error: expected \';\' after expression';
            const errors = parseGccErrors(stderr, harnessOffset);

            expect(errors).to.have.length(1);
            expect(errors[0].line).to.equal(2);
        });

        it('ignores errors from system headers (non-harness files)', () => {
            const stderr = [
                '/usr/include/c++/11/bits/stl_vector.h:100:5: error: something bad',
                '/tmp/preview_harness.cpp:22:3: error: real error',
            ].join('\n');

            const errors = parseGccErrors(stderr, harnessOffset);
            expect(errors).to.have.length(1);
            expect(errors[0].message).to.equal('real error');
        });

        it('ignores errors in harness boilerplate (above user code)', () => {
            // Error on line 5 of harness, which is before the user code offset
            const stderr = '/tmp/preview_harness.cpp:5:1: error: boilerplate error';
            const errors = parseGccErrors(stderr, harnessOffset);

            expect(errors).to.have.length(0);
        });

        it('handles empty stderr', () => {
            const errors = parseGccErrors('', harnessOffset);
            expect(errors).to.have.length(0);
        });

        it('handles multi-line stderr with mixed content', () => {
            const stderr = [
                'In file included from /tmp/preview_harness.cpp:1:',
                '/tmp/preview_harness.cpp:25:10: error: first error',
                'some random text',
                '/tmp/preview_harness.cpp:26:5: warning: a warning',
                '',
            ].join('\n');

            const errors = parseGccErrors(stderr, harnessOffset);
            expect(errors).to.have.length(2);
        });
    });

    // -----------------------------------------------------------------
    // formatErrorsForDisplay
    // -----------------------------------------------------------------
    describe('formatErrorsForDisplay()', () => {
        it('returns "No errors." for empty array', () => {
            expect(formatErrorsForDisplay([])).to.equal('No errors.');
        });

        it('formats a single error', () => {
            const errors: ParsedError[] = [
                { line: 0, column: 10, message: 'undeclared identifier', severity: 'error' },
            ];
            const result = formatErrorsForDisplay(errors);
            expect(result).to.equal('Error - Line 1, Col 10: undeclared identifier');
        });

        it('formats warnings and notes with correct tags', () => {
            const errors: ParsedError[] = [
                { line: 2, column: 5, message: 'unused variable', severity: 'warning' },
                { line: 2, column: 5, message: 'declared here', severity: 'note' },
            ];
            const result = formatErrorsForDisplay(errors);
            const lines = result.split('\n');
            expect(lines[0]).to.include('Warning');
            expect(lines[1]).to.include('Note');
        });

        it('formats multiple errors with newline separation', () => {
            const errors: ParsedError[] = [
                { line: 0, column: 1, message: 'err1', severity: 'error' },
                { line: 1, column: 2, message: 'err2', severity: 'error' },
            ];
            const result = formatErrorsForDisplay(errors);
            const lines = result.split('\n');
            expect(lines).to.have.length(2);
        });
    });
});
