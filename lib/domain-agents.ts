'use client';

/**
 * Domain Agents - Specialized post-retrieval processing chains
 * These agents run after core RAG retrieval to provide domain-specific analysis
 */

import { getLocalSummarizer } from './local-summarizer';

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
  metadata?: Record<string, unknown>
}

export interface AgentOutput {
  agentType: AgentType
  result: string
  confidence: number
  details?: Record<string, unknown>
  processingTime: number
}

export interface AgentConfig {
  enabled: boolean
  aiClient?: unknown // AIClient instance for LLM-powered agents
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

  protected createOutput(result: string, confidence: number, details?: Record<string, unknown>, startTime?: number): AgentOutput {
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
 * Explainer Agent
 * Provides detailed, step-by-step explanations of processes, mechanisms, or concepts
 */
export class ExplainerAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super('explainer', config)
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now()

    try {
      // Extract process steps or mechanisms from context
      const processes = this.extractProcesses(input.context)
      
      if (processes.length === 0) {
        return this.createOutput(
          'No clear processes or mechanisms found to explain.',
          0.5,
          { processes: [] },
          startTime
        )
      }

      // Generate detailed explanation with AI if available
      if (this.config.aiClient) {
        const explanation = await this.explainWithAI(input, processes)
        return this.createOutput(
          explanation,
          0.85,
          { processes, method: 'ai-explanation' },
          startTime
        )
      }

      // Fallback to structured template explanation
      const templateExplanation = this.generateTemplateExplanation(processes, input.question)
      return this.createOutput(
        templateExplanation,
        0.65,
        { processes, method: 'template' },
        startTime
      )
    } catch (error) {
      console.error('ExplainerAgent error:', error)
      return this.createOutput(
        'Unable to generate explanation for this content.',
        0.3,
        { error: error instanceof Error ? error.message : 'Unknown error' },
        startTime
      )
    }
  }

  private extractProcesses(context: string): Array<{ step: string; order: number }> {
    const processes: Array<{ step: string; order: number }> = []
    
    // Look for numbered steps, ordered lists, or sequential patterns
    const patterns = [
      /(?:^|\n)\s*(\d+)[\.\)]\s*([^\n]+)/g, // Numbered steps: "1. Step one"
      /(?:^|\n)\s*[-•]\s*([^\n]+)/g, // Bullet points
      /(?:first|second|third|then|next|finally|step \d+)[:\s]+([^\n\.]+)/gi, // Sequential keywords
      /(?:process|procedure|method|mechanism)[:\s]+([^\n\.]{20,200})/gi, // Process descriptions
    ]

    let order = 1
    for (const pattern of patterns) {
      const matches = context.matchAll(pattern)
      for (const match of matches) {
        const step = (match[1] || match[0]).trim()
        if (step.length > 10 && step.length < 300 && !processes.some(p => p.step.includes(step.substring(0, 50)))) {
          processes.push({ step, order: order++ })
          if (processes.length >= 10) break // Limit to 10 steps
        }
      }
      if (processes.length >= 10) break
    }

    return processes.slice(0, 10)
  }

  private async explainWithAI(input: AgentInput, processes: Array<{ step: string; order: number }>): Promise<string> {
    const processSummary = processes.length > 0
      ? processes.map(p => `${p.order}. ${p.step}`).join('\n')
      : 'No explicit ordered steps were extracted; infer a coherent sequence from context.'
    const prompt = `Based on the following context about "${input.question}":

${input.context.substring(0, 2500)}

Detected process steps:
${processSummary}

Provide a clear, step-by-step explanation that:
1. Breaks down the process or concept into logical steps
2. Explains each step in simple terms
3. Shows how steps connect to each other
4. Uses examples from the context when possible

Format as:
## Overview
[Brief overview]

## Step-by-Step Explanation
[Numbered steps with clear explanations]

## Key Takeaways
[Summary of main points]`

    const messages = [
      { role: 'system' as const, content: 'You are an expert educator. Explain complex topics clearly and step-by-step.' },
      { role: 'user' as const, content: prompt }
    ]

    return await this.config.aiClient.generateText(messages)
  }

  private generateTemplateExplanation(processes: Array<{ step: string; order: number }>, question: string): string {
    let explanation = `## Explanation: ${question}\n\n`
    
    if (processes.length > 0) {
      explanation += '### Step-by-Step Process:\n\n'
      processes.forEach(p => {
        explanation += `${p.order}. ${p.step}\n\n`
      })
    } else {
      explanation += 'The content describes a process or mechanism. Review the context for detailed steps.\n\n'
    }

    explanation += '### Summary\n'
    explanation += 'This explanation breaks down the concept into clear, sequential steps for better understanding.'

    return explanation
  }
}

/**
 * Fact Checker Agent
 * Verifies factual claims, statistics, and specific information against retrieved context
 */
