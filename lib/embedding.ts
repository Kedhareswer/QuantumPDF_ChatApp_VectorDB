import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'embedding-001' });
    
    const result = await model.embedContent(text);
    const values = result.embedding.values as number[];

    // Normalize the embedding
    const magnitude = Math.sqrt(values.reduce((sum, val) => sum + val * val, 0));
    return values.map(val => val / magnitude)
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
  }
}
