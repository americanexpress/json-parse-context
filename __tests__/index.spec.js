/*
 * Copyright 2020 American Express Travel Related Services Company, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 */

/* eslint-disable no-regex-spaces -- spaces are hard to count,
unless they are next to other lines in which case `{n}` is harder to understand */
const stripAnsi = require('strip-ansi');
const jsonParseContext = require('..');

describe('json-parse-context', () => {
  it('returns parsed JSON', () => {
    const orig = { a: 1, b: true, c: [3, 4, 5] };
    expect(jsonParseContext(JSON.stringify(orig))).toEqual(orig);
  });

  it('throws a JSON parse error', () => {
    expect(() => jsonParseContext('{"a":1,}')).toThrow();
  });

  it('returns the normal error when not understood', () => {
    expect(() => jsonParseContext(Symbol(12))).toThrowErrorMatchingSnapshot();
  });

  describe('parse error context', () => {
    Object.entries({
      'string input': (str) => str,
      'Buffer input': (str) => Buffer.from(str),
    }).forEach(([name, inputTransform]) => describe(`${name}`, () => {
      function getParseErrorContextFor(json) {
        try {
          jsonParseContext(inputTransform(json));
          throw new Error('Should have thrown');
        } catch (err) {
          if (err.message === 'Should have thrown') {
            throw err;
          }

          return err.message.slice(err.message.indexOf('\n') + 1);
        }
      }

      function getParseErrorContextForLines(...lines) {
        return getParseErrorContextFor(lines.join('\n'));
      }

      function getNonColoredLinesOfContext(context) {
        return stripAnsi(context).split('\n');
      }

      it('has line numbers', () => {
        const context = getParseErrorContextForLines(
          '{',
          '  "a": 1,',
          '  "b": 2,',
          '  "c": 3',
          '  "d": 4,',
          '  "e": 5,',
          '  "f": 6',
          '}'
        );
        const lines = getNonColoredLinesOfContext(context);
        expect(lines[0]).toMatch(/^  3 | /);
        expect(lines[1]).toMatch(/^  4 | /);
        expect(lines[2]).toMatch(/^> 5 | /);
        expect(lines[3]).toMatch(/^ {4}| \s+\^/);
        expect(lines[4]).toMatch(/^  6 | /);
        expect(lines[5]).toMatch(/^  7 | /);
        expect(`\n${lines.join('\n')}`).toMatchSnapshot();
      });

      it('indents line numbers to keep them inline when they are different widths', () => {
        const rawLines = ['['];
        while (rawLines.length < 125) {
          rawLines.push(`  ${rawLines.length + 1},`);
        }
        rawLines.push(']');
        rawLines[99 - 1] = '  99'; // no trailing comma
        const context = getParseErrorContextFor(rawLines.join('\n'));
        const lines = getNonColoredLinesOfContext(context);
        expect(lines[0]).toMatch(/^   98 | /);
        expect(lines[1]).toMatch(/^   99 | /);
        expect(lines[2]).toMatch(/^> 100 | /);
        expect(lines[3]).toMatch(/^ {6}| \s+\^/);
        expect(lines[4]).toMatch(/^  101 | /);
        expect(lines[5]).toMatch(/^  102 | /);
        expect(`\n${lines.join('\n')}`).toMatchSnapshot();
      });

      it('has similar leading spaces stripped', () => {
        const context = getParseErrorContextForLines(
          '      {',
          '        "a": 1',
          '        "b": 2',
          '        "c": 3',
          '      }'
        );
        const lines = getNonColoredLinesOfContext(context);
        expect(lines[0]).toMatch(/^  1 | {/);
        expect(lines[1]).toMatch(/^  2 |   "a/);
        expect(lines[2]).toMatch(/^> 3 |   "b": 2/);
        expect(lines[3]).toMatch(/^    |   \^/);
        expect(lines[4]).toMatch(/^  4 |   "c/);
        expect(lines[5]).toMatch(/^  5 | }/);
        expect(`\n${lines.join('\n')}`).toMatchSnapshot();
      });

      it('has similar leading tabs stripped', () => {
        const context = getParseErrorContextForLines(
          '\t\t\t{',
          '\t\t\t\t"a": 1',
          '\t\t\t\t"b": 2',
          '\t\t\t\t"c": 3',
          '\t\t\t}'
        );
        const lines = getNonColoredLinesOfContext(context);
        expect(lines[0]).toMatch(/^  1 | {/);
        expect(lines[1]).toMatch(/^  2 | \t"a/);
        expect(lines[2]).toMatch(/^> 3 | \t"b": 2/);
        expect(lines[3]).toMatch(/^ {4}| \t\^/);
        expect(lines[4]).toMatch(/^  4 | \t"c/);
        expect(lines[5]).toMatch(/^  5 | }/);
        expect(`\n${lines.join('\n')}`).toMatchSnapshot();
      });

      it('strips leading spaces but leaves tabs that are mixed in', () => {
        const context = getParseErrorContextForLines(
          '  \t\t{',
          '  \t\t\t"a": 1',
          '  \t\t\t"b": 2',
          '    \t\t"c": 3',
          '    \t}'
        );
        const lines = getNonColoredLinesOfContext(context);
        expect(lines[0]).toMatch(/^  1 | \t\t{/);
        expect(lines[1]).toMatch(/^  2 | \t\t\t"a/);
        expect(lines[2]).toMatch(/^> 3 | \t{3}"b": 2/);
        expect(lines[3]).toMatch(/^ {4}| \t{3}\^/);
        expect(lines[4]).toMatch(/^  4 |   \t\t"c/);
        expect(lines[5]).toMatch(/^  5 |   \t}/);
        expect(`\n${lines.join('\n')}`).toMatchSnapshot();
      });

      it('strips leading tabs but leaves spaces that are mixed in', () => {
        const context = getParseErrorContextForLines(
          '\t\t  {',
          '\t\t    "a": 1',
          '\t\t    "b": 2',
          '\t\t\t  "c": 3',
          '\t\t\t}'
        );
        const lines = getNonColoredLinesOfContext(context);
        expect(lines[0]).toMatch(/^  1 |   {/);
        expect(lines[1]).toMatch(/^  2 |     "a/);
        expect(lines[2]).toMatch(/^> 3 |     "b": 2/);
        expect(lines[3]).toMatch(/^    |     \^/);
        expect(lines[4]).toMatch(/^  4 | \t  "c/);
        expect(lines[5]).toMatch(/^  5 | \t}/);
        expect(`\n${lines.join('\n')}`).toMatchSnapshot();
      });

      it('grabs the preceeding lines when the text ends unexpectedly', () => {
        const context = getParseErrorContextForLines(
          '{',
          '  "a": 1,',
          '  "b": 2,',
          '  "c": 3,',
          '  "d": 4,',
          '  "e": 5,',
          '  "f": 6'
        );
        const lines = getNonColoredLinesOfContext(context);
        expect(lines[0]).toMatch(/^  5 | /);
        expect(lines[1]).toMatch(/^  6 | /);
        expect(lines[2]).toMatch(/^> 7 | /);
        expect(lines[3]).toMatch(/^ {4}| \s+\^/);
        expect(`\n${lines.join('\n')}`).toMatchSnapshot();
      });

      it('uses the option line values for the preceeding and following lines reported', () => {
        let context;
        const json = [
          '{',
          '  "a": 1,',
          '  "b": 2,',
          '  "c": 3,',
          '  "d": 4,',
          '  "e": 5,',
          '  "f": 6,',
          '  "g": 7',
          '  "h": 8,',
          '  "i": 9,',
          '  "j": 10,',
          '  "k": 11,',
          '  "l": 12,',
          '  "m": 13',
          '}',
        ].join('\n');
        try {
          jsonParseContext(json, undefined, { lines: 4 });
          throw new Error('Should have thrown');
        } catch (err) {
          if (err.message === 'Should have thrown') {
            throw err;
          }

          context = err.message.slice(err.message.indexOf('\n') + 1);
        }
        const lines = getNonColoredLinesOfContext(context);
        expect(lines.length).toBe(4 * 2 + 2);
      });
    }));
  });
});
/* eslint-enable no-regex-spaces -- all disables require an enable */
