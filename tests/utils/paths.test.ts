import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  toPosix,
  relativePosix,
  stripExt,
  isTsxFile,
  toImportSpecifier,
} from '../../src/utils/paths.js';

describe('toPosix', () => {
  it('converts platform separators to posix-style forward slashes', () => {
    const input = ['a', 'b', 'c'].join(path.sep);
    expect(toPosix(input)).toBe('a/b/c');
  });

  it('leaves a path with no separators unchanged', () => {
    expect(toPosix('Foo.tsx')).toBe('Foo.tsx');
  });
});

describe('relativePosix', () => {
  it('computes a posix-style relative path between two absolute dirs', () => {
    const from = path.join('/repo', 'src', 'components');
    const to = path.join('/repo', 'src', 'utils', 'paths.ts');
    expect(relativePosix(from, to)).toBe('../utils/paths.ts');
  });

  it('returns an empty string when from and to are the same path', () => {
    const dir = path.join('/repo', 'src');
    expect(relativePosix(dir, dir)).toBe('');
  });
});

describe('stripExt', () => {
  it('strips a .ts extension', () => {
    expect(stripExt('Foo.ts')).toBe('Foo');
  });

  it('strips a .tsx extension', () => {
    expect(stripExt('Foo.tsx')).toBe('Foo');
  });

  it('strips a .js extension', () => {
    expect(stripExt('Foo.js')).toBe('Foo');
  });

  it('strips a .jsx extension', () => {
    expect(stripExt('Foo.jsx')).toBe('Foo');
  });

  it('leaves a .json path unchanged', () => {
    expect(stripExt('package.json')).toBe('package.json');
  });

  it('leaves a path with no extension unchanged', () => {
    expect(stripExt('README')).toBe('README');
  });

  it('strips the extension while preserving directory segments', () => {
    expect(stripExt(path.join('src', 'components', 'Foo.tsx'))).toBe(path.join('src', 'components', 'Foo'));
  });
});

describe('isTsxFile', () => {
  it('is true for a .tsx path', () => {
    expect(isTsxFile('Foo.tsx')).toBe(true);
  });

  it('is false for a .ts path', () => {
    expect(isTsxFile('Foo.ts')).toBe(false);
  });

  it('is false for a .jsx path', () => {
    expect(isTsxFile('Foo.jsx')).toBe(false);
  });

  it('is false for a path with no extension', () => {
    expect(isTsxFile('Foo')).toBe(false);
  });
});

describe('toImportSpecifier', () => {
  it('prefixes a sibling-file import with ./', () => {
    const fromDir = path.join('/repo', 'src', 'components');
    const toFile = path.join('/repo', 'src', 'components', 'Foo.tsx');
    expect(toImportSpecifier(fromDir, toFile)).toBe('./Foo');
  });

  it('produces a parent-relative specifier without an extra ./ prefix', () => {
    const fromDir = path.join('/repo', 'src', 'components');
    const toFile = path.join('/repo', 'src', 'utils', 'paths.ts');
    expect(toImportSpecifier(fromDir, toFile)).toBe('../utils/paths');
  });
});
