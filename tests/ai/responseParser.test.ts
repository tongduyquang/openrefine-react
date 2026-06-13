import { describe, it, expect } from 'vitest';
import { extractCode } from '../../src/ai/responseParser.js';

describe('extractCode', () => {
  it('returns the trimmed inner content of a single ```tsx fenced block', () => {
    const response = '```tsx\nconst x = 1;\nexport default x;\n```';
    expect(extractCode(response)).toBe('const x = 1;\nexport default x;');
  });

  it('returns the trimmed inner content of a single ```ts fenced block', () => {
    const response = '```ts\nexport const y: number = 2;\n```';
    expect(extractCode(response)).toBe('export const y: number = 2;');
  });

  it('returns the trimmed inner content of a fenced block with no language tag', () => {
    const response = '```\nplain block content\n```';
    expect(extractCode(response)).toBe('plain block content');
  });

  it('discards explanatory prose surrounding a fenced block', () => {
    const response = [
      'Here is the test file you requested:',
      '',
      '```tsx',
      "import { describe, it, expect } from 'vitest';",
      '',
      "describe('Foo', () => {",
      "  it('works', () => {",
      '    expect(true).toBe(true);',
      '  });',
      '});',
      '```',
      '',
      'Let me know if you need anything else!',
    ].join('\n');

    const result = extractCode(response);
    expect(result).not.toContain('Here is the test file');
    expect(result).not.toContain('Let me know');
    expect(result).toBe(
      ["import { describe, it, expect } from 'vitest';", '', "describe('Foo', () => {", "  it('works', () => {", '    expect(true).toBe(true);', '  });', '});'].join('\n'),
    );
  });

  it('returns the content of the largest block when multiple fenced blocks are present', () => {
    const small = 'const small = 1;';
    const large = ['import { describe, it, expect } from \'vitest\';', '', 'describe(\'Bar\', () => {', '  it(\'does something bigger\', () => {', '    expect(1 + 1).toBe(2);', '  });', '});'].join('\n');

    const response = ['Some intro prose.', '```ts', small, '```', '', 'More prose in between.', '```tsx', large, '```', '', 'Trailing prose.'].join('\n');

    const result = extractCode(response);
    expect(result).toBe(large);
    expect(result).not.toBe(small);
  });

  it('returns the trimmed raw response text when there is no fenced block', () => {
    const response = '  \n  Just a plain response with no code fence.  \n  ';
    expect(extractCode(response)).toBe('Just a plain response with no code fence.');
  });

  it('handles ```jsx and ```js and ```typescript fence tags', () => {
    expect(extractCode('```jsx\nconst a = <div />;\n```')).toBe('const a = <div />;');
    expect(extractCode('```js\nconst b = 1;\n```')).toBe('const b = 1;');
    expect(extractCode('```typescript\nconst c: number = 3;\n```')).toBe('const c: number = 3;');
  });
});
