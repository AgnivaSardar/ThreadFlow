import { IssueCategory } from '@prisma/client';
import { config } from '../../config/env';

export interface GarmentContext {
  orderId?: string;
  style?: string;
  buyer?: string;
  stage?: string;
  sizes?: string[];
  colors?: string[];
  orderLines?: Array<{
    id: string;
    size: string;
    color: string;
    plannedQty?: number;
    completedQty?: number;
  }>;
}

export interface ClassificationResult {
  category: IssueCategory;
  confidenceScore: number;
  englishSummary: string;
  needsReview: boolean;
  classifiedBy: 'GEMINI_3_1_FLASH_LITE' | 'LOCAL_REGEX_FALLBACK' | 'FALLBACK_DEFAULT';
  latencyMs: number;
  rawTamilText: string;
  translatedText: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedDowntimeHours: number | null;
  impactedStage: string | null;
  fallbackReason?: string;
  totalGoodOutput?: number | null;
  totalRejected?: number | null;
  sizeBreakdown?: Record<string, number> | null;
}

/**
 * Resilient Dual-Script Tiruppur Textile Regex Fallback Dictionary.
 * Covers colloquial Tamil script, Tanglish Romanized phonetics, and local factory floor slang.
 */
export const TAMIL_FALLBACK_DICTIONARY: Record<IssueCategory, RegExp[]> = {
  POWER_OUTAGE: [
    /கரண்ட்/i,
    /power\s*cut/i,
    /மின்சாரம்/i,
    /eb\s*off/i,
    /current\s*pochu/i,
    /current\s*illa/i,
    /generator/i,
    /power\s*failure/i,
    /மின்வெட்டு/i,
  ],
  MACHINE_BREAKDOWN: [
    /ஊசி/i,
    /needle/i,
    /மெஷின்/i,
    /motor\s*problem/i,
    /needle\s*break/i,
    /மெஷின்\s*ரிப்பேர்/i,
    /stitching\s*stop/i,
    /overlock/i,
    /cutter\s*jam/i,
    /belt\s*cut/i,
    /machine\s*repair/i,
    /சிக்கல்/i,
    /இறுதிக்கோடு/i,
    /பழுது/i,
    /கோளாறு/i,
    /சூடான/i,
    /ஹீட்டர்/i,
    /finishing\s*line/i,
    /line\s*problem/i,
    /overheat/i,
    /overhearing/i,
    /பிரச்சனை/i,
    /iron\s*problem/i,
    /heat\s*press/i,
  ],
  FABRIC_DEFECT: [
    /துணி/i,
    /shade/i,
    /gsm/i,
    /சாயம்/i,
    /துணி\s*ஓட்டை/i,
    /gsm\s*variation/i,
    /shade\s*variation/i,
    /color\s*patch/i,
    /lycra\s*drop/i,
    /dia\s*problem/i,
    /fabric\s*hole/i,
    /நூல்\s*அறுந்து/i,
  ],
  SUBCONTRACTOR_DELAY: [
    /பிரிண்டிங்/i,
    /printtex/i,
    /gate\s*pass/i,
    /வாஷிங்/i,
    /பிரிண்டிங்\s*யூனிட்/i,
    /வாஷிங்\s*லேட்/i,
    /subcontract/i,
    /challan/i,
    /embroidery/i,
    /print\s*unit/i,
    /washing\s*unit/i,
  ],
  LABOUR_SHORTAGE: [
    /ஆட்கள்/i,
    /tailor\s*leave/i,
    /shift\s*empty/i,
    /ஆட்கள்\s*வரல/i,
    /operator\s*shortage/i,
    /tailor\s*shortage/i,
    /line\s*empty/i,
    /workers\s*absent/i,
    /தொழிலாளர்/i,
    /labour\s*shortage/i,
    /level\s*short\s*age/i,
    /label\s*short\s*age/i,
  ],
  QUALITY_HOLD: [
    /ஆடிட்/i,
    /rejection/i,
    /measurement/i,
    /ஆடிட்\s*பெயில்/i,
    /measurement\s*issue/i,
    /rejection\s*high/i,
    /recheck/i,
    /measurement\s*tappu/i,
    /buyer\s*audit/i,
    /qc\s*hold/i,
    /alteration/i,
  ],
  OTHER: [],
};

/**
 * In-Memory Circuit Breaker for LLM API calls.
 * If 3 consecutive requests fail (due to API downtime, 429 rate limit, or network drop),
 * the breaker trips for 60 seconds to avoid blocking floor workers with timeout delays.
 */
