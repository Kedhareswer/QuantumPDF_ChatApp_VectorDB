'use client';

/**
 * Domain Agents - Specialized post-retrieval processing chains
 * These agents run after core RAG retrieval to provide domain-specific analysis
 */

import { getLocalSummarizer } from './local-summarizer'

export type AgentType = 
  | 'analogy-maker' 
  | 'compliance-checker' 
  | 'explainer' 
  | 'fact-checker'
  | 'key-terms'
  | 'summary'

export interface AgentInput {
  question: string
  context: string
  chunks: Array<{
    content: string
    source: string
    similarity: number
    chunkType?: string
  }>
  metadata?: Record<string, any>
}

export interface AgentOutput {
  agentType: AgentType
  result: string
  confidence: number
  details?: Record<string, any>
  processingTime: number
}

export interface AgentConfig {
  enabled: boolean
  aiClient?: any // AIClient instance for LLM-powered agents
  useLocalModels?: boolean
}

/**
 * Base class for domain agents
 */
abstract class BaseAgent {
  protected name: AgentType
  protected config: AgentConfig

  constructor(name: AgentType, config: AgentConfig) {
    this.name = name
    this.config = config
  }

  abstract process(input: AgentInput): Promise<AgentOutput>

  protected createOutput(result: string, confidence: number, details?: Record<string, any>, startTime?: number): AgentOutput {
    return {
      agentType: this.name,
      result,
      confidence,
      details,
      processingTime: startTime ? Date.now() - startTime : 0,
    }
  }
}

/**
 * Analogy Maker Agent
 * Creates analogies and simplified explanations for complex concepts
 */
export class AnalogyMakerAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super('analogy-maker', config)
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now()

    try {
      // Extract key concepts from the context
      const concepts = this.extractKeyConcepts(input.context)
      
      if (concepts.length === 0) {
        return this.createOutput(
          'No complex concepts found that require analogies.',
          0.5,
          { concepts: [] },
          startTime
        )
      }

      // Generate analogies using AI client if available
      if (this.config.aiClient) {
        const analogies = await this.generateAnalogiesWithAI(input, concepts)
        return this.createOutput(
          analogies,
          0.8,
          { concepts, method: 'ai-generated' },
          startTime
        )
      }

      // Fallback to template-based analogies
      const analogies = this.generateTemplateAnalogies(concepts)
      return this.createOutput(
        analogies,
        0.6,
        { concepts, method: 'template' },
        startTime
      )
    } catch (error) {
      console.error('AnalogyMakerAgent error:', error)
      return this.createOutput(
        'Unable to generate analogies for this content.',
        0.3,
        { error: error instanceof Error ? error.message : 'Unknown error' },
        startTime
      )
    }
  }

  private extractKeyConcepts(context: string): string[] {
    const concepts: string[] = []
    
    // Look for technical terms, definitions, and complex phrases
    const patterns = [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, // Capitalized phrases
      /\b(\w+(?:ation|ment|ity|ness|ology|ics))\b/gi, // Abstract noun suffixes
      /"([^"]+)"/g, // Quoted terms
      /\bthe\s+(\w+(?:\s+\w+){0,2})\s+(?:is|refers|means)/gi, // Definition patterns
    ]

    for (const pattern of patterns) {
      const matches = context.matchAll(pattern)
      for (const match of matches) {
        const term = match[1]?.trim()
        if (term && term.length > 3 && term.length < 50 && !concepts.includes(term)) {
          concepts.push(term)
        }
      }
    }

    return concepts.slice(0, 5) // Limit to top 5 concepts
  }

  private async generateAnalogiesWithAI(input: AgentInput, concepts: string[]): Promise<string> {
    const prompt = `Based on the following context about "${input.question}":

${input.context.substring(0, 2000)}

Create simple, relatable analogies for these key concepts: ${concepts.join(', ')}

Format as:
• [Concept]: Think of it like [everyday analogy]`

    const messages = [
      { role: 'system' as const, content: 'You are an expert at explaining complex topics using simple, everyday analogies.' },
      { role: 'user' as const, content: prompt }
    ]

    const response = await this.config.aiClient.generateText(messages)
    return response
  }

  private generateTemplateAnalogies(concepts: string[]): string {
    const templates = [
      `Think of **{concept}** like a library system - it helps organize and retrieve information efficiently.`,
      `**{concept}** works similar to a recipe - you follow a set of steps to achieve a specific result.`,
      `Consider **{concept}** as a traffic light - it controls the flow and timing of operations.`,
      `**{concept}** is like a filter - it separates what's needed from what isn't.`,
      `Think of **{concept}** as a translator - it converts one format or language into another.`,
    ]

    return concepts.map((concept, i) => 
      templates[i % templates.length].replace('{concept}', concept)
    ).join('\n\n')
  }
}

