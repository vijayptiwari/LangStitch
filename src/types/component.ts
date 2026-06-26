export type ComponentCategory = 'node' | 'connector' | 'adaptor'

export type ConfigFieldKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'select'
  | 'code'
  | 'secret'
  | 'json'

export interface ConfigFieldOption {
  value: string
  label: string
}

export interface ConfigField {
  id: string
  label: string
  kind: ConfigFieldKind
  required?: boolean
  defaultValue?: string | number | boolean
  placeholder?: string
  hint?: string
  options?: ConfigFieldOption[]
  min?: number
  max?: number
  pattern?: string
  language?: 'python' | 'json' | 'text'
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
  /**
   * Safe template. Allowed placeholders ONLY:
   *  {{label}} {{nodeName}} {{description}} {{outputKey}}
   *  {{field.<id>}}        -> escaped per field kind
   *  {{field.<id>.raw}}    -> raw (code fields only)
   * Must define a function `def {{nodeName}}(state: State) -> dict:` returning a dict.
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
}

/** Provenance wrapper for the portable `.component.json` file (§5.6). */
export interface PortableComponentFile {
  langstitchComponent: '1.0'
  exportedAt: string
  manifest: ComponentManifest
}