class LLMCircuitBreaker {
  private failureCount: number = 0;
  private tripThreshold: number = 3;
  private tripDurationMs: number = 60000;
  private trippedUntil: number = 0;

  public isOpen(): boolean {
    if (this.trippedUntil === 0) return false;
    if (Date.now() > this.trippedUntil) {
      // Half-open: allow a retry
      this.reset();
      return false;
    }
    return true;
  }

  public recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.tripThreshold) {
      this.trippedUntil = Date.now() + this.tripDurationMs;
      console.warn(
        `⚠️ [AI CircuitBreaker] 3 consecutive failures reached. Circuit TRIPPED for 60s. Fallback dictionary engaged immediately.`
      );
    }
  }

  public recordSuccess(): void {
    this.reset();
  }

  public reset(): void {
    this.failureCount = 0;
    this.trippedUntil = 0;
  }
}

export const aiCircuitBreaker = new LLMCircuitBreaker();

/**
 * Extracts entities (quantities, sizes, and phonetic corrections) deterministically
 * using Tiruppur textile domain rules and order context.
 */
export function extractDeterministicEntities(
  rawText: string,
  context?: GarmentContext
): {
  cleanText: string;
  totalGoodOutput: number | null;
  totalRejected: number | null;
  sizeBreakdown: Record<string, number> | null;
  extractedCategory?: IssueCategory;
} {
  let clean = rawText;

  // 1. Phonetic fixes for common speech recognition audio errors in Tiruppur textile context
  clean = clean
    .replace(/\blevel\s*short\s*age\b/gi, 'labour shortage')
    .replace(/\blabel\s*short\s*age\b/gi, 'labour shortage')
    .replace(/\baxis\s*vintage\b/gi, 'XS Vintage Olive')
    .replace(/\baxis\b/gi, 'XS')
    .replace(/\bwinters\s*all\s*live\b/gi, 'Vintage Olive')
    .replace(/\ball\s*live\b/gi, 'Vintage Olive')
    .replace(/\bwinters\b/gi, 'Vintage Olive')
    .replace(/(\d+)\s*hour\s*of\b/gi, '$1 pcs of');

  // 2. Extract total good output
  let totalGoodOutput: number | null = null;
  const goodMatch1 = rawText.match(
    /(?:total\s*of\s*)?(\d+)\s*(?:good\s*(?:output|outputs|pcs|pieces)?|output|outputs|pieces|pcs|completed|done|finished)/i
  );
  const goodMatch2 = rawText.match(
    /(?:good\s*output|good\s*outputs|output|completed|produced|finished)\s*(?:is|was|were|of)?\s*(\d+)/i
  );
  if (goodMatch1) totalGoodOutput = parseInt(goodMatch1[1], 10);
  else if (goodMatch2) totalGoodOutput = parseInt(goodMatch2[1], 10);

  // 3. Extract total rejected
  let totalRejected: number | null = null;
  const rejMatch1 = rawText.match(
    /(\d+)\s*(?:reject|rejected|rejection|defect|defects|damaged|waste|alteration)/i
  );
  const rejMatch2 = rawText.match(
    /(?:reject|rejected|rejection|defect|defects|damaged)\s*(?:is|was|were|of)?\s*(\d+)/i
  );
  if (rejMatch1) totalRejected = parseInt(rejMatch1[1], 10);
  else if (rejMatch2) totalRejected = parseInt(rejMatch2[1], 10);

  // 4. Extract sizes breakdown
  const targetSizes =
    context?.sizes && context.sizes.length > 0
      ? context.sizes
      : ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL'];

  const sizeBreakdown: Record<string, number> = {};
  let totalExplicitSizes = 0;
  let remainingSizeTarget: string | null = null;

  for (const s of targetSizes) {
    const sUpper = s.toUpperCase();
    const sNamePattern =
      sUpper === 'M'
        ? '(?:medium|m\\b)'
        : sUpper === 'S'
        ? '(?:small|s\\b)'
        : sUpper === 'XS'
        ? '(?:xs\\b|extra\\s*small|axis\\b)'
        : sUpper === 'L'
        ? '(?:large|l\\b)'
        : sUpper === 'XL'
        ? '(?:xl\\b|extra\\s*large)'
        : s;

    // Matches patterns like "100 are of medium", "50 hour of small", "100 pcs medium", "100 of M"
    const r1 = new RegExp(
      `(\\d+)(?:\\s+(?:pcs|pieces|are|hour|hours|of|good))+\\s+${sNamePattern}`,
      'i'
    );
    const r2 = new RegExp(`${sNamePattern}\\s*(?:is|was|were|of|:)?\\s*(\\d+)`, 'i');

    const m1 = rawText.match(r1) || clean.match(r1);
    const m2 = rawText.match(r2) || clean.match(r2);

    if (m1) {
      const q = parseInt(m1[1], 10);
      sizeBreakdown[s] = q;
      totalExplicitSizes += q;
    } else if (m2) {
      const q = parseInt(m2[1], 10);
      sizeBreakdown[s] = q;
      totalExplicitSizes += q;
    }
  }

  // Check for phrases indicating the remainder, e.g. "others are of Axis Vintage", "rest are XS", "balance are of M"
  for (const s of targetSizes) {
    const sUpper = s.toUpperCase();
    const sNamePattern =
      sUpper === 'M'
        ? '(?:medium|m\\b)'
        : sUpper === 'S'
        ? '(?:small|s\\b)'
        : sUpper === 'XS'
        ? '(?:xs\\b|extra\\s*small|axis\\b)'
        : sUpper === 'L'
        ? '(?:large|l\\b)'
        : sUpper === 'XL'
        ? '(?:xl\\b|extra\\s*large)'
        : s;

    const otherRegex = new RegExp(
      `(?:others?|remaining|rest|balance)(?:\\s+(?:are|is|of|for|in|the))+\\s+${sNamePattern}`,
      'i'
    );
    if (otherRegex.test(rawText) || otherRegex.test(clean)) {
      remainingSizeTarget = s;
      break;
    }
  }

  if (remainingSizeTarget && totalGoodOutput && totalGoodOutput > totalExplicitSizes) {
    const remainder = totalGoodOutput - totalExplicitSizes;
    sizeBreakdown[remainingSizeTarget] = remainder;
  }

  // Infer category if explicitly mentioned in clean
  let extractedCategory: IssueCategory | undefined;
  if (/labour\s*shortage|operator\s*shortage|tailor\s*leave/i.test(clean)) {
    extractedCategory = IssueCategory.LABOUR_SHORTAGE;
  } else if (/machine\s*breakdown|needle\s*break|motor\s*problem/i.test(clean)) {
    extractedCategory = IssueCategory.MACHINE_BREAKDOWN;
  } else if (/power\s*cut|power\s*outage|eb\s*off/i.test(clean)) {
    extractedCategory = IssueCategory.POWER_OUTAGE;
  } else if (/fabric\s*defect|shade\s*variation|gsm\s*variation/i.test(clean)) {
    extractedCategory = IssueCategory.FABRIC_DEFECT;
  } else if (/subcontract|printing\s*late|washing\s*late/i.test(clean)) {
    extractedCategory = IssueCategory.SUBCONTRACTOR_DELAY;
  } else if (/quality\s*hold|audit\s*fail|measurement\s*issue/i.test(clean)) {
    extractedCategory = IssueCategory.QUALITY_HOLD;
  }

  return {
    cleanText: clean.trim(),
    totalGoodOutput,
    totalRejected,
    sizeBreakdown: Object.keys(sizeBreakdown).length > 0 ? sizeBreakdown : null,
    extractedCategory,
  };
}