/**
 * Compliance Checker Agent
 * Identifies potential compliance issues, ambiguous clauses, or policy gaps
 */
export class ComplianceCheckerAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super('compliance-checker', config)
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now()

    try {
      // Check for compliance-related keywords and patterns
      const issues = this.identifyComplianceIssues(input.context)
      
      if (issues.length === 0) {
        return this.createOutput(
          'No obvious compliance issues or ambiguous clauses detected.',
          0.7,
          { issues: [], checksPerformed: this.getCheckTypes() },
          startTime
        )
      }

      // Generate detailed analysis with AI if available
      if (this.config.aiClient && issues.length > 0) {
        const analysis = await this.analyzeWithAI(input, issues)
        return this.createOutput(
          analysis,
          0.75,
          { issues, method: 'ai-analysis' },
          startTime
        )
      }

      // Format issues without AI
      const formattedIssues = this.formatIssues(issues)
      return this.createOutput(
        formattedIssues,
        0.6,
        { issues, method: 'pattern-detection' },
        startTime
      )
    } catch (error) {
      console.error('ComplianceCheckerAgent error:', error)
      return this.createOutput(
        'Unable to perform compliance check on this content.',
        0.3,
        { error: error instanceof Error ? error.message : 'Unknown error' },
        startTime
      )
    }
  }

  private getCheckTypes(): string[] {
    return [
      'Ambiguous language',
      'Missing definitions',
      'Contradictory statements',
      'Legal/regulatory keywords',
      'Obligation statements',
      'Exception clauses',
      'Liability language',
    ]
  }

  private identifyComplianceIssues(context: string): Array<{ type: string; text: string; severity: string }> {
    const issues: Array<{ type: string; text: string; severity: string }> = []

    // Ambiguous language patterns
    const ambiguousPatterns = /\b(may|might|could|possibly|generally|usually|typically|reasonable|appropriate|adequate|sufficient|as needed|when necessary)\b/gi
    let match
    while ((match = ambiguousPatterns.exec(context)) !== null) {
      const surroundingText = this.extractSurroundingText(context, match.index, 100)
      issues.push({
        type: 'Ambiguous Language',
        text: surroundingText,
        severity: 'medium',
      })
    }

    // Missing clear definitions
    const undefinedTerms = /\b(the (?:system|process|service|product|user))\b(?!\s+(?:is defined as|means|refers to))/gi
    while ((match = undefinedTerms.exec(context)) !== null) {
      if (issues.length < 10) { // Limit to prevent too many issues
        const surroundingText = this.extractSurroundingText(context, match.index, 80)
        issues.push({
          type: 'Potentially Undefined Term',
          text: surroundingText,
          severity: 'low',
        })
      }
    }

    // Contradictory or conflicting statements
    const conflictPatterns = /\b(however|but|except|unless|notwithstanding|contrary to|despite|although)\b/gi
    while ((match = conflictPatterns.exec(context)) !== null) {
      if (issues.length < 15) {
        const surroundingText = this.extractSurroundingText(context, match.index, 120)
        issues.push({
          type: 'Potential Exception/Conflict',
          text: surroundingText,
          severity: 'medium',
        })
      }
    }

    // Liability and legal language
    const legalPatterns = /\b(shall not be liable|no warranty|as-is|indemnif|limitation of liability|force majeure|governing law|jurisdiction)\b/gi
    while ((match = legalPatterns.exec(context)) !== null) {
      const surroundingText = this.extractSurroundingText(context, match.index, 100)
      issues.push({
        type: 'Legal/Liability Clause',
        text: surroundingText,
        severity: 'high',
      })
    }

    // De-duplicate similar issues
    return this.deduplicateIssues(issues).slice(0, 10)
  }

  private extractSurroundingText(text: string, index: number, radius: number): string {
    const start = Math.max(0, index - radius)
    const end = Math.min(text.length, index + radius)
    return '...' + text.substring(start, end).trim() + '...'
  }

  private deduplicateIssues(issues: Array<{ type: string; text: string; severity: string }>): typeof issues {
    const seen = new Set<string>()
    return issues.filter(issue => {
      const key = issue.type + issue.text.substring(0, 50)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  private async analyzeWithAI(
    input: AgentInput, 
    issues: Array<{ type: string; text: string; severity: string }>
  ): Promise<string> {
    const issuesSummary = issues.slice(0, 5).map(i => `- ${i.type}: "${i.text}"`).join('\n')

    const prompt = `Analyze the following potential compliance issues found in document content:

${issuesSummary}

Context (relevant excerpt):
${input.context.substring(0, 1500)}

Provide a brief compliance assessment:
1. Summarize the key concerns
2. Rate overall compliance risk (Low/Medium/High)
3. Suggest specific improvements`

    const messages = [
      { role: 'system' as const, content: 'You are a compliance analyst. Provide concise, actionable assessments.' },
      { role: 'user' as const, content: prompt }
    ]

    return await this.config.aiClient.generateText(messages)
  }

  private formatIssues(issues: Array<{ type: string; text: string; severity: string }>): string {
    const grouped = new Map<string, typeof issues>()
    
    for (const issue of issues) {
      const existing = grouped.get(issue.type) || []
      existing.push(issue)
      grouped.set(issue.type, existing)
    }

    let output = '## Compliance Check Results\n\n'
    
    for (const [type, typeIssues] of grouped) {
      const severityEmoji = typeIssues[0].severity === 'high' ? '🔴' : typeIssues[0].severity === 'medium' ? '🟡' : '🟢'
      output += `### ${severityEmoji} ${type} (${typeIssues.length} found)\n`
      output += typeIssues.slice(0, 3).map(i => `- ${i.text}`).join('\n')
      output += '\n\n'
    }

    return output
  }
}

/**
 * Key Terms Extractor Agent
 * Extracts and defines key terms from document content
 */
export class KeyTermsAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super('key-terms', config)
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now()

    try {
      const terms = this.extractKeyTerms(input.context)
      
      if (terms.length === 0) {
        return this.createOutput(
          'No significant key terms identified.',
          0.5,
          { terms: [] },
          startTime
        )
      }

      // Generate definitions with AI if available
      if (this.config.aiClient && terms.length > 0) {
        const definitions = await this.defineTermsWithAI(input, terms)
        return this.createOutput(
          definitions,
          0.8,
          { terms, method: 'ai-defined' },
          startTime
        )
      }

      // Format terms without definitions
      const formatted = terms.map(t => `**${t.term}** (${t.frequency}x)`).join('\n')
      return this.createOutput(
        `## Key Terms\n\n${formatted}`,
        0.6,
        { terms, method: 'extraction-only' },
        startTime
      )
    } catch (error) {
      console.error('KeyTermsAgent error:', error)
      return this.createOutput(
        'Unable to extract key terms from this content.',
        0.3,
        undefined,
        startTime
      )
    }
  }

  private extractKeyTerms(context: string): Array<{ term: string; frequency: number }> {
    const words = context.toLowerCase().match(/\b[a-z]{4,}\b/g) || []
    const stopWords = new Set([
      'that', 'this', 'with', 'from', 'have', 'been', 'were', 'will', 'would',
      'could', 'should', 'their', 'there', 'which', 'about', 'these', 'those',
      'when', 'where', 'what', 'they', 'them', 'than', 'then', 'some', 'such',
      'more', 'most', 'other', 'into', 'only', 'over', 'also', 'just', 'very',
    ])

    const frequency = new Map<string, number>()
    for (const word of words) {
      if (!stopWords.has(word)) {
        frequency.set(word, (frequency.get(word) || 0) + 1)
      }
    }

    return Array.from(frequency.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term, freq]) => ({ term, frequency: freq }))
  }

  private async defineTermsWithAI(
    input: AgentInput, 
    terms: Array<{ term: string; frequency: number }>
  ): Promise<string> {
    const termsList = terms.map(t => t.term).join(', ')
    
    const prompt = `Based on the following document context:

${input.context.substring(0, 2000)}

Define these key terms as they relate to this document: ${termsList}

Format each as:
**Term**: Brief definition in context`

    const messages = [
      { role: 'system' as const, content: 'You are a technical writer. Provide concise, context-specific definitions.' },
      { role: 'user' as const, content: prompt }
    ]

    return await this.config.aiClient.generateText(messages)
  }
}

