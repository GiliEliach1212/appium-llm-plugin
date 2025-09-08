import { SELECTORS } from './selectors';
import OpenAI from 'openai';

// Optionally: import Fuse from 'fuse.js' for better fuzzy search

/**
 * Utility for working with selector embeddings and retrieval.
 */
export class SelectorRag {
  private selectorEmbeddings: Array<{ key: string, description: string, locator: string, embedding: number[] }> = [];
  private openai: OpenAI;

  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  /**
   * Compute and cache embeddings for all selectors. Call once at startup.
   */
  async computeSelectorEmbeddings() {
    const selectorsArr = flattenSelectors(SELECTORS);
    this.selectorEmbeddings = [];
    for (const sel of selectorsArr) {
      const embedding = await SelectorRag.getEmbedding(this.openai, sel.description);
      this.selectorEmbeddings.push({ ...sel, embedding });
    }
  }

  /**
   * Find the best selector by embedding similarity.
   * @param userDesc User's description
   * @param minSim Minimum cosine similarity threshold
   */
  async findBestSelectorByEmbedding(userDesc: string, minSim = 0.80): Promise<{ key: string, description: string, locator: string } | null> {
    if (!this.selectorEmbeddings.length) {
      throw new Error('Selector embeddings not computed. Call computeSelectorEmbeddings() first.');
    }
    const userEmbedding = await SelectorRag.getEmbedding(this.openai, userDesc);
    let best = null, bestSim = -1;
    for (const sel of this.selectorEmbeddings) {
      const sim = SelectorRag.cosineSimilarity(userEmbedding, sel.embedding);
      if (sim > bestSim) {
        best = sel;
        bestSim = sim;
      }
    }
    return bestSim >= minSim ? best : null;
  }

  /**
   * Get embedding for a string using OpenAI
   */
  static async getEmbedding(openai: OpenAI, text: string): Promise<number[]> {
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return res.data[0].embedding;
  }

  /**
   * Compute cosine similarity between two vectors
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Simple fuzzy match (fallback, not using embeddings)
   */
  static findBestSelector(userDesc: string, selectorsArr: Array<{ key: string, description: string, locator: string }>, minScore = 2): { key: string, description: string, locator: string } | null {
    userDesc = userDesc.toLowerCase();
    let best: any = null, bestScore = 0;
    for (const sel of selectorsArr) {
      const score = sel.description.split(' ').filter(w => userDesc.includes(w)).length;
      if (score > bestScore) {
        best = sel;
        bestScore = score;
      }
    }
    return bestScore >= minScore ? best : null;
  }
}

/**
 * Flatten selectors to array of {key, description, locator}
 */
export function flattenSelectors(selectorsObj: any): Array<{ key: string, description: string, locator: string }> {
  const result: Array<{ key: string, description: string, locator: string }> = [];
  function recurse(obj: any, path: string[] = []) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const description = [...path, key].join(' ').replace(/_/g, ' ').toLowerCase();
        result.push({ key: [...path, key].join('.'), description, locator: value });
      } else if (typeof value === 'object') {
        recurse(value, [...path, key]);
      }
    }
  }
  recurse(selectorsObj);
  return result;
}

// Example usage:
// const rag = new SelectorRag(process.env.OPENAI_API_KEY!);
// await rag.computeSelectorEmbeddings();
// const match = await rag.findBestSelectorByEmbedding('login button');
// if (match) { /* use match.locator */ }