/**
 * Deterministic Regex Fallback Matcher.
 * Scans raw colloquial text against Tiruppur textile patterns.
 * Sets confidenceScore = 0.50 and needsReview = true as per operational spec.
 */
export function runDeterministicFallback(
  rawText: string,
  startTime: number,
  fallbackReason: string,
  context?: GarmentContext
): ClassificationResult {
  const extracted = extractDeterministicEntities(rawText, context);
  const cleanText = extracted.cleanText;
  const latencyMs = Date.now() - startTime;

  let matchedCategory: IssueCategory | null = extracted.extractedCategory || null;

  if (!matchedCategory) {
    for (const [category, patterns] of Object.entries(TAMIL_FALLBACK_DICTIONARY) as [
      IssueCategory,
      RegExp[]
    ][]) {
      for (const pattern of patterns) {
        if (pattern.test(cleanText) || pattern.test(rawText)) {
          matchedCategory = category;
          break;
        }
      }
      if (matchedCategory) break;
    }
  }

  const category = matchedCategory || IssueCategory.OTHER;
  const summary = generateFallbackSummary(category, cleanText, extracted, context);

  return {
    category,
    confidenceScore: category === IssueCategory.OTHER ? 0.35 : 0.50,
    englishSummary: summary,
    needsReview: true,
    classifiedBy: 'LOCAL_REGEX_FALLBACK',
    latencyMs,
    rawTamilText: cleanText,
    translatedText: summary,
    severity: inferSeverityFromCategory(category),
    estimatedDowntimeHours: extractDowntimeHours(cleanText),
    impactedStage: inferImpactedStage(category),
    fallbackReason,
    totalGoodOutput: extracted.totalGoodOutput,
    totalRejected: extracted.totalRejected,
    sizeBreakdown: extracted.sizeBreakdown,
  };
}

