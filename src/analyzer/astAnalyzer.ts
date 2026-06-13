import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type InterfaceDeclaration,
  type SourceFile,
  type TypeLiteralNode,
} from 'ts-morph';
import { MAX_SOURCE_CHARS_FOR_FULL_INCLUSION } from '../config/defaults.js';
import { relativePosix } from '../utils/paths.js';
import type {
  ComponentInfo,
  FileAnalysis,
  FunctionInfo,
  HookInfo,
  ImportInfo,
  ParamInfo,
  PropInfo,
  TypeInfo,
} from './analyzer.types.js';
import { getProjectForFile } from './tsProject.js';

const COMPONENT_RETURN_HINTS = ['JSX.Element', 'ReactElement', 'ReactNode', 'React.ReactNode', 'React.JSX.Element', 'React.ReactElement'];

type Callable = FunctionDeclaration | ArrowFunction | FunctionExpression;

function isUpperFirst(name: string): boolean {
  return /^[A-Z]/.test(name);
}

function isHookName(name: string): boolean {
  return /^use[A-Z0-9]/.test(name);
}

/** Strip verbose `import("/abs/path/to/file").Foo` prefixes that ts-morph's type checker emits. */
function cleanTypeText(text: string): string {
  return text.replace(/import\([^)]*\)\./g, '').trim();
}

function getJsDocText(decl: Node): string | undefined {
  let target: Node = decl;
  if (Node.isVariableDeclaration(decl)) {
    target = decl.getVariableStatement() ?? decl;
  }
  if (Node.isJSDocable(target)) {
    const text = target
      .getJsDocs()
      .map((d) => d.getDescription().trim())
      .filter(Boolean)
      .join('\n');
    return text || undefined;
  }
  return undefined;
}

function getDeclarationName(decl: Node, exportedKey: string): string {
  if (exportedKey !== 'default') return exportedKey;
  if (Node.isFunctionDeclaration(decl) || Node.isClassDeclaration(decl)) {
    return decl.getName() ?? 'default';
  }
  if (Node.isVariableDeclaration(decl)) {
    return decl.getName();
  }
  return 'default';
}

function getCallable(decl: Node): Callable | undefined {
  if (Node.isFunctionDeclaration(decl)) return decl;
  if (Node.isVariableDeclaration(decl)) {
    const init = decl.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      return init;
    }
  }
  return undefined;
}

function getParams(callable: Callable): ParamInfo[] {
  return callable.getParameters().map((p) => {
    let type: string;
    try {
      type = cleanTypeText(p.getTypeNode()?.getText() ?? p.getType().getText());
    } catch {
      type = 'unknown';
    }
    return {
      name: p.getName(),
      type,
      optional: p.isOptional() || p.hasInitializer(),
    };
  });
}

function getReturnTypeText(callable: Callable): string {
  const node = callable.getReturnTypeNode();
  if (node) return cleanTypeText(node.getText());
  try {
    return cleanTypeText(callable.getReturnType().getText());
  } catch {
    return 'unknown';
  }
}

function hasJsxInBody(callable: Callable): boolean {
  return (
    callable.getDescendantsOfKind(SyntaxKind.JsxElement).length > 0 ||
    callable.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length > 0 ||
    callable.getDescendantsOfKind(SyntaxKind.JsxFragment).length > 0
  );
}

function looksLikeComponent(name: string, callable: Callable, returnTypeText: string, isTsxFile: boolean): boolean {
  if (!isUpperFirst(name)) return false;
  if (COMPONENT_RETURN_HINTS.some((hint) => returnTypeText.includes(hint))) return true;
  if (isTsxFile && hasJsxInBody(callable)) return true;
  return false;
}

function extractMembersFromTypeLiteral(node: TypeLiteralNode): PropInfo[] {
  return node.getMembers().flatMap((member) => {
    if (!Node.isPropertySignature(member)) return [];
    let type = 'unknown';
    try {
      type = cleanTypeText(member.getTypeNode()?.getText() ?? member.getType().getText());
    } catch {
      // keep 'unknown'
    }
    return [
      {
        name: member.getName(),
        type,
        optional: member.hasQuestionToken(),
        jsDoc: getJsDocText(member),
      },
    ];
  });
}

function extractMembersFromInterface(node: InterfaceDeclaration): PropInfo[] {
  return node.getProperties().flatMap((member) => {
    let type = 'unknown';
    try {
      type = cleanTypeText(member.getTypeNode()?.getText() ?? member.getType().getText());
    } catch {
      // keep 'unknown'
    }
    return [
      {
        name: member.getName(),
        type,
        optional: member.hasQuestionToken(),
        jsDoc: getJsDocText(member),
      },
    ];
  });
}

