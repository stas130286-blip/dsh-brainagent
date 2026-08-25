/**
 * Vector Engine — Brain-native similarity search.
 *
 * The human brain doesn't use keyword matching to recall memories.
 * When you smell freshly baked bread, you don't search for the word "bread" —
 * instead, a pattern of neural activations fires, and memories with
 * similar activation patterns light up. That's associative recall.
 *
 * This module implements a lightweight vector search engine:
 * - TF-IDF vectorization (no external dependencies)
 * - Cosine similarity for finding related memories
 * - Inverted index for fast retrieval
 * - N-gram support for fuzzy matching (the brain doesn't need exact words)
 *
 * The result: when someone mentions "рыбалка на спиннинг", the engine
 * finds memories about "ловля щуки" and "блёсны" — because their
 * activation patterns overlap, even without identical words.
 */

// ── Types ───────────────────────────────────────────────────────────

export type VectorDocument = {
  id: string;
  text: string;
  /** Precomputed TF-IDF vector (sparse representation) */
  vector: Map<string, number>;
  /** L2 norm of the vector (for fast cosine computation) */
  norm: number;
};

export type SearchResult = {
  id: string;
  score: number;
};

// ── Stopwords (Russian + English) ───────────────────────────────────

const STOPWORDS = new Set([
  // Russian
  "и",
  "в",
  "на",
  "не",
  "что",
  "он",
  "она",
  "они",
  "это",
  "с",
  "по",
  "но",
  "как",
  "из",
  "за",
  "к",
  "у",
  "от",
  "до",
  "для",
  "все",
  "его",
  "её",
  "их",
  "так",
  "то",
  "же",
  "бы",
  "мы",
  "вы",
  "ещё",
  "уже",
  "или",
  "ни",
  "да",
  "нет",
  "был",
  "была",
  "были",
  "быть",
  "есть",
  "если",
  "при",
  "чем",
  "где",
  "когда",
  "кто",
  "вот",
  "тоже",
  "себя",
  "свой",
  "только",
  "будет",
  "было",
  "очень",
  "можно",
  "нужно",
  "надо",
  "этот",
  "тот",
  "такой",
  "какой",
  "который",
  // English
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "need",
  "dare",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "about",
  "like",
  "through",
  "after",
  "over",
  "between",
  "out",
  "against",
  "during",
  "without",
  "before",
  "under",
  "around",
  "among",
  "it",
  "he",
  "she",
  "they",
  "we",
  "you",
  "i",
  "me",
  "him",
  "her",
  "us",
  "them",
  "my",
  "your",
  "his",
  "its",
  "our",
  "their",
  "this",
  "that",
  "these",
  "those",
  "and",
  "but",
  "or",
  "nor",
  "not",
  "so",
  "very",
  "just",
  "also",
  "than",
  "then",
  "now",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "only",
  "same",
  "if",
  "what",
  "which",
  "who",
]);

// ── Tokenization and stemming ───────────────────────────────────────

/**
 * Simple stemmer: strip common suffixes for Russian and English.
 * Not linguistically perfect, but good enough for similarity —
 * the brain doesn't need perfect morphology either.
 */
function stem(word: string): string {
  const w = word.toLowerCase();

  // Russian suffixes (rough, covers most cases)
  const ruSuffixes = [
    "ться",
    "тся",
    "ение",
    "ания",
    "ость",
    "ного",
    "ной",
    "ных",
    "ать",
    "ять",
    "ить",
    "еть",
    "ова",
    "ева",
    "ами",
    "ями",
    "ого",
    "ому",
    "ыми",
    "ими",
    "ний",
    "ние",
    "ции",
    "ем",
    "ей",
    "ов",
    "ие",
    "ые",
    "ий",
    "ый",
    "ой",
    "ая",
    "яя",
    "ую",
    "юю",
    "ах",
    "ях",
    "ом",
    "ам",
    "ть",
    "ет",
    "ит",
    "ут",
    "ют",
    "ал",
    "ил",
    "ел",
  ];
  for (const suffix of ruSuffixes) {
    if (w.length > suffix.length + 3 && w.endsWith(suffix)) {
      return w.slice(0, -suffix.length);
    }
  }

  // English suffixes
  const enSuffixes = [
    "ization",
    "ation",
    "ness",
    "ment",
    "able",
    "ible",
    "ting",
    "ing",
    "ous",
    "ive",
    "ful",
    "less",
    "ent",
    "ion",
    "ity",
    "ism",
    "ist",
    "ize",
    "ise",
    "ate",
    "ed",
    "er",
    "ly",
    "es",
    "en",
    "al",
  ];
  for (const suffix of enSuffixes) {
    if (w.length > suffix.length + 3 && w.endsWith(suffix)) {
      return w.slice(0, -suffix.length);
    }
  }

  return w;
}

/**
 * Tokenize text into meaningful terms.
 * Returns stemmed tokens with stopwords removed.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // Keep letters, numbers, whitespace
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

/**
 * Generate character n-grams for fuzzy matching.
 * "щука" → ["щу", "ук", "ка", "щук", "ука"]
 */