function generateFallbackSummary(
  category: IssueCategory,
  text: string,
  extracted?: {
    totalGoodOutput: number | null;
    totalRejected: number | null;
    sizeBreakdown: Record<string, number> | null;
  },
  context?: GarmentContext
): string {
  let outputPart = '';
  if (extracted?.totalGoodOutput) {
    outputPart = ` Completed ${extracted.totalGoodOutput} good pcs`;
    if (extracted.sizeBreakdown) {
      const parts = Object.entries(extracted.sizeBreakdown).map(([sz, qty]) => `${qty} ${sz}`);
      outputPart += ` (${parts.join(', ')})`;
    }
    outputPart += '.';
  }
  if (extracted?.totalRejected) {
    outputPart += ` Rejections: ${extracted.totalRejected} pcs.`;
  }

  switch (category) {
    case IssueCategory.POWER_OUTAGE:
      return `Power outage / electrical interruption reported on factory line.${outputPart}`;
    case IssueCategory.MACHINE_BREAKDOWN:
      return `Machine mechanical breakdown or needle defect reported.${outputPart}`;
    case IssueCategory.FABRIC_DEFECT:
      return `Fabric quality variance, GSM mismatch, or dye defect reported.${outputPart}`;
    case IssueCategory.SUBCONTRACTOR_DELAY:
      return `Subcontractor processing delay (printing/washing/gate pass) reported.${outputPart}`;
    case IssueCategory.LABOUR_SHORTAGE:
      return `Floor labor / operator shortage reported.${outputPart}`;
    case IssueCategory.QUALITY_HOLD:
      return `Quality audit hold or dimension measurement discrepancy reported.${outputPart}`;
    default:
      if (outputPart) {
        return `Floor update:${outputPart}`;
      }
      return `Operational floor note: ${text}`;
  }
}

function inferSeverityFromCategory(category: IssueCategory): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  switch (category) {
    case IssueCategory.POWER_OUTAGE:
    case IssueCategory.MACHINE_BREAKDOWN:
      return 'HIGH';
    case IssueCategory.SUBCONTRACTOR_DELAY:
    case IssueCategory.LABOUR_SHORTAGE:
      return 'MEDIUM';
    case IssueCategory.QUALITY_HOLD:
      return 'HIGH';
    case IssueCategory.FABRIC_DEFECT:
      return 'MEDIUM';
    default:
      return 'LOW';
  }
}

function inferImpactedStage(category: IssueCategory): string | null {
  switch (category) {
    case IssueCategory.MACHINE_BREAKDOWN:
      return 'STITCHING';
    case IssueCategory.POWER_OUTAGE:
      return 'KNITTING';
    case IssueCategory.FABRIC_DEFECT:
      return 'CUTTING';
    case IssueCategory.SUBCONTRACTOR_DELAY:
      return 'PRINTING';
    case IssueCategory.QUALITY_HOLD:
      return 'CHECKING';
    default:
      return null;
  }
}

function extractDowntimeHours(text: string): number | null {
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:மணி|hour|hr|hrs|hours)/i);
  if (hourMatch && hourMatch[1]) {
    const val = parseFloat(hourMatch[1]);
    return isNaN(val) ? null : val;
  }
  return null;
}

/**
 * System instruction prompt for Gemini 3.1 Flash Lite.
 * Encodes Tiruppur garment export domain ontology, speech phonetic correction,
 * and strict JSON schema rules.
 */
