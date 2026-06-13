export interface ParamInfo {
  name: string;
  type: string;
  optional: boolean;
}

export interface PropInfo {
  name: string;
  type: string;
  optional: boolean;
  jsDoc?: string;
}

export interface ComponentInfo {
  name: string;
  isDefaultExport: boolean;
  propsTypeName?: string;
  props: PropInfo[];
  jsDoc?: string;
}

export interface HookInfo {
  name: string;
  isDefaultExport: boolean;
  parameters: ParamInfo[];
  returnType: string;
  jsDoc?: string;
}

export interface FunctionInfo {
  name: string;
  isDefaultExport: boolean;
  parameters: ParamInfo[];
  returnType: string;
  jsDoc?: string;
}

export interface TypeInfo {
  name: string;
  kind: 'interface' | 'type';
  text: string;
}

export interface ImportInfo {
  moduleSpecifier: string;
  namedImports: string[];
  defaultImport?: string;
  isTypeOnly: boolean;
}

export interface FileAnalysis {
  /** Absolute path to the source file. */
  filePath: string;
  /** Path relative to the repo root, posix-style. */
  relativePath: string;
  /** Full source text, or a trimmed signature-only excerpt when `truncated`. */
  sourceText: string;
  truncated: boolean;
  isReactFile: boolean;
  components: ComponentInfo[];
  hooks: HookInfo[];
  functions: FunctionInfo[];
  exportedTypes: TypeInfo[];
  imports: ImportInfo[];
}