/**
 * Summary Agent - Uses local summarizer for quick summaries
 */
export class SummaryAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super('summary', config)
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now()

    try {
      // Use local summarizer if enabled
      if (this.config.useLocalModels) {
        const summarizer = getLocalSummarizer()
        const result = await summarizer.summarize(input.context, {
          maxLength: 200,
          style: 'brief',
        })
        
        return this.createOutput(
          result.text,
          result.confidence,
          { model: result.model, localModel: true },
          startTime
        )
      }

      // Use AI client for summarization
      if (this.config.aiClient) {
        const summary = await this.summarizeWithAI(input)
        return this.createOutput(
          summary,
          0.8,
          { method: 'ai-summary' },
          startTime
        )
      }

      // Fallback to extractive summary
      const extractive = this.extractiveSummary(input.context)
      return this.createOutput(
        extractive,
        0.5,
        { method: 'extractive' },
        startTime
      )
    } catch (error) {
      console.error('SummaryAgent error:', error)
      return this.createOutput(
        input.context.substring(0, 300) + '...',
        0.3,
        undefined,
        startTime
      )
    }
  }

  private async summarizeWithAI(input: AgentInput): Promise<string> {
    const prompt = `Summarize the following content in 2-3 sentences, focusing on the key points relevant to the question "${input.question}":

${input.context.substring(0, 3000)}`

    const messages = [
      { role: 'system' as const, content: 'You are an expert summarizer. Be concise and informative.' },
      { role: 'user' as const, content: prompt }
    ]

    return await this.config.aiClient.generateText(messages)
  }

  private extractiveSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
    return sentences.slice(0, 3).map(s => s.trim()).join('. ') + '.'
  }
}

