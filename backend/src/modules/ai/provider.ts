import { IssueCategory } from '@prisma/client';
import { config } from '../../config/env';

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
 * Deterministic Regex Fallback Matcher.
 * Scans raw colloquial text against Tiruppur textile patterns.
 * Sets confidenceScore = 0.50 and needsReview = true as per operational spec.
 */
export function runDeterministicFallback(
  rawText: string,
  startTime: number,
  fallbackReason: string
): ClassificationResult {
  const cleanText = rawText.trim();
  const latencyMs = Date.now() - startTime;

  for (const [category, patterns] of Object.entries(TAMIL_FALLBACK_DICTIONARY) as [
    IssueCategory,
    RegExp[]
  ][]) {
    for (const pattern of patterns) {
      if (pattern.test(cleanText)) {
        return {
          category,
          confidenceScore: 0.50,
          englishSummary: generateFallbackSummary(category, cleanText),
          needsReview: true,
          classifiedBy: 'LOCAL_REGEX_FALLBACK',
          latencyMs,
          rawTamilText: cleanText,
          translatedText: generateFallbackSummary(category, cleanText),
          severity: inferSeverityFromCategory(category),
          estimatedDowntimeHours: extractDowntimeHours(cleanText),
          impactedStage: inferImpactedStage(category),
          fallbackReason,
        };
      }
    }
  }

  // Safe fallback if zero regex patterns match
  return {
    category: IssueCategory.OTHER,
    confidenceScore: 0.30,
    englishSummary: `Unclassified floor note: "${cleanText}"`,
    needsReview: true,
    classifiedBy: 'FALLBACK_DEFAULT',
    latencyMs,
    rawTamilText: cleanText,
    translatedText: `Unclassified floor remark: "${cleanText}"`,
    severity: 'LOW',
    estimatedDowntimeHours: null,
    impactedStage: null,
    fallbackReason: `${fallbackReason} (No regex match, assigned OTHER)`,
  };
}

function generateFallbackSummary(category: IssueCategory, text: string): string {
  switch (category) {
    case IssueCategory.POWER_OUTAGE:
      return `Power outage / electrical interruption reported on factory line (${text})`;
    case IssueCategory.MACHINE_BREAKDOWN:
      return `Machine mechanical breakdown or needle defect reported (${text})`;
    case IssueCategory.FABRIC_DEFECT:
      return `Fabric quality variance, GSM mismatch, or dye defect reported (${text})`;
    case IssueCategory.SUBCONTRACTOR_DELAY:
      return `Subcontractor processing delay (printing/washing/gate pass) reported (${text})`;
    case IssueCategory.LABOUR_SHORTAGE:
      return `Floor labor / operator shortage or tailor absenteeism reported (${text})`;
    case IssueCategory.QUALITY_HOLD:
      return `Quality audit hold, dimension measurement discrepancy, or high rejection reported (${text})`;
    default:
      return `Operational issue reported: ${text}`;
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
 * Encodes Tiruppur garment export domain ontology and strict JSON schema rules.
 */
const SYSTEM_PROMPT = `
You are the production AI classifier for ThreadFlow, an apparel ERP deployed in export garment factories in Tiruppur, India.
Supervisors submit brief shift floor notes in colloquial Tamil, Tanglish (Tamil written in English script), or English.
Your task is to classify the note into ONE standardized operational category and translate it into a concise, professional English summary for European fashion buyers and head-office merchandisers.

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
  "englishSummary": "Concise professional 1-sentence English description",
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "estimatedDowntimeHours": number or null,
  "impactedStage": "KNITTING" | "DYEING_WASHING" | "PRINTING" | "CUTTING" | "STITCHING" | "CHECKING" | "FINISHING" | null
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
  timeoutMs: number = config.ai.timeoutMs || 3000
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
    };
  }

  // Circuit breaker fast-path
  if (aiCircuitBreaker.isOpen()) {
    return runDeterministicFallback(
      rawText,
      startTime,
      'Circuit breaker open (consecutive API errors)'
    );
  }

  const apiKey = config.ai.apiKey;
  const model = config.ai.model || 'gemini-3.1-flash-lite';

  if (!apiKey) {
    return runDeterministicFallback(rawText, startTime, 'Missing GEMINI_API_KEY');
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
                    text: `Classify this Tamil/Tanglish garment factory note: "${rawText.trim()}"`,
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
          : IssueCategory.OTHER;

        const confidenceScore = typeof parsed.confidence === 'number' ? parsed.confidence : 0.85;
        const threshold = config.ai.confidenceThreshold || 0.65;
        const latencyMs = Date.now() - startTime;

        // Trigger deterministic fallback if LLM confidence is low (< 0.65)
        if (confidenceScore < threshold) {
          return runDeterministicFallback(
            rawText,
            startTime,
            `Low LLM confidence score: ${confidenceScore.toFixed(2)} < ${threshold}`
          );
        }

        aiCircuitBreaker.recordSuccess();

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
      return runDeterministicFallback(rawText, startTime, `Timeout exceeded (> ${timeoutMs}ms)`);
    }

    aiCircuitBreaker.recordFailure();
    return runDeterministicFallback(rawText, startTime, errorMsg);
  }
}
