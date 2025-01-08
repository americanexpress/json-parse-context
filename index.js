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

const cardinal = require('cardinal');
const ansicolors = require('ansicolors');

const redCaret = ansicolors.brightRed('^');
const redArrow = ansicolors.brightRed('>');
const greyBar = ansicolors.brightBlack('|'); // grey

function substring(raw, start, end) {
  if (raw instanceof Buffer) {
    return raw.toString('utf8', start, end);
  }
  return raw.slice(start, end);
}

function calculateContextLines(raw, spot, lineCount) {
  const lineCountAndCurrent = lineCount + 1;

  const nextEOLs = [];
  let spotForward = spot;
  while (nextEOLs.length < lineCountAndCurrent) {
    const nextEOL = raw.indexOf('\n', spotForward);
    if (nextEOL === -1) {
      nextEOLs.push(raw.length);
      break;
    }
    nextEOLs.push(nextEOL);
    spotForward = nextEOL + 1;
  }

  const prevEOLs = [];
  let spotBackwards = spot;
  while (prevEOLs.length < lineCountAndCurrent) {
    const prevEOL = raw.lastIndexOf('\n', spotBackwards);
    if (prevEOL === -1) {
      prevEOLs.unshift(0);
      break;
    }
    prevEOLs.unshift(prevEOL + 1);
    spotBackwards = prevEOL - 1;
  }

  const linesCountPrevious = (substring(raw, 0, prevEOLs[0]).match(/\n/g) || []).length + 1;

  const previousLines = prevEOLs.map((v, i, a) => {
    if (i + 1 >= a.length) { return null; }
    return substring(raw, v, a[i + 1] - 1);
  }).filter((v) => v !== null);

  const lineOfInterest = substring(raw, prevEOLs[prevEOLs.length - 1], nextEOLs[0]);
  const pointerLocationInLineOfInterest = spot - prevEOLs[prevEOLs.length - 1];

  const nextLines = nextEOLs.map((v, i, a) => {
    if (i + 1 >= a.length) { return null; }
    return substring(raw, v + 1, a[i + 1]);
  }).filter((v) => v !== null);

  return {
    linesCountPrevious,
    previousLines,
    lineOfInterest,
    pointerLocationInLineOfInterest,
    nextLines,
  };
}

function addPointerToLines(lines, lineOfInterestIndex, pointerLocationInLineOfInterest) {
  const focusedLine = lines[lineOfInterestIndex];

  const leadingWhitespaceFound = /^(\s+)/.exec(focusedLine);
  const leadingWhitespace = leadingWhitespaceFound ? leadingWhitespaceFound[1] : '';

  const spacesToAdd = pointerLocationInLineOfInterest - leadingWhitespace.length;
  const pointerLine = `${leadingWhitespace}${''.padStart(spacesToAdd)}${redCaret}`;
  lines.splice(lineOfInterestIndex + 1, 0, pointerLine);
}

function calculateWhitespaceCountStrippable(lines) {
  const starting = lines[0].slice(0, 1);

  const counts = lines
    .map((line) => {
      const leadingWhitespaceFound = /^(\s+)/.exec(line);
      return leadingWhitespaceFound ? leadingWhitespaceFound[1] : '';
    })
    .map((leadingWhitespace) => {
      const leadingWhitespaceMatch = leadingWhitespace.match(new RegExp(`^(${starting})+`, 'g'));
      if (!leadingWhitespaceMatch) {
        return 0;
      }
      return leadingWhitespaceMatch[0].length;
    });

  return Math.min(...counts);
}

function formatContext(raw, spot, lineCount) {
  const {
    linesCountPrevious,
    previousLines,
    lineOfInterest,
    pointerLocationInLineOfInterest,
    nextLines,
  } = calculateContextLines(raw, spot, lineCount);
  const linesTogether = [...previousLines, lineOfInterest, ...nextLines];
  const lineOfInterestIndex = linesTogether.indexOf(lineOfInterest);

  const lines = cardinal.highlight(linesTogether.join('\n')).split('\n');

  addPointerToLines(lines, lineOfInterestIndex, pointerLocationInLineOfInterest);

  const whitespaceCountToStrip = calculateWhitespaceCountStrippable(lines);

  const maxLineNumberLength = `${linesCountPrevious + lines.length - 1}`.length;

  const pointerLineIndex = lineOfInterestIndex + 1;

  return lines
    .map((line) => line.slice(whitespaceCountToStrip))
    .map((line, contextIndex) => {
      if (contextIndex === pointerLineIndex) {
        return `  ${''.padStart(maxLineNumberLength)} ${greyBar} ${line}`;
      }

      let lineNumber = linesCountPrevious + contextIndex;
      if (contextIndex > pointerLineIndex) {
        lineNumber -= 1;
      }
      const arrowPadding = contextIndex === lineOfInterestIndex ? redArrow : ' ';
      const paddedLineNumber = `${lineNumber}`.padStart(maxLineNumberLength).replace(lineNumber, ansicolors.brightBlack(lineNumber));
      return `${arrowPadding} ${paddedLineNumber} ${greyBar} ${line}`;
    })
    .join('\n');
}

function jsonParseContext(serialized, reviver, opts) {
  try {
    return JSON.parse(serialized, reviver);
  } catch (e) {
    const syntaxErr = e.message.match(/^unexpected .*position\s+(\d+)/i)
      || e.message.match(/^expected .*at position\s+(\d+)/i);
    const endOfJsonErr = e.message.match(/^unexpected end of json.*/i) ? serialized.length - 1 : null;
    const errIdx = syntaxErr
      ? +syntaxErr[1]
      : endOfJsonErr;
    if (errIdx !== null) {
      const context = formatContext(serialized, errIdx, (opts && opts.lines) || 2);
      e.message += `\n${context}`;
    }
    throw e;
  }
}

module.exports = jsonParseContext;
