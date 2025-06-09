import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Creates an embedding vector for the given text using OpenAI's embeddings API
 * 
 * @param text Text to create an embedding for
 * @returns Array of numbers representing the embedding vector
 */
export async function createEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw new Error('Failed to create embedding');
  }
}

/**
 * Creates embeddings for multiple texts in a single batch request
 * 
 * @param texts Array of texts to create embeddings for
 * @returns Array of embedding vectors
 */
export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: texts,
    });

    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error creating embeddings batch:', error);
    throw new Error('Failed to create embeddings batch');
  }
} 