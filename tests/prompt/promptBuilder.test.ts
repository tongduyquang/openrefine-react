import { describe, it, expect } from 'vitest';
import { buildPrompt } from '../../src/prompt/promptBuilder.js';
import type { PromptContext } from '../../src/prompt/prompt.types.js';
import type { FileAnalysis } from '../../src/analyzer/analyzer.types.js';
import type { ProjectConventions } from '../../src/conventions/conventions.types.js';

function baseConventions(overrides: Partial<ProjectConventions> = {}): ProjectConventions {
  return {
    framework: 'vitest',
    testCommand: ['npx', 'vitest', 'run'],
    testFileSuffix: '.test',
    testLocation: 'colocated',
    srcRootDir: 'src',
    usesReactTestingLibrary: true,
    usesMsw: false,
    usesJestDom: true,
    ...overrides,
  };
}

const sourceText = [
  "import React from 'react';",
  '',
  'export interface ButtonProps {',
  '  /** The label shown on the button. */',
  '  label: string;',
  '  /** Called when the button is clicked. */',
  '  onClick?: () => void;',
  '}',
  '',
  '/** A simple button component. */',
  'export function Button({ label, onClick }: ButtonProps) {',
  '  return <button onClick={onClick}>{label}</button>;',
  '}',
].join('\n');

function baseAnalysis(overrides: Partial<FileAnalysis> = {}): FileAnalysis {
  return {
    filePath: '/repo/src/components/Button.tsx',
    relativePath: 'src/components/Button.tsx',
    sourceText,
    truncated: false,
    isReactFile: true,
    components: [
      {
        name: 'Button',
        isDefaultExport: false,
        propsTypeName: 'ButtonProps',
        jsDoc: 'A simple button component.',
        props: [
          { name: 'label', type: 'string', optional: false, jsDoc: 'The label shown on the button.' },
          { name: 'onClick', type: '() => void', optional: true, jsDoc: 'Called when the button is clicked.' },
        ],
      },
    ],
    hooks: [],
    functions: [],
    exportedTypes: [],
    imports: [],
    ...overrides,
  };
}

function baseContext(overrides: Partial<PromptContext> = {}): PromptContext {
  return {
    mode: 'generate',
    conventions: baseConventions(),
    analysis: baseAnalysis(),
    relativeSourcePath: 'src/components/Button.tsx',
    relativeOutputPath: 'src/components/Button.test.tsx',
    ...overrides,
  };
}