export class FactCheckerAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super('fact-checker', config)
  }

  async process(input: AgentInput): Promise<AgentOutput> {
    const startTime = Date.now()

    try {
      // Extract claims and facts from the question
      const claims = this.extractClaims(input.question)
      
      if (claims.length === 0) {
        return this.createOutput(
          'No specific factual claims detected to verify.',
          0.5,
          { claims: [] },
          startTime
        )
      }

      // Verify claims against context
      const verifications = this.verifyClaims(claims, input.context)
      
      // Generate detailed fact-check report with AI if available
      if (this.config.aiClient && verifications.some(v => v.status !== 'unclear')) {
        const report = await this.generateFactCheckReport(input, verifications)
        return this.createOutput(
          report,
          0.8,
          { verifications, method: 'ai-verification' },
          startTime
        )
      }

      // Format verification results
      const formattedReport = this.formatVerifications(verifications)
      return this.createOutput(
        formattedReport,
        0.7,
        { verifications, method: 'pattern-verification' },
        startTime
      )
    } catch (error) {
      console.error('FactCheckerAgent error:', error)
      return this.createOutput(
        'Unable to perform fact-checking on this content.',
        0.3,
        { error: error instanceof Error ? error.message : 'Unknown error' },
        startTime
      )
    }
  }

  private extractClaims(question: string): Array<{ claim: string; type: 'statistic' | 'fact' | 'statement' }> {
    const claims: Array<{ claim: string; type: 'statistic' | 'fact' | 'statement' }> = []
    
    // Extract statistics (numbers with % or units)
    const statPattern = /\b(\d+(?:\.\d+)?)\s*(%|percent|years?|dollars?|USD|EUR|GBP|times|x)\b/gi
    const statMatches = question.matchAll(statPattern)
    for (const match of statMatches) {
      claims.push({ claim: match[0], type: 'statistic' })
    }

    // Extract factual statements (claims with "is", "are", "was", etc.)
    const factPattern = /\b([A-Z][^.!?]*(?:is|are|was|were|has|have|does|did|can|cannot|will|won't)[^.!?]{10,150})/g
    const factMatches = question.matchAll(factPattern)
    for (const match of factMatches) {
      if (match[0].length > 15 && match[0].length < 200) {
        claims.push({ claim: match[0].trim(), type: 'fact' })
      }
    }

    // Extract quoted claims
    const quotedPattern = /"([^"]{20,200})"/g
    const quotedMatches = question.matchAll(quotedPattern)
    for (const match of quotedMatches) {
      claims.push({ claim: match[1], type: 'statement' })
    }

    return claims.slice(0, 5) // Limit to 5 claims
  }

  private verifyClaims(
    claims: Array<{ claim: string; type: 'statistic' | 'fact' | 'statement' }>,
    context: string
  ): Array<{ claim: string; status: 'verified' | 'contradicted' | 'unclear'; evidence?: string }> {
    const verifications: Array<{ claim: string; status: 'verified' | 'contradicted' | 'unclear'; evidence?: string }> = []
    const lowerContext = context.toLowerCase()

    for (const claim of claims) {
      const lowerClaim = claim.claim.toLowerCase()
      const claimWords = lowerClaim.split(/\s+/).filter(w => w.length > 3)
      
      // Check if claim appears in context (exact or similar)
      const exactMatch = lowerContext.includes(lowerClaim.substring(0, Math.min(50, lowerClaim.length)))
      
      // Check for key terms from claim in context
      const matchingWords = claimWords.filter(w => lowerContext.includes(w))
      const matchRatio = matchingWords.length / Math.max(1, claimWords.length)
      
      // Extract surrounding context as evidence
      let evidence: string | undefined
      if (exactMatch || matchRatio > 0.5) {
        const claimIndex = lowerContext.indexOf(lowerClaim.substring(0, 30))
        if (claimIndex >= 0) {
          const start = Math.max(0, claimIndex - 100)
          const end = Math.min(context.length, claimIndex + lowerClaim.length + 100)
          evidence = '...' + context.substring(start, end) + '...'
        }
      }

      let status: 'verified' | 'contradicted' | 'unclear'
      if (exactMatch || matchRatio > 0.7) {
        status = 'verified'
      } else if (matchRatio < 0.3) {
        status = 'unclear'
      } else {
        // Check for contradiction keywords
        const contradictionPattern = /\b(not|never|no|false|incorrect|wrong|disproven|refuted)\b/i
        const hasContradiction = evidence && contradictionPattern.test(evidence)
        status = hasContradiction ? 'contradicted' : 'unclear'
      }

      verifications.push({ claim: claim.claim, status, evidence })
    }

    return verifications
  }

  private async generateFactCheckReport(
    input: AgentInput,
    verifications: Array<{ claim: string; status: 'verified' | 'contradicted' | 'unclear'; evidence?: string }>
  ): Promise<string> {
    const verificationsText = verifications.map((v, i) => 
      `${i + 1}. Claim: "${v.claim}"\n   Status: ${v.status}\n   ${v.evidence ? `Evidence: ${v.evidence.substring(0, 150)}...` : 'No evidence found'}`
    ).join('\n\n')

    const prompt = `Fact-check the following claims against the provided context:

Claims to verify:
${verificationsText}

Context:
${input.context.substring(0, 2000)}

Provide a fact-check report that:
1. States whether each claim is Verified, Contradicted, or Unclear
2. Cites specific evidence from the context
3. Explains any discrepancies
4. Provides an overall confidence assessment

Format as:
## Fact-Check Report

### Claim 1: [Claim]
**Status:** [Verified/Contradicted/Unclear]
**Evidence:** [Quote from context]
**Explanation:** [Brief explanation]

[Repeat for each claim]

### Overall Assessment
[Summary of findings]`

    const messages = [
      { role: 'system' as const, content: 'You are a fact-checker. Verify claims against provided evidence. Be precise and cite sources.' },
      { role: 'user' as const, content: prompt }
    ]

    return await this.config.aiClient.generateText(messages)
  }

  private formatVerifications(
    verifications: Array<{ claim: string; status: 'verified' | 'contradicted' | 'unclear'; evidence?: string }>
  ): string {
    let report = '## Fact-Check Report\n\n'
    
    verifications.forEach((v, i) => {
      const emoji = v.status === 'verified' ? '✅' : v.status === 'contradicted' ? '❌' : '⚠️'
      report += `### ${emoji} Claim ${i + 1}: ${v.claim.substring(0, 100)}${v.claim.length > 100 ? '...' : ''}\n`
      report += `**Status:** ${v.status.toUpperCase()}\n`
      if (v.evidence) {
        report += `**Evidence:** ${v.evidence.substring(0, 200)}${v.evidence.length > 200 ? '...' : ''}\n`
      } else {
        report += `**Evidence:** Not found in context\n`
      }
      report += '\n'
    })

    const verifiedCount = verifications.filter(v => v.status === 'verified').length
    const contradictedCount = verifications.filter(v => v.status === 'contradicted').length
    const unclearCount = verifications.filter(v => v.status === 'unclear').length

    report += `### Summary\n`
    report += `- ✅ Verified: ${verifiedCount}\n`
    report += `- ❌ Contradicted: ${contradictedCount}\n`
    report += `- ⚠️ Unclear: ${unclearCount}\n`

    return report
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
    this.agents.set('explainer', new ExplainerAgent(this.config))
    this.agents.set('fact-checker', new FactCheckerAgent(this.config))
  }

  /**
   * Automatically select relevant agents based on query intent
   */
  selectAgentsForQuery(question: string, context: string): AgentType[] {
    const selected: AgentType[] = []

    // Analogy Maker: Questions asking for explanations, comparisons, or "like what"
    if (
      /\b(explain|what is|how does|like what|similar to|compare|analogy|example)\b/i.test(question) ||
      /\b(complex|complicated|difficult|hard to understand)\b/i.test(question)
    ) {
      selected.push('analogy-maker')
    }

    // Compliance Checker: Legal, policy, or compliance-related terms
    if (
      /\b(compliance|legal|law|regulation|policy|contract|liability|warranty|indemnif|jurisdiction|governing)\b/i.test(question) ||
      /\b(compliance|legal|law|regulation|policy|contract|liability)\b/i.test(context)
    ) {
      selected.push('compliance-checker')
    }

    // Key Terms: Questions about definitions, terminology, or "what does X mean"
    if (
      /\b(define|definition|term|terminology|vocabulary|what does|what is|meaning of|means)\b/i.test(question) ||
      context.split(/\s+/).length > 500 // Long documents likely have key terms
    ) {
      selected.push('key-terms')
    }

    // Summary: Questions asking for overview, summary, or "tell me about"
    if (
      /\b(summarize|summary|overview|brief|tell me about|what's this about|main points|key points)\b/i.test(question) ||
      context.split(/\s+/).length > 1000 // Very long documents
    ) {
      selected.push('summary')
    }

    // Explainer: Questions asking "how" or "why" or requesting detailed explanations
    if (
      /\b(how|why|explain in detail|walk me through|step by step|process|mechanism|work|function)\b/i.test(question)
    ) {
      selected.push('explainer')
    }

    // Fact Checker: Questions with specific claims, numbers, or "is it true"
    if (
      /\b(is it true|fact|verify|check|confirm|accurate|correct|true or false|claim)\b/i.test(question) ||
      /\b(\d+%|\d+ years|\d+ dollars|statistic|data point|figure)\b/i.test(question)
    ) {
      selected.push('fact-checker')
    }

    // Remove duplicates and return
    return Array.from(new Set(selected))
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