function extractProps(callable: Callable): { props: PropInfo[]; propsTypeName?: string } {
  const params = callable.getParameters();
  const param = params[0];
  if (!param) return { props: [] };

  const typeNode = param.getTypeNode();
  if (!typeNode) return { props: [] };

  if (Node.isTypeLiteral(typeNode)) {
    return { props: extractMembersFromTypeLiteral(typeNode) };
  }

  if (Node.isTypeReference(typeNode)) {
    const typeName = typeNode.getTypeName().getText();
    try {
      const decls = typeNode.getType().getSymbol()?.getDeclarations() ?? [];
      for (const decl of decls) {
        if (Node.isInterfaceDeclaration(decl)) {
          return { props: extractMembersFromInterface(decl), propsTypeName: typeName };
        }
        if (Node.isTypeAliasDeclaration(decl)) {
          const inner = decl.getTypeNode();
          if (inner && Node.isTypeLiteral(inner)) {
            return { props: extractMembersFromTypeLiteral(inner), propsTypeName: typeName };
          }
        }
      }
    } catch {
      // fall through to propsTypeName-only result
    }
    return { props: [], propsTypeName: typeName };
  }

  return { props: [] };
}

function extractImports(sourceFile: SourceFile): ImportInfo[] {
  return sourceFile.getImportDeclarations().map((imp) => ({
    moduleSpecifier: imp.getModuleSpecifierValue(),
    namedImports: imp.getNamedImports().map((n) => n.getName()),
    defaultImport: imp.getDefaultImport()?.getText(),
    isTypeOnly: imp.isTypeOnly(),
  }));
}

function detectIsReactFile(sourceFile: SourceFile, filePath: string): boolean {
  if (filePath.endsWith('.tsx')) return true;
  return sourceFile.getImportDeclarations().some((imp) => imp.getModuleSpecifierValue() === 'react');
}

function buildAnalysisFromSourceFile(sourceFile: SourceFile, filePath: string, repoRoot: string): FileAnalysis {
  const isReact = detectIsReactFile(sourceFile, filePath);
  const isTsx = filePath.endsWith('.tsx');

  const components: ComponentInfo[] = [];
  const hooks: HookInfo[] = [];
  const functions: FunctionInfo[] = [];
  const exportedTypes: TypeInfo[] = [];

  for (const [exportName, decls] of sourceFile.getExportedDeclarations()) {
    for (const decl of decls) {
      try {
        if (Node.isInterfaceDeclaration(decl)) {
          exportedTypes.push({ name: decl.getName(), kind: 'interface', text: decl.getText() });
          continue;
        }
        if (Node.isTypeAliasDeclaration(decl)) {
          exportedTypes.push({ name: decl.getName(), kind: 'type', text: decl.getText() });
          continue;
        }

        const callable = getCallable(decl);
        if (!callable) continue;

        const name = getDeclarationName(decl, exportName);
        const isDefaultExport = exportName === 'default';
        const parameters = getParams(callable);
        const returnType = getReturnTypeText(callable);
        const jsDoc = getJsDocText(decl);

        if (looksLikeComponent(name, callable, returnType, isTsx)) {
          const { props, propsTypeName } = extractProps(callable);
          components.push({ name, isDefaultExport, propsTypeName, props, jsDoc });
        } else if (isHookName(name)) {
          hooks.push({ name, isDefaultExport, parameters, returnType, jsDoc });
        } else {
          functions.push({ name, isDefaultExport, parameters, returnType, jsDoc });
        }
      } catch {
        // best-effort extraction: skip declarations that don't analyze cleanly
      }
    }
  }

  const fullText = sourceFile.getFullText();
  const truncated = fullText.length > MAX_SOURCE_CHARS_FOR_FULL_INCLUSION;
  const sourceText = truncated
    ? `${fullText.slice(0, MAX_SOURCE_CHARS_FOR_FULL_INCLUSION)}\n\n/* ... truncated (file is ${fullText.length} chars); see extracted signatures for the rest ... */`
    : fullText;

  return {
    filePath,
    relativePath: relativePosix(repoRoot, filePath),
    sourceText,
    truncated,
    isReactFile: isReact,
    components,
    hooks,
    functions,
    exportedTypes,
    imports: extractImports(sourceFile),
  };
}

/** Analyze a TS/TSX file, extracting exported components/hooks/functions/types for prompt context. */
export async function analyzeFile(filePath: string, repoRoot: string): Promise<FileAnalysis> {
  const project = await getProjectForFile(filePath, repoRoot);
  const sourceFile = project.getSourceFile(filePath) ?? project.addSourceFileAtPath(filePath);
  return buildAnalysisFromSourceFile(sourceFile, filePath, repoRoot);
}
