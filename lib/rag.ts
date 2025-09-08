import fs from 'fs';
import OpenAI from 'openai';

// Load selectors DB
const selectors = JSON.parse(fs.readFileSync('selectors_rag.json', 'utf8'));

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Get embedding for a given text
async function getEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return res.data[0].embedding;
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}

// Main: find best matching selector
async function findBestMatch(description: string) {
  const queryEmbedding = await getEmbedding(description);

  const scored = await Promise.all(selectors.map(async (item) => {
    const itemEmbedding = await getEmbedding(item.description);
    const score = cosineSimilarity(queryEmbedding, itemEmbedding);
    return { ...item, score };
  }));

  scored.sort((a, b) => b.score - a.score);

  console.log('האלמנט שהכי מתאים לתיאור:');
  console.log(scored[0]);
}

// דוגמה לשימוש
findBestMatch("כפתור ההתחברות של המשתמש");