/**
 * Agent Manager - Coordinates multiple agents
 */
export class AgentManager {
  private agents: Map<AgentType, BaseAgent> = new Map()
  private config: AgentConfig

  constructor(config: AgentConfig) {
    this.config = config
    this.initializeAgents()
  }

  private initializeAgents(): void {
    this.agents.set('analogy-maker', new AnalogyMakerAgent(this.config))
    this.agents.set('compliance-checker', new ComplianceCheckerAgent(this.config))
    this.agents.set('key-terms', new KeyTermsAgent(this.config))
    this.agents.set('summary', new SummaryAgent(this.config))
  }

  /**
   * Run a specific agent
   */
  async runAgent(agentType: AgentType, input: AgentInput): Promise<AgentOutput> {
    const agent = this.agents.get(agentType)
    if (!agent) {
      throw new Error(`Unknown agent type: ${agentType}`)
    }
    return agent.process(input)
  }

  /**
   * Run multiple agents in parallel
   */
  async runAgents(agentTypes: AgentType[], input: AgentInput): Promise<Map<AgentType, AgentOutput>> {
    const results = new Map<AgentType, AgentOutput>()
    
    const promises = agentTypes.map(async (type) => {
      const output = await this.runAgent(type, input)
      results.set(type, output)
    })

    await Promise.all(promises)
    return results
  }

  /**
   * Get available agent types
   */
  getAvailableAgents(): AgentType[] {
    return Array.from(this.agents.keys())
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config }
    this.initializeAgents()
  }
}

// Singleton instance
let globalAgentManager: AgentManager | null = null

export function getAgentManager(config?: AgentConfig): AgentManager {
  if (!globalAgentManager || config) {
    globalAgentManager = new AgentManager(config ?? { enabled: true, useLocalModels: true })
  }
  return globalAgentManager
}

