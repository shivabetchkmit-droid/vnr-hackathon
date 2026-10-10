export interface TextChunk {
  id: number;
  documentName: string;
  text: string;
  startIndex: number;
  score?: number;
}

export class RagService {
  private static stopWords = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
    'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
    'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
    'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
    'each', 'few', 'for', 'from', 'further',
    'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here',
    'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
    'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
    'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
    'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out',
    'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
    'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these',
    'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too',
    'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t',
    'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why',
    'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours',
    'yourself', 'yourselves'
  ]);

  /**
   * Split document text into chunks with overlap
   */
  public static chunkText(
    documentName: string,
    text: string,
    chunkSize: number = 800,
    overlap: number = 150
  ): TextChunk[] {
    const chunks: TextChunk[] = [];
    if (!text || !text.trim()) return chunks;

    const cleanText = text.replace(/\r\n/g, '\n');
    let start = 0;
    let chunkId = 0;

    while (start < cleanText.length) {
      let end = start + chunkSize;
      if (end >= cleanText.length) {
        end = cleanText.length;
      } else {
        // Try to break at a newline or sentence end if nearby
        const nextBreak = cleanText.lastIndexOf('\n', end);
        if (nextBreak > start + chunkSize / 2) {
          end = nextBreak + 1;
        } else {
          const nextPeriod = cleanText.lastIndexOf('. ', end);
          if (nextPeriod > start + chunkSize / 2) {
            end = nextPeriod + 2;
          }
        }
      }

      const chunkContent = cleanText.substring(start, end).trim();
      if (chunkContent.length > 20) {
        chunks.push({
          id: chunkId++,
          documentName,
          text: chunkContent,
          startIndex: start
        });
      }

      if (end >= cleanText.length) break;
      start = end - overlap;
    }

    return chunks;
  }

  private static tokenize(text: string): string[] {
    return (text.toLowerCase().match(/\b[a-z0-9_]{2,}\b/g) || []).filter(
      (term) => !RagService.stopWords.has(term)
    );
  }

  /**
   * Retrieve top relevant chunks for a user query using BM25 / term matching
   */
  public static retrieveRelevantChunks(
    query: string,
    chunks: TextChunk[],
    topK: number = 5
  ): TextChunk[] {
    if (!chunks.length || !query.trim()) return [];

    const queryTerms = this.tokenize(query);
    if (!queryTerms.length) {
      // If query is very short or all stopwords, return first chunks
      return chunks.slice(0, topK);
    }

    // Document frequencies
    const df: Map<string, number> = new Map();
    const chunkTokens: Map<number, string[]> = new Map();

    for (const chunk of chunks) {
      const tokens = this.tokenize(chunk.text);
      chunkTokens.set(chunk.id, tokens);
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        df.set(token, (df.get(token) || 0) + 1);
      }
    }

    const N = chunks.length;
    const avgLen = chunks.reduce((acc, c) => acc + (chunkTokens.get(c.id)?.length || 0), 0) / (N || 1);
    const k1 = 1.5;
    const b = 0.75;

    const scoredChunks = chunks.map((chunk) => {
      const tokens = chunkTokens.get(chunk.id) || [];
      const len = tokens.length;
      const tf: Map<string, number> = new Map();
      for (const t of tokens) {
        tf.set(t, (tf.get(t) || 0) + 1);
      }

      let score = 0;
      for (const qTerm of queryTerms) {
        const termDf = df.get(qTerm) || 0;
        if (termDf === 0) continue;

        // Standard BM25 IDF
        const idf = Math.log((N - termDf + 0.5) / (termDf + 0.5) + 1.0);
        const termTf = tf.get(qTerm) || 0;
        const numerator = termTf * (k1 + 1);
        const denominator = termTf + k1 * (1 - b + b * (len / (avgLen || 1)));

        score += idf * (numerator / denominator);
      }

      // Bonus for exact query string occurrence
      if (chunk.text.toLowerCase().includes(query.toLowerCase())) {
        score += 3.0;
      }

      return {
        ...chunk,
        score
      };
    });

    scoredChunks.sort((a, b) => (b.score || 0) - (a.score || 0));

    // Return chunks with score > 0 or top 2 if scores are 0
    const relevant = scoredChunks.filter((c) => (c.score || 0) > 0);
    if (relevant.length > 0) {
      return relevant.slice(0, topK);
    }
    return chunks.slice(0, topK);
  }

  /**
   * Format context for the LLM prompt
   */
  public static buildAugmentedPrompt(
    query: string,
    relevantChunks: TextChunk[],
    documentName: string
  ): string {
    if (!relevantChunks.length) {
      return query;
    }

    const contextSnippets = relevantChunks
      .map((c, i) => `[Source ${i + 1} - ${c.documentName}]:\n${c.text}`)
      .join('\n\n---\n\n');

    return `The user is asking a question regarding the local document: "${documentName}".
Below are the most relevant sections retrieved directly from the document:

<DOCUMENT_CONTEXT>
${contextSnippets}
</DOCUMENT_CONTEXT>

Please answer the user's question accurately using the document context above. If the document does not contain the answer, politely state so based on the provided text.

User Question:
${query}`;
  }
}
