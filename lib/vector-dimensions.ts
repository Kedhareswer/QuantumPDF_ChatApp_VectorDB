/**
 * Centralized vector dimension configuration
 * 
 * This file ensures consistent embedding dimensions across all components
 * to prevent dimension mismatch errors in vector operations.
 */

/**
 * Default embedding dimension used across the application.
 * 
 * This should match the dimension of your primary embedding model:
 * - OpenAI text-embedding-3-small: 1536
 * - OpenAI text-embedding-3-large: 3072
 * - OpenAI text-embedding-ada-002: 1536
 * - HuggingFace all-MiniLM-L6-v2: 384
 * - Other models: Check model documentation
 * 
 * Default: 1536 (OpenAI text-embedding-3-small/ada-002)
 */
export const DEFAULT_EMBEDDING_DIMENSION = 1536

/**
 * Get the embedding dimension from config or use default
 * @param configDimension - Dimension from configuration (optional)
 * @returns The embedding dimension to use
 */
export function getEmbeddingDimension(configDimension?: number): number {
  return configDimension || DEFAULT_EMBEDDING_DIMENSION
}

/**
 * Create a zero vector of the specified dimension
 * @param dimension - Dimension of the vector (optional, uses default if not provided)
 * @returns Zero vector array
 */
export function createZeroVector(dimension?: number): number[] {
  return new Array(getEmbeddingDimension(dimension)).fill(0)
}

/**
 * Validate that two embeddings have matching dimensions
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @param expectedDimension - Expected dimension (optional)
 * @throws Error if dimensions don't match
 */
export function validateEmbeddingDimensions(
  embedding1: number[],
  embedding2: number[],
  expectedDimension?: number
): void {
  const expected = expectedDimension || DEFAULT_EMBEDDING_DIMENSION
  
  if (embedding1.length !== embedding2.length) {
    throw new Error(
      `Embedding dimension mismatch: ${embedding1.length} vs ${embedding2.length}. Expected: ${expected}`
    )
  }
  
  if (embedding1.length !== expected) {
    throw new Error(
      `Embedding dimension mismatch: got ${embedding1.length}, expected ${expected}`
    )
  }
}