function ngrams(text: string, minN = 2, maxN = 3): string[] {
  const result: string[] = [];
  const clean = text.toLowerCase().replace(/\s+/g, " ").trim();
  for (const word of clean.split(" ")) {
    if (word.length < minN) continue;
    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= word.length - n; i++) {
        result.push(word.slice(i, i + n));
      }
    }
  }
  return result;
}

// ── TF-IDF computation ──────────────────────────────────────────────

/**
 * Compute term frequency for a document.
 * TF(t,d) = count(t in d) / total terms in d
 */
function computeTf(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const tf = new Map<string, number>();
  for (const [term, count] of counts) {
    tf.set(term, count / tokens.length);
  }
  return tf;
}

/**
 * Compute L2 norm of a sparse vector.
 */
function computeNorm(vector: Map<string, number>): number {
  let sum = 0;
  for (const val of vector.values()) {
    sum += val * val;
  }
  return Math.sqrt(sum);
}

/**
 * Cosine similarity between two sparse vectors.
 * Returns 0-1 (1 = identical direction).
 */
function cosineSimilarity(
  a: Map<string, number>,
  aNorm: number,
  b: Map<string, number>,
  bNorm: number,
): number {
  if (aNorm === 0 || bNorm === 0) return 0;

  let dotProduct = 0;
  // Iterate over the smaller map for efficiency
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const [term, aVal] of smaller) {
    const bVal = larger.get(term);
    if (bVal !== undefined) {
      dotProduct += aVal * bVal;
    }
  }

  return dotProduct / (aNorm * bNorm);
}

// ── Vector Index ────────────────────────────────────────────────────

export class VectorIndex {
  private documents = new Map<string, VectorDocument>();
  /** Inverted index: term → set of document IDs */
  private invertedIndex = new Map<string, Set<string>>();
  /** Document frequency: term → how many documents contain it */
  private docFrequency = new Map<string, number>();
  private totalDocs = 0;

  /**
   * Add a document to the index.
   * Computes TF-IDF vector and updates inverted index.
   */
  add(id: string, text: string): void {
    // Remove old version if updating
    if (this.documents.has(id)) {
      this.remove(id);
    }

    const tokens = [...tokenize(text), ...ngrams(text)];
    const tf = computeTf(tokens);

    // Update document frequency
    for (const term of tf.keys()) {
      this.docFrequency.set(term, (this.docFrequency.get(term) ?? 0) + 1);
      let postings = this.invertedIndex.get(term);
      if (!postings) {
        postings = new Set();
        this.invertedIndex.set(term, postings);
      }
      postings.add(id);
    }

    this.totalDocs++;

    // Compute TF-IDF vector (IDF will be recalculated on search)
    const vector = tf; // Store TF for now; IDF applied at search time
    const norm = computeNorm(vector);

    this.documents.set(id, { id, text, vector, norm });
  }

  /**
   * Remove a document from the index.
   */
  remove(id: string): boolean {
    const doc = this.documents.get(id);
    if (!doc) return false;

    for (const term of doc.vector.keys()) {
      const df = this.docFrequency.get(term);
      if (df !== undefined) {
        if (df <= 1) {
          this.docFrequency.delete(term);
          this.invertedIndex.delete(term);
        } else {
          this.docFrequency.set(term, df - 1);
          this.invertedIndex.get(term)?.delete(id);
        }
      }
    }

    this.documents.delete(id);
    this.totalDocs--;
    return true;
  }

  /**
   * Search for similar documents.
   * Returns top-k results sorted by cosine similarity.
   */
  search(query: string, topK = 5, minScore = 0.05): SearchResult[] {
    if (this.totalDocs === 0) return [];

    const queryTokens = [...tokenize(query), ...ngrams(query)];
    const queryTf = computeTf(queryTokens);

    // Apply IDF to query vector
    const queryTfIdf = new Map<string, number>();
    for (const [term, tf] of queryTf) {
      const df = this.docFrequency.get(term) ?? 0;
      if (df === 0) continue;
      const idf = Math.log(1 + this.totalDocs / df);
      queryTfIdf.set(term, tf * idf);
    }
    const queryNorm = computeNorm(queryTfIdf);

    if (queryNorm === 0) return [];

    // Find candidate documents (those that share at least one term)
    const candidates = new Set<string>();
    for (const term of queryTfIdf.keys()) {
      const postings = this.invertedIndex.get(term);
      if (postings) {
        for (const docId of postings) {
          candidates.add(docId);
        }
      }
    }

    // Score each candidate
    const results: SearchResult[] = [];
    for (const docId of candidates) {
      const doc = this.documents.get(docId);
      if (!doc) continue;

      // Apply IDF to document vector
      const docTfIdf = new Map<string, number>();
      for (const [term, tf] of doc.vector) {
        const df = this.docFrequency.get(term) ?? 1;
        const idf = Math.log(1 + this.totalDocs / df);
        docTfIdf.set(term, tf * idf);
      }
      const docNorm = computeNorm(docTfIdf);

      const score = cosineSimilarity(queryTfIdf, queryNorm, docTfIdf, docNorm);
      if (score >= minScore) {
        results.push({ id: docId, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Get the number of indexed documents.
   */
  get size(): number {
    return this.totalDocs;
  }

  /**
   * Get the vocabulary size (unique terms).
   */
  get vocabularySize(): number {
    return this.docFrequency.size;
  }
}