describe('buildPrompt', () => {
  describe('generate mode, minimal context', () => {
    const ctx = baseContext();
    const { system, user } = buildPrompt(ctx);

    it('system prompt contains Vitest guidance', () => {
      expect(system).toContain("Test framework: Vitest. Import test APIs (`describe`, `it`, `expect`, `vi`) from 'vitest'.");
    });

    it('system prompt contains RTL and jest-dom lines when enabled', () => {
      expect(system).toContain('React Testing Library (@testing-library/react) is available');
      expect(system).toContain('@testing-library/jest-dom matchers are available');
    });

    it('system prompt does not contain the MSW line when usesMsw is false', () => {
      expect(system).not.toContain('MSW (msw) is available');
    });

    it('user prompt contains the "## Task" / generate section with correct paths', () => {
      expect(user).toContain('## Task');
      expect(user).toContain('Generate a new test file for the source file described below.');
      expect(user).toContain('Source file (relative to repo root): src/components/Button.tsx');
      expect(user).toContain('The test file you write will be saved at: src/components/Button.test.tsx');
    });

    it('user prompt contains the "## Source file under test" section with component name, props, and source', () => {
      expect(user).toContain('## Source file under test');
      expect(user).toContain('Path: src/components/Button.tsx');
      expect(user).toContain('### Component: Button');
      expect(user).toContain('Props type: ButtonProps');
      expect(user).toContain('- label: string — The label shown on the button.');
      expect(user).toContain('- onClick?: () => void — Called when the button is clicked.');
      expect(user).toContain(sourceText);
    });

    it('user prompt does not contain optional sections', () => {
      expect(user).not.toContain('## Coverage gap');
      expect(user).not.toContain('## Style reference');
      expect(user).not.toContain('## Repair attempt');
      expect(user).not.toContain('## Developer instructions');
    });
  });

  describe('Jest conventions', () => {
    it('system prompt contains the Jest-specific line instead of Vitest', () => {
      const ctx = baseContext({ conventions: baseConventions({ framework: 'jest' }) });
      const { system } = buildPrompt(ctx);

      expect(system).toContain('Test framework: Jest. Use the global `describe`/`it`/`expect`/`jest` APIs');
      expect(system).not.toContain("Test framework: Vitest. Import test APIs (`describe`, `it`, `expect`, `vi`) from 'vitest'.");
    });

    it('omits RTL, MSW and jest-dom lines when all are false', () => {
      const ctx = baseContext({
        conventions: baseConventions({
          framework: 'jest',
          usesReactTestingLibrary: false,
          usesMsw: false,
          usesJestDom: false,
        }),
      });
      const { system } = buildPrompt(ctx);

      expect(system).not.toContain('React Testing Library (@testing-library/react) is available');
      expect(system).not.toContain('@testing-library/jest-dom matchers are available');
      expect(system).not.toContain('MSW (msw) is available');
    });

    it('includes the MSW line when usesMsw is true', () => {
      const ctx = baseContext({
        conventions: baseConventions({ framework: 'jest', usesMsw: true }),
      });
      const { system } = buildPrompt(ctx);

      expect(system).toContain('MSW (msw) is available for mocking network requests');
    });
  });

  describe('fix mode', () => {
    it('user prompt contains the fix task section with existing test content', () => {
      const existingTest = [
        "import { describe, it, expect } from 'vitest';",
        "import { render, screen } from '@testing-library/react';",
        "import { Button } from './Button.js';",
        '',
        "describe('Button', () => {",
        "  it('renders the label', () => {",
        "    render(<Button label=\"Click me\" />);",
        "    expect(screen.getByText('Click me')).toBeInTheDocument();",
        '  });',
        '});',
      ].join('\n');

      const ctx = baseContext({ mode: 'fix', existingTest });
      const { user } = buildPrompt(ctx);

      expect(user).toContain('## Task');
      expect(user).toContain('The source file below has changed and its existing test file needs to be updated to match.');
      expect(user).toContain('Update the existing test file: fix any imports/usages that no longer match the current source,');
      expect(user).toContain('### Existing test file');
      expect(user).toContain(existingTest);
    });
  });

  describe('coverage section', () => {
    it('includes the coverage gap section with percent and uncovered lines', () => {
      const ctx = baseContext({ coverage: { percent: 42, uncoveredLines: [3, 7, 9] } });
      const { user } = buildPrompt(ctx);

      expect(user).toContain('## Coverage gap');
      expect(user).toContain('42%');
      expect(user).toContain('3, 7, 9');
    });

    it('omits the coverage gap section when uncoveredLines is empty', () => {
      const ctx = baseContext({ coverage: { percent: 100, uncoveredLines: [] } });
      const { user } = buildPrompt(ctx);

      expect(user).not.toContain('## Coverage gap');
    });
  });

  describe('example test (few-shot)', () => {
    it('includes the style reference section with relative path and content', () => {
      const exampleTest = {
        relativePath: 'src/components/OtherComponent.test.tsx',
        content: "describe('OtherComponent', () => { it('works', () => { expect(true).toBe(true); }); });",
      };
      const ctx = baseContext({ exampleTest });
      const { user } = buildPrompt(ctx);

      expect(user).toContain('## Style reference');
      expect(user).toContain(exampleTest.relativePath);
      expect(user).toContain(exampleTest.content);
    });
  });

  describe('repair section', () => {
    it('includes the repair attempt section with previous attempt and error output', () => {
      const repair = {
        previousAttempt: "describe('Button', () => { it('broken', () => { expect(true).toBe(false); }); });",
        errorOutput: 'AssertionError: expected false to be true',
        attemptNumber: 2,
      };
      const ctx = baseContext({ repair });
      const { user } = buildPrompt(ctx);

      expect(user).toContain('## Repair attempt 2');
      expect(user).toContain(repair.previousAttempt);
      expect(user).toContain(repair.errorOutput);
    });
  });

  describe('custom prompt', () => {
    it('includes the developer instructions section after the other sections', () => {
      const customPrompt = 'Some custom instructions';
      const ctx = baseContext({ customPrompt });
      const { user } = buildPrompt(ctx);

      expect(user).toContain('## Developer instructions');
      expect(user).toContain(customPrompt);

      const taskIdx = user.indexOf('## Task');
      const analysisIdx = user.indexOf('## Source file under test');
      const devIdx = user.indexOf('## Developer instructions');

      expect(taskIdx).toBeGreaterThanOrEqual(0);
      expect(analysisIdx).toBeGreaterThan(taskIdx);
      expect(devIdx).toBeGreaterThan(analysisIdx);

      const customTextIdx = user.indexOf(customPrompt);
      expect(customTextIdx).toBeGreaterThan(devIdx);
    });
  });

  describe('section ordering', () => {
    it('orders sections as Task -> Coverage gap -> Source file under test -> Style reference -> Repair attempt -> Developer instructions', () => {
      const ctx = baseContext({
        coverage: { percent: 50, uncoveredLines: [1, 2] },
        exampleTest: { relativePath: 'src/components/Other.test.tsx', content: 'example content' },
        repair: { previousAttempt: 'previous attempt content', errorOutput: 'error output content', attemptNumber: 1 },
        customPrompt: 'Custom instructions here',
      });

      const { user } = buildPrompt(ctx);

      const taskIdx = user.indexOf('## Task');
      const coverageIdx = user.indexOf('## Coverage gap');
      const analysisIdx = user.indexOf('## Source file under test');
      const styleIdx = user.indexOf('## Style reference');
      const repairIdx = user.indexOf('## Repair attempt');
      const devIdx = user.indexOf('## Developer instructions');

      expect(taskIdx).toBeGreaterThanOrEqual(0);
      expect(coverageIdx).toBeGreaterThan(taskIdx);
      expect(analysisIdx).toBeGreaterThan(coverageIdx);
      expect(styleIdx).toBeGreaterThan(analysisIdx);
      expect(repairIdx).toBeGreaterThan(styleIdx);
      expect(devIdx).toBeGreaterThan(repairIdx);
    });
  });
});