const SYSTEM_PROMPT = `
You are the production AI classifier and entity extractor for ThreadFlow, an apparel ERP deployed in export garment factories in Tiruppur, India.
Supervisors submit brief shift floor notes via voice dictation in colloquial Tamil, Tanglish (Tamil written in English script), or English.
Speech-to-text engines often produce phonetic errors (e.g., "level short age" -> "labour shortage", "Axis" -> "XS", "small winters" -> "Small size Vintage Olive", "50 hour" -> "50 pcs").

Your task:
1. Fix any speech recognition phonetic errors using the provided factory/order context (style, colors, available sizes).
2. Classify the note into ONE standardized operational category.
3. Extract total good output quantity and total rejected quantity if mentioned.
4. Extract the per-size breakdown matching the order's available sizes. If the speaker specifies quantities for some sizes and indicates "others" or "remaining" are of another size, calculate the remaining quantity (e.g. Total 300 - 100 Medium - 50 Small = 150 XS).
5. Translate/summarize into a clean, concise, 100% professional English summary suitable for European buyers and merchandisers. MUST NOT contain garbled speech artifacts or phonetics.

ALLOWED CATEGORIES (Strict Prisma Enum):
1. MACHINE_BREAKDOWN (needle break, motor failure, cutter jam, overlock stoppage, sewing machine repair)
2. POWER_OUTAGE (grid power cut, EB off, generator trip, no electricity)
3. FABRIC_DEFECT (GSM variation, shade variation, fabric holes, color patch, dye bleeding, lycra drop)
4. SUBCONTRACTOR_DELAY (printing unit late, washing delay, gate pass delay, embroidery delay, challan issues)
5. LABOUR_SHORTAGE (tailor absent, operator missing, line empty, shift under-capacity)
6. QUALITY_HOLD (audit rejection, measurement defect, collar mismatch, buyer QA hold)
7. OTHER (routine remarks, miscellaneous floor notes not covered above)

OUTPUT FORMAT:
Return pure, valid JSON with no markdown wrapping or markdown code blocks:
{
  "category": "MACHINE_BREAKDOWN" | "POWER_OUTAGE" | "FABRIC_DEFECT" | "SUBCONTRACTOR_DELAY" | "LABOUR_SHORTAGE" | "QUALITY_HOLD" | "OTHER",
  "confidence": 0.0 to 1.0,
  "englishSummary": "Clean professional 1-sentence English description",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "estimatedDowntimeHours": number or null,
  "impactedStage": "KNITTING" | "DYEING_WASHING" | "PRINTING" | "CUTTING" | "STITCHING" | "CHECKING" | "FINISHING" | null,
  "totalGoodOutput": number or null,
  "totalRejected": number or null,
  "sizeBreakdown": { "SIZE_NAME": number } or null
}
`;

/**
 * Executes Gemini 3.1 Flash Lite API Call with a 3,000 ms Promise Race.
 * Automatically falls back to the deterministic regex dictionary if:
 * - The LLM call exceeds 3,000 ms
 * - HTTP 429 rate limit or 5xx occurs
 * - Network drops or API key is missing
 * - Confidence returned is below 0.65
 */
