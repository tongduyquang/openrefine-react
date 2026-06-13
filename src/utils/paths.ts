import path from 'node:path';

/** Convert a path to posix-style separators (for stable display & matching). */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Relative path from `from` to `to`, posix-style, without a leading `./`. */
export function relativePosix(from: string, to: string): string {
  return toPosix(path.relative(from, to));
}

/** Strip the file extension (`.ts`, `.tsx`, `.js`, `.jsx`) from a path. */
export function stripExt(p: string): string {
  const ext = path.extname(p);
  if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
    return p.slice(0, -ext.length);
  }
  return p;
}

/** True if the file extension indicates a React component file. */
export function isTsxFile(p: string): boolean {
  return p.endsWith('.tsx');
}

/** Compute a relative import path (posix, with leading `./` if needed, no extension). */
export function toImportSpecifier(fromDir: string, toFile: string): string {
  const rel = relativePosix(fromDir, stripExt(toFile));
  return rel.startsWith('.') ? rel : `./${rel}`;
}
