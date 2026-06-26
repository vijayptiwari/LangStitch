export type ComponentCategory = 'node' | 'connector' | 'adaptor'

export type ConfigFieldKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'code'
  | 'secret'
  | 'json'
  | 'ref'
  | 'multiref'
  | 'list'
  | 'group'

export type RefSource =
  | 'tools'
  | 'agents'
  | 'skills'
  | 'guardrails'
  | 'personas'
  | 'pipelines'
  | 'mcp'
  | 'subgraphs'

export type CodegenKind =
  | 'node'
  | 'router'
  | 'terminal'
  | 'subgraph'
  | 'agent'
  | 'scope'
  | 'human_interrupt'

export interface ConfigFieldOption {
  value: string
  label: string
}

export interface VisibleWhen {
  field: string
  equals?: string | number | boolean
  notEquals?: string | number | boolean
}

export interface ConfigField {
  id: string
  label: string
  kind: ConfigFieldKind
  required?: boolean
  defaultValue?: string | number | boolean | unknown[]
  placeholder?: string
  hint?: string
  options?: ConfigFieldOption[]
  min?: number
  max?: number
  pattern?: string
  language?: 'python' | 'json' | 'text'
  /** Registry binding for ref/multiref fields */
  source?: RefSource
  /** Sub-fields for list/group kinds */
  fields?: ConfigField[]
  /** Show this field only when another field matches */
  visibleWhen?: VisibleWhen
  /** For list fields that drive dynamic output ports (routers, intents) */
  portLabelField?: string
}

export type PortSide = 'left' | 'right'
export type PortMultiplicity = 'single' | 'multi'

export interface ComponentPort {
  id: string
  label: string
  side: PortSide
  multiplicity: PortMultiplicity
}

export interface ComponentTheme {
  color: string
  colorLight: string
  icon: string
  typeLabel: string
}

export interface ComponentCodegen {
  kind?: CodegenKind
  /**
   * Safe template. Allowed placeholders ONLY:
   *  {{label}} {{nodeName}} {{description}} {{outputKey}}
   *  {{field.<id>}}        -> escaped per field kind
   *  {{field.<id>.raw}}    -> raw (code fields only)
   */
  template: string
  imports?: string[]
  dependencies?: string[]
  async?: boolean
}

export interface ComponentManifest {
  schemaVersion: '1.0'
  id: string
  label: string
  category: ComponentCategory
  description: string
  ports: ComponentPort[]
  configFields: ConfigField[]
  theme: ComponentTheme
  codegen: ComponentCodegen
  author?: string
  version?: string
  /** Built-in manifests cannot be removed from the registry */
  builtin?: boolean
}

/** Provenance wrapper for the portable `.component.json` file (§5.6). */
export interface PortableComponentFile {
  langstitchComponent: '1.0'
  exportedAt: string
  manifest: ComponentManifest
}