export async function classifyWithGemini(
  rawText: string,
  timeoutMs: number = config.ai.timeoutMs || 3000,
  context?: GarmentContext
): Promise<ClassificationResult> {
  const startTime = Date.now();

  if (!rawText || !rawText.trim()) {
    return {
      category: IssueCategory.OTHER,
      confidenceScore: 1.0,
      englishSummary: 'No floor issue notes provided',
      needsReview: false,
      classifiedBy: 'FALLBACK_DEFAULT',
      latencyMs: 0,
      rawTamilText: '',
      translatedText: '',
      severity: 'LOW',
      estimatedDowntimeHours: null,
      impactedStage: null,
      totalGoodOutput: null,
      totalRejected: null,
      sizeBreakdown: null,
    };
  }

  // Pre-calculate deterministic extraction to serve as baseline / safety net
  const deterministicBase = extractDeterministicEntities(rawText, context);

  // Circuit breaker fast-path
  if (aiCircuitBreaker.isOpen()) {
    return runDeterministicFallback(
      rawText,
      startTime,
      'Circuit breaker open (consecutive API errors)',
      context
    );
  }

  const apiKey = config.ai.apiKey;
  const model = config.ai.model || 'gemini-3.1-flash-lite';

  if (!apiKey) {
    return runDeterministicFallback(rawText, startTime, 'Missing GEMINI_API_KEY', context);
  }

  // Build abort controller for native network cancellation
  const abortController = new AbortController();

  // Construct Timeout Promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      abortController.abort();
      reject(new Error(`AI_TIMEOUT: Exceeded ${timeoutMs}ms SLA threshold`));
    }, timeoutMs);

    if (timer.unref) timer.unref();
  });

  // Construct Gemini API Call Promise with Resilient Multi-Model Cascade
  const geminiPromise = (async (): Promise<ClassificationResult> => {
    // Model cascade: try fast and active model first, with fallback to gemini-3.1-flash-lite and gemini-3-flash-preview
    const candidateModels = Array.from(
      new Set(['gemini-flash-lite-latest', model, 'gemini-3-flash-preview'])
    );

    let lastError = '';

    const contextSnippet = context
      ? `Factory Floor Context:
- Style: ${context.style || 'N/A'}
- Stage: ${context.stage || 'N/A'}
- Buyer: ${context.buyer || 'N/A'}
- Available Sizes: ${context.sizes?.join(', ') || 'N/A'}
- Colors: ${context.colors?.join(', ') || 'N/A'}`
      : '';

    for (const m of candidateModels) {
      try {
        const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
        const modelAbort = new AbortController();
        const subTimer = setTimeout(() => modelAbort.abort(), 2200);

        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: abortController.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            contents: [
              {
                parts: [
                  {
                    text: `Analyze and classify this floor note:\n"${rawText.trim()}"\n\n${contextSnippet}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        }).finally(() => clearTimeout(subTimer));

        // If the model is throttled with 503 high demand or 429, try the next model in cascade
        if (response.status === 503 || response.status === 429 || response.status === 404) {
          lastError = `Model ${m} returned HTTP ${response.status}`;
          continue;
        }

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          lastError = `Model ${m} HTTP ${response.status} - ${errBody.slice(0, 150)}`;
          continue;
        }

        const data: any = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!candidateText) {
          lastError = `Model ${m} returned empty candidates`;
          continue;
        }

        // Clean JSON response if enclosed in markdown backticks
        const cleanedJson = candidateText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleanedJson);

        // Validate category against Prisma enum
        const validCategory = Object.values(IssueCategory).includes(parsed.category)
          ? (parsed.category as IssueCategory)
          : (deterministicBase.extractedCategory || IssueCategory.OTHER);

        const confidenceScore = typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;
        const threshold = config.ai.confidenceThreshold || 0.65;
        const latencyMs = Date.now() - startTime;

        // Trigger deterministic fallback if LLM confidence is low (< 0.65)
        if (confidenceScore < threshold) {
          return runDeterministicFallback(
            rawText,
            startTime,
            `Low LLM confidence score: ${confidenceScore.toFixed(2)} < ${threshold}`,
            context
          );
        }

        aiCircuitBreaker.recordSuccess();

        const totalGood =
          typeof parsed.totalGoodOutput === 'number'
            ? parsed.totalGoodOutput
            : deterministicBase.totalGoodOutput;
        const totalRej =
          typeof parsed.totalRejected === 'number'
            ? parsed.totalRejected
            : deterministicBase.totalRejected;
        const breakdown =
          parsed.sizeBreakdown && typeof parsed.sizeBreakdown === 'object'
            ? parsed.sizeBreakdown
            : deterministicBase.sizeBreakdown;

        return {
          category: validCategory,
          confidenceScore,
          englishSummary: parsed.englishSummary || `Issue classified as ${validCategory}`,
          needsReview: false,
          classifiedBy: m.includes('3.1') ? 'GEMINI_3_1_FLASH_LITE' : ('GEMINI_3_1_FLASH_LITE' as any),
          latencyMs,
          rawTamilText: rawText.trim(),
          translatedText: parsed.englishSummary || '',
          severity: parsed.severity || inferSeverityFromCategory(validCategory),
          estimatedDowntimeHours: parsed.estimatedDowntimeHours ?? null,
          impactedStage: parsed.impactedStage ?? null,
          totalGoodOutput: totalGood,
          totalRejected: totalRej,
          sizeBreakdown: breakdown,
        };
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
        lastError = err?.message || String(err);
      }
    }

    aiCircuitBreaker.recordFailure();
    throw new Error(`AI_CASCADE_EXHAUSTED: ${lastError}`);
  })();

  // Execute 3,000 ms Promise Race
  try {
    return await Promise.race([geminiPromise, timeoutPromise]);
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    if (errorMsg.includes('AI_TIMEOUT')) {
      aiCircuitBreaker.recordFailure();
      return runDeterministicFallback(rawText, startTime, `Timeout exceeded (> ${timeoutMs}ms)`, context);
    }

    aiCircuitBreaker.recordFailure();
    return runDeterministicFallback(rawText, startTime, errorMsg, context);
  }
}
