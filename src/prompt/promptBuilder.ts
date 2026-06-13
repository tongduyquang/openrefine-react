import type { ComponentInfo, FileAnalysis, FunctionInfo, HookInfo, ParamInfo } from '../analyzer/analyzer.types.js';
import { buildFixTaskSection } from './templates/fixTest.js';
import { buildGenerateTaskSection } from './templates/generateTest.js';
import { buildRepairSection } from './templates/repairError.js';
import { buildSystemPrompt } from './templates/system.js';
import type { AssembledPrompt, PromptContext } from './prompt.types.js';

function formatParams(params: ParamInfo[]): string {
  return params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
}

function formatComponent(c: ComponentInfo): string {
  const lines: string[] = [`### Component: ${c.name}${c.isDefaultExport ? ' (default export)' : ''}`];
  if (c.jsDoc) lines.push(c.jsDoc);
  if (c.propsTypeName) lines.push(`Props type: ${c.propsTypeName}`);
  if (c.props.length > 0) {
    lines.push('Props:');
    for (const p of c.props) {
      const doc = p.jsDoc ? ` — ${p.jsDoc}` : '';
      lines.push(`  - ${p.name}${p.optional ? '?' : ''}: ${p.type}${doc}`);
    }
  } else if (!c.propsTypeName) {
    lines.push('Props: (none)');
  }
  return lines.join('\n');
}

function formatHook(h: HookInfo): string {
  const lines: string[] = [`### Hook: ${h.name}${h.isDefaultExport ? ' (default export)' : ''}`];
  if (h.jsDoc) lines.push(h.jsDoc);
  lines.push(`Signature: ${h.name}(${formatParams(h.parameters)}): ${h.returnType}`);
  return lines.join('\n');
}

function formatFunction(f: FunctionInfo): string {
  const lines: string[] = [`### Function: ${f.name}${f.isDefaultExport ? ' (default export)' : ''}`];
  if (f.jsDoc) lines.push(f.jsDoc);
  lines.push(`Signature: ${f.name}(${formatParams(f.parameters)}): ${f.returnType}`);
  return lines.join('\n');
}

function buildAnalysisSection(analysis: FileAnalysis): string {
  const parts: string[] = [];
  parts.push('## Source file under test');
  parts.push(`Path: ${analysis.relativePath}`);
  parts.push(`React file: ${analysis.isReactFile ? 'yes' : 'no'}`);

  for (const c of analysis.components) {
    parts.push('', formatComponent(c));
  }
  for (const h of analysis.hooks) {
    parts.push('', formatHook(h));
  }
  for (const f of analysis.functions) {
    parts.push('', formatFunction(f));
  }
  for (const t of analysis.exportedTypes) {
    parts.push('', `### Exported ${t.kind}: ${t.name}`, '```ts', t.text, '```');
  }

  const lang = analysis.filePath.endsWith('.tsx') ? 'tsx' : 'ts';
  parts.push('', '### Full source', `\`\`\`${lang}`, analysis.sourceText, '```');

  return parts.join('\n');
}

/** Assemble the {system, user} prompt for one AI generation/fix/repair call. */
export function buildPrompt(ctx: PromptContext): AssembledPrompt {
  const system = buildSystemPrompt(ctx.conventions);
  const sections: string[] = [];

  if (ctx.mode === 'generate') {
    sections.push(buildGenerateTaskSection(ctx.relativeSourcePath, ctx.relativeOutputPath));
  } else {
    sections.push(buildFixTaskSection(ctx.relativeSourcePath, ctx.relativeOutputPath, ctx.existingTest ?? ''));
  }

  if (ctx.coverage && ctx.coverage.uncoveredLines.length > 0) {
    sections.push(
      '',
      '## Coverage gap',
      `This file currently has ${ctx.coverage.percent}% line coverage. Prioritize covering these currently-uncovered lines: ${ctx.coverage.uncoveredLines.join(', ')}.`,
    );
  }

  sections.push('', buildAnalysisSection(ctx.analysis));

  if (ctx.exampleTest) {
    sections.push(
      '',
      '## Style reference',
      `An existing test file in this repo (${ctx.exampleTest.relativePath}) — follow its structure, imports, and conventions where applicable:`,
      '```tsx',
      ctx.exampleTest.content,
      '```',
    );
  }

  if (ctx.repair) {
    sections.push('', buildRepairSection(ctx.repair.previousAttempt, ctx.repair.errorOutput, ctx.repair.attemptNumber));
  }

  if (ctx.customPrompt) {
    sections.push(
      '',
      '## Developer instructions',
      'The following project-specific requirements take precedence over the general guidance above where they conflict:',
      ctx.customPrompt,
    );
  }

  return { system, user: sections.join('\n') };
}
