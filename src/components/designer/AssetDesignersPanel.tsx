import { useState } from 'react'
import { GUARDRAIL_DESCRIPTION_MAX } from '../../lib/designerConstants'
import { Plus, Trash2 } from 'lucide-react'
import { useGraphStore } from '../../store/graphStore'
import type {
  BusinessRuleDefinition,
  GuardrailDefinition,
  PersonaDefinition,
  RagPipelineConfig,
  SkillDefinition,
} from '../../types/graph'

type AssetTab = 'skills' | 'guardrails' | 'rules' | 'personas' | 'rag'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="designer-section">
      <h4 className="designer-section-title">{title}</h4>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {hint && <span className="field-hint">{hint}</span>}
      {children}
    </label>
  )
}

const TABS: { id: AssetTab; label: string }[] = [
  { id: 'skills', label: 'Skills' },
  { id: 'guardrails', label: 'Guardrails' },
  { id: 'rules', label: 'Business Rules' },
  { id: 'personas', label: 'Personas' },
  { id: 'rag', label: 'RAG Pipelines' },
]

function guardrailValidationError(g: GuardrailDefinition): string | null {
  if (!g.name.trim() || !g.policy.trim()) {
    return 'Name and policy are required before saving.'
  }
  return null
}

export function AssetDesignersPanel() {
  const [tab, setTab] = useState<AssetTab>('skills')
  const [guardrailFilter, setGuardrailFilter] = useState('')
  const document = useGraphStore((s) => s.document)
  const {
    addSkillDefinition,
    updateSkillDefinition,
    removeSkillDefinition,
    addGuardrailDefinition,
    updateGuardrailDefinition,
    removeGuardrailDefinition,
    addBusinessRuleDefinition,
    updateBusinessRuleDefinition,
    removeBusinessRuleDefinition,
    addPersonaDefinition,
    updatePersonaDefinition,
    removePersonaDefinition,
    addRagPipeline,
    updateRagPipeline,
    removeRagPipeline,
  } = useGraphStore()

  const skills = document.skillRegistry ?? []
  const guardrails = document.guardrailRegistry ?? []
  const filteredGuardrails = guardrails.filter((g) => {
    const q = guardrailFilter.trim().toLowerCase()
    if (!q) return true
    return (
      g.name.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.policy.toLowerCase().includes(q)
    )
  })
  const rules = document.businessRuleRegistry ?? []
  const personas = document.personaRegistry ?? []
  const pipelines = document.ragPipelines ?? []

  return (
    <div className="designer-panel" data-testid="asset-designers">
      <header className="designer-panel-header graph-header">
        <div className="designer-panel-badge">Assets</div>
        <h3>Asset Designers</h3>
        <p className="designer-panel-id">Skills · Guardrails · Rules · Personas · RAG</p>
      </header>

      <nav className="asset-subtabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`asset-subtab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="designer-scroll">
        {tab === 'skills' && (
          <>
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={() => {
                const skill: SkillDefinition = {
                  id: `skill_${Date.now().toString(36)}`,
                  name: 'New Skill',
                  description: '',
                  instructions: '',
                  toolIds: [],
                  personaId: '',
                  promptTemplate: '{input}',
                  tags: '',
                }
                addSkillDefinition(skill)
              }}
            >
              <Plus size={12} /> Add skill
            </button>
            {skills.length === 0 && (
              <div className="designer-empty" data-testid="skills-empty-hint">
                <div className="designer-empty-icon">✦</div>
                <h3>No skills yet</h3>
                <p>Add reusable skill definitions here. They export to the skills/ module in your Python project.</p>
              </div>
            )}
            {skills.map((skill) => (
              <Section key={skill.id} title={skill.name}>
                <Field label="Name">
                  <input className="input" value={skill.name} onChange={(e) => updateSkillDefinition(skill.id, { name: e.target.value })} />
                </Field>
                <Field label="Description">
                  <textarea className="textarea" rows={2} value={skill.description} onChange={(e) => updateSkillDefinition(skill.id, { description: e.target.value })} />
                </Field>
                <Field label="Instructions" hint="Exported to skills/ module">
                  <textarea className="textarea code" rows={4} value={skill.instructions} onChange={(e) => updateSkillDefinition(skill.id, { instructions: e.target.value })} />
                </Field>
                <Field label="Persona ID">
                  <select className="input" value={skill.personaId} onChange={(e) => updateSkillDefinition(skill.id, { personaId: e.target.value })}>
                    <option value="">None</option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tool IDs" hint="Comma-separated">
                  <input className="input" value={skill.toolIds.join(', ')} onChange={(e) => updateSkillDefinition(skill.id, { toolIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                </Field>
                <Field label="Prompt template">
                  <textarea className="textarea" rows={2} value={skill.promptTemplate} onChange={(e) => updateSkillDefinition(skill.id, { promptTemplate: e.target.value })} />
                </Field>
                <button type="button" className="btn-danger-sm" onClick={() => removeSkillDefinition(skill.id)}>
                  <Trash2 size={12} /> Remove
                </button>
              </Section>
            ))}
          </>
        )}

        {tab === 'guardrails' && (
          <>
            <input
              className="input"
              type="search"
              data-testid="guardrail-search"
              data-cycle="169"
              data-cycle-search="229"
              placeholder="Search guardrails…"
              value={guardrailFilter}
              onChange={(e) => setGuardrailFilter(e.target.value)}
              aria-label="Filter guardrails"
            />
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={() => {
                const g: GuardrailDefinition = {
                  id: `guardrail_${Date.now().toString(36)}`,
                  name: 'New Guardrail',
                  description: '',
                  type: 'both',
                  policy: '',
                  action: 'block',
                  severity: 'medium',
                  enabled: true,
                }
                addGuardrailDefinition(g)
              }}
            >
              <Plus size={12} /> Add guardrail
            </button>
            {guardrails.length === 0 && (
              <div className="designer-empty" data-testid="guardrails-empty-hint">
                <div data-testid="cycle-133-guardrails-empty-hint">
                <div data-testid="cycle-253-guardrails-empty-hint">
                  <div className="designer-empty-icon">🛡</div>
                  <h3>No guardrails yet</h3>
                  <p>Add input/output guardrails here. They export to the guardrails/ module in your Python project.</p>
                </div>
                </div>
              </div>
            )}
            {filteredGuardrails.length === 0 && guardrails.length > 0 && (
              <p className="designer-empty" data-testid="guardrail-filter-empty">
                No guardrails match your search.
              </p>
            )}
            {filteredGuardrails.map((g) => {
              const validationError = guardrailValidationError(g)
              return (
              <Section key={g.id} title={g.name || 'Untitled guardrail'}>
                <Field label="Name">
                  <input
                    className="input"
                    data-testid={`guardrail-name-${g.id}`}
                    value={g.name}
                    onChange={(e) => updateGuardrailDefinition(g.id, { name: e.target.value })}
                  />
                </Field>
                <Field label="Description">
                  <textarea
                    className="textarea"
                    rows={2}
                    data-testid={`guardrail-description-${g.id}`}
                    value={g.description}
                    maxLength={GUARDRAIL_DESCRIPTION_MAX}
                    onChange={(e) => updateGuardrailDefinition(g.id, { description: e.target.value })}
                  />
                  <span
                    className="field-char-count"
                    data-testid={`guardrail-description-count-${g.id}`}
                    data-cycle="157"
                    data-cycle-count="217"
                  >
                    {g.description.length}/{GUARDRAIL_DESCRIPTION_MAX}
                  </span>
                </Field>
                <Field label="Type">
                  <select className="input" value={g.type} onChange={(e) => updateGuardrailDefinition(g.id, { type: e.target.value as GuardrailDefinition['type'] })}>
                    <option value="input">Input</option>
                    <option value="output">Output</option>
                    <option value="both">Both</option>
                  </select>
                </Field>
                <Field label="Action">
                  <select className="input" value={g.action} onChange={(e) => updateGuardrailDefinition(g.id, { action: e.target.value as GuardrailDefinition['action'] })}>
                    <option value="block">Block</option>
                    <option value="warn">Warn</option>
                    <option value="redact">Redact</option>
                    <option value="rewrite">Rewrite</option>
                  </select>
                </Field>
                <Field label="Policy">
                  <textarea
                    className="textarea code"
                    rows={4}
                    data-testid={`guardrail-policy-${g.id}`}
                    value={g.policy}
                    onChange={(e) => updateGuardrailDefinition(g.id, { policy: e.target.value })}
                  />
                </Field>
                {validationError && (
                  <p className="field-error" data-testid="guardrail-validation-error">
                    <span data-testid="cycle-145-guardrail-validation">{validationError}</span>
                    <span data-testid="cycle-265-guardrail-validation" className="sr-only">cycle 265</span>
                    <span data-testid="cycle-205-guardrail-validation" className="sr-only">cycle 205</span>
                  </p>
                )}
                <label className="designer-check">
                  <input type="checkbox" checked={g.enabled} onChange={(e) => updateGuardrailDefinition(g.id, { enabled: e.target.checked })} />
                  Enabled
                </label>
                <button
                  type="button"
                  className="btn-danger-sm"
                  data-testid={`guardrail-remove-${g.id}`}
                  data-cycle="181"
                  data-cycle-guard="241"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete guardrail "${g.name}"? This cannot be undone.`,
                      )
                    ) {
                      removeGuardrailDefinition(g.id)
                    }
                  }}
                >
                  <Trash2 size={12} /> Remove
                </button>
              </Section>
            )})}
          </>
        )}

        {tab === 'rules' && (
          <>
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={() => {
                const r: BusinessRuleDefinition = {
                  id: `rule_${Date.now().toString(36)}`,
                  name: 'New Rule',
                  description: '',
                  condition: 'True',
                  action: 'continue',
                  priority: 1,
                  enabled: true,
                }
                addBusinessRuleDefinition(r)
              }}
            >
              <Plus size={12} /> Add rule
            </button>
            {rules.map((r) => (
              <Section key={r.id} title={r.name}>
                <Field label="Name">
                  <input className="input" value={r.name} onChange={(e) => updateBusinessRuleDefinition(r.id, { name: e.target.value })} />
                </Field>
                <Field label="Condition" hint="Python expression on context dict">
                  <input className="input code" value={r.condition} onChange={(e) => updateBusinessRuleDefinition(r.id, { condition: e.target.value })} />
                </Field>
                <Field label="Action">
                  <input className="input" value={r.action} onChange={(e) => updateBusinessRuleDefinition(r.id, { action: e.target.value })} />
                </Field>
                <Field label="Priority">
                  <input className="input" type="number" value={r.priority} onChange={(e) => updateBusinessRuleDefinition(r.id, { priority: Number(e.target.value) })} />
                </Field>
                <label className="designer-check">
                  <input type="checkbox" checked={r.enabled} onChange={(e) => updateBusinessRuleDefinition(r.id, { enabled: e.target.checked })} />
                  Enabled
                </label>
                <button type="button" className="btn-danger-sm" onClick={() => removeBusinessRuleDefinition(r.id)}>
                  <Trash2 size={12} /> Remove
                </button>
              </Section>
            ))}
          </>
        )}

        {tab === 'personas' && (
          <>
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={() => {
                const p: PersonaDefinition = {
                  id: `persona_${Date.now().toString(36)}`,
                  name: 'New Persona',
                  role: '',
                  tone: '',
                  systemPrompt: '',
                  constraints: '',
                  vocabulary: '',
                }
                addPersonaDefinition(p)
              }}
            >
              <Plus size={12} /> Add persona
            </button>
            {personas.map((p) => (
              <Section key={p.id} title={p.name}>
                <Field label="Name">
                  <input className="input" value={p.name} onChange={(e) => updatePersonaDefinition(p.id, { name: e.target.value })} />
                </Field>
                <Field label="Role">
                  <input className="input" value={p.role} onChange={(e) => updatePersonaDefinition(p.id, { role: e.target.value })} />
                </Field>
                <Field label="Tone">
                  <input className="input" value={p.tone} onChange={(e) => updatePersonaDefinition(p.id, { tone: e.target.value })} />
                </Field>
                <Field label="System prompt">
                  <textarea className="textarea designer-prompt" rows={4} value={p.systemPrompt} onChange={(e) => updatePersonaDefinition(p.id, { systemPrompt: e.target.value })} />
                </Field>
                <Field label="Constraints">
                  <textarea className="textarea" rows={2} value={p.constraints} onChange={(e) => updatePersonaDefinition(p.id, { constraints: e.target.value })} />
                </Field>
                <button type="button" className="btn-danger-sm" onClick={() => removePersonaDefinition(p.id)}>
                  <Trash2 size={12} /> Remove
                </button>
              </Section>
            ))}
          </>
        )}

        {tab === 'rag' && (
          <>
            <button
              type="button"
              className="btn-secondary-sm"
              onClick={() => {
                const p: RagPipelineConfig = {
                  id: `rag_${Date.now().toString(36)}`,
                  name: 'New RAG Pipeline',
                  description: '',
                  chunkStrategy: 'recursive',
                  chunkSize: 512,
                  chunkOverlap: 64,
                  embeddingProvider: 'openai',
                  embeddingModel: 'text-embedding-3-small',
                  retrievalMode: 'hybrid',
                  vectorStore: 'in_memory',
                  topK: 5,
                  rerankEnabled: false,
                  rerankModel: '',
                  sourcePaths: './data',
                  metadataFilters: '',
                }
                addRagPipeline(p)
              }}
            >
              <Plus size={12} /> Add RAG pipeline
            </button>
            {pipelines.map((p) => (
              <Section key={p.id} title={p.name}>
                <Field label="Name">
                  <input className="input" value={p.name} onChange={(e) => updateRagPipeline(p.id, { name: e.target.value })} />
                </Field>
                <Field label="Retrieval mode" hint="vector · vectorless · hybrid">
                  <select className="input" value={p.retrievalMode} onChange={(e) => updateRagPipeline(p.id, { retrievalMode: e.target.value as RagPipelineConfig['retrievalMode'] })}>
                    <option value="vector">Vector</option>
                    <option value="vectorless">Vectorless (BM25 / lexical)</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </Field>
                <Field label="Chunk strategy">
                  <select className="input" value={p.chunkStrategy} onChange={(e) => updateRagPipeline(p.id, { chunkStrategy: e.target.value as RagPipelineConfig['chunkStrategy'] })}>
                    <option value="recursive">Recursive</option>
                    <option value="fixed">Fixed size</option>
                    <option value="semantic">Semantic</option>
                    <option value="markdown">Markdown</option>
                    <option value="sentence">Sentence</option>
                  </select>
                </Field>
                <Field label="Chunk size / overlap">
                  <div className="field-row">
                    <input className="input" type="number" value={p.chunkSize} onChange={(e) => updateRagPipeline(p.id, { chunkSize: Number(e.target.value) })} />
                    <input className="input" type="number" value={p.chunkOverlap} onChange={(e) => updateRagPipeline(p.id, { chunkOverlap: Number(e.target.value) })} />
                  </div>
                </Field>
                <Field label="Embedding provider / model">
                  <div className="field-row">
                    <select className="input" value={p.embeddingProvider} onChange={(e) => updateRagPipeline(p.id, { embeddingProvider: e.target.value as RagPipelineConfig['embeddingProvider'] })}>
                      <option value="openai">OpenAI</option>
                      <option value="cohere">Cohere</option>
                      <option value="huggingface">HuggingFace</option>
                      <option value="local">Local</option>
                    </select>
                    <input className="input" value={p.embeddingModel} onChange={(e) => updateRagPipeline(p.id, { embeddingModel: e.target.value })} />
                  </div>
                </Field>
                <Field label="Vector store">
                  <select className="input" value={p.vectorStore} onChange={(e) => updateRagPipeline(p.id, { vectorStore: e.target.value as RagPipelineConfig['vectorStore'] })}>
                    <option value="in_memory">In-memory</option>
                    <option value="chroma">Chroma</option>
                    <option value="pinecone">Pinecone</option>
                    <option value="pgvector">pgvector</option>
                    <option value="faiss">FAISS</option>
                  </select>
                </Field>
                <Field label="Top K">
                  <input className="input" type="number" value={p.topK} onChange={(e) => updateRagPipeline(p.id, { topK: Number(e.target.value) })} />
                </Field>
                <Field label="Source paths" hint="Comma-separated file or directory paths">
                  <input className="input" value={p.sourcePaths} onChange={(e) => updateRagPipeline(p.id, { sourcePaths: e.target.value })} />
                </Field>
                <label className="designer-check">
                  <input type="checkbox" checked={p.rerankEnabled} onChange={(e) => updateRagPipeline(p.id, { rerankEnabled: e.target.checked })} />
                  Enable reranking
                </label>
                {p.rerankEnabled && (
                  <Field label="Rerank model">
                    <input className="input" value={p.rerankModel} onChange={(e) => updateRagPipeline(p.id, { rerankModel: e.target.value })} />
                  </Field>
                )}
                <button type="button" className="btn-danger-sm" onClick={() => removeRagPipeline(p.id)}>
                  <Trash2 size={12} /> Remove
                </button>
              </Section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
