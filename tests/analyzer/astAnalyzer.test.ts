import path from 'node:path';
import { promises as fs } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { analyzeFile } from '../../src/analyzer/astAnalyzer.js';

const repoRoot = path.resolve('examples/sample-app');

describe('analyzeFile', () => {
  it('analyzes a component with a props interface, JSDoc, and JSX body (Greeting.tsx)', async () => {
    const filePath = path.join(repoRoot, 'src/components/Greeting.tsx');
    const analysis = await analyzeFile(filePath, repoRoot);

    expect(analysis.isReactFile).toBe(true);
    expect(analysis.components).toHaveLength(1);

    const [component] = analysis.components;
    expect(component?.name).toBe('Greeting');
    expect(component?.isDefaultExport).toBe(false);
    expect(component?.propsTypeName).toBe('GreetingProps');

    const nameProp = component?.props.find((p) => p.name === 'name');
    expect(nameProp).toBeDefined();
    expect(nameProp?.optional).toBe(false);
    expect(nameProp?.type).toBe('string');

    const timeOfDayProp = component?.props.find((p) => p.name === 'timeOfDay');
    expect(timeOfDayProp).toBeDefined();
    expect(timeOfDayProp?.optional).toBe(true);
    expect(timeOfDayProp?.type).toContain("'morning'");

    expect(component?.jsDoc).toBeTruthy();
    expect(typeof component?.jsDoc).toBe('string');
    expect(component?.jsDoc?.length).toBeGreaterThan(0);
  });

  it('analyzes a component with optional props including a function-typed prop (Counter.tsx)', async () => {
    const filePath = path.join(repoRoot, 'src/components/Counter.tsx');
    const analysis = await analyzeFile(filePath, repoRoot);

    expect(analysis.components).toHaveLength(1);

    const [component] = analysis.components;
    expect(component?.name).toBe('Counter');
    expect(component?.propsTypeName).toBe('CounterProps');

    const initialCountProp = component?.props.find((p) => p.name === 'initialCount');
    expect(initialCountProp).toBeDefined();
    expect(initialCountProp?.optional).toBe(true);
    expect(initialCountProp?.type).toBe('number');

    const onChangeProp = component?.props.find((p) => p.name === 'onChange');
    expect(onChangeProp).toBeDefined();
    expect(onChangeProp?.optional).toBe(true);
    expect(onChangeProp?.type).toContain('=>');
  });

  it('analyzes a hook file as a React file with a tuple return type and JSDoc (useToggle.ts)', async () => {
    const filePath = path.join(repoRoot, 'src/hooks/useToggle.ts');
    const analysis = await analyzeFile(filePath, repoRoot);

    expect(analysis.isReactFile).toBe(true);
    expect(analysis.hooks).toHaveLength(1);

    const [hook] = analysis.hooks;
    expect(hook?.name).toBe('useToggle');
    expect(hook?.returnType).toContain('boolean');
    expect(hook?.returnType).toContain('() => void');
    expect(hook?.jsDoc).toBeTruthy();
    expect(typeof hook?.jsDoc).toBe('string');
  });

  it('analyzes a plain utility file as non-React with an extracted function signature (formatCurrency.ts)', async () => {
    const filePath = path.join(repoRoot, 'src/utils/formatCurrency.ts');
    const analysis = await analyzeFile(filePath, repoRoot);

    expect(analysis.isReactFile).toBe(false);
    expect(analysis.functions).toHaveLength(1);

    const [fn] = analysis.functions;
    expect(fn?.name).toBe('formatCurrency');
    expect(fn?.parameters).toHaveLength(1);
    expect(fn?.parameters[0]?.name).toBe('amount');
    expect(fn?.parameters[0]?.type).toBe('number');
    expect(fn?.returnType).toBe('string');
  });

  it('extracts import declarations (Counter.tsx imports useState from react)', async () => {
    const filePath = path.join(repoRoot, 'src/components/Counter.tsx');
    const analysis = await analyzeFile(filePath, repoRoot);

    const reactImport = analysis.imports.find((imp) => imp.moduleSpecifier === 'react');
    expect(reactImport).toBeDefined();
    expect(reactImport?.namedImports).toContain('useState');
    expect(reactImport?.isTypeOnly).toBe(false);
  });

  it('reports truncated === false and sourceText equal to the full file text for small fixture files', async () => {
    const filePath = path.join(repoRoot, 'src/components/Greeting.tsx');
    const analysis = await analyzeFile(filePath, repoRoot);

    const fullText = await fs.readFile(filePath, 'utf-8');

    expect(analysis.truncated).toBe(false);
    expect(analysis.sourceText).toBe(fullText);
  });
});
