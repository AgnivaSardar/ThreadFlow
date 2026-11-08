import { prisma } from '../../config/db';
import { config } from '../../config/env';
import { AuthenticatedUser } from '../../common/types/express';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class AssistantService {
  /**
   * Guides users through ThreadFlow and answers queries strictly grounded in the database.
   */
  static async handleChat(
    message: string,
    history: ChatMessage[] = [],
    user: AuthenticatedUser
  ): Promise<{ reply: string; grounded: boolean }> {
    const trimmed = (message || '').trim();
    if (!trimmed) {
      return {
        reply: 'Please ask a question about ThreadFlow orders, production floor work, or website navigation.',
        grounded: true,
      };
    }

    // 1. Fetch live operational snapshot from the database
    const [orders, units] = await Promise.all([
      prisma.order.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          poNumber: true,
          style: true,
          totalQuantity: true,
          exFactoryDate: true,
          buyer: { select: { name: true, code: true } },
          unit: { select: { name: true, code: true } },
          milestones: {
            orderBy: { sequenceOrder: 'asc' },
            select: {
              stage: true,
              sequenceOrder: true,
              targetQuantity: true,
              completedQuantity: true,
            },
          },
          riskWarnings: {
            select: {
              riskLevel: true,
              daysLate: true,
              milestone: { select: { stage: true } },
              mitigationPlan: true,
            },
          },
        },
        orderBy: { exFactoryDate: 'asc' },
        take: 20,
      }),
      prisma.unit.findMany({
        select: { id: true, name: true, code: true },
      }),
    ]);

    // Build concise text snapshot of database orders
    const ordersSummary = orders
      .map((o: any) => {
        const finalMilestone = o.milestones[o.milestones.length - 1];
        const isFinalDone =
          finalMilestone && finalMilestone.completedQuantity >= finalMilestone.targetQuantity;
        const activeMs =
          o.milestones.find((m: any) => m.completedQuantity < m.targetQuantity) || finalMilestone;
        const progressPct =
          activeMs && activeMs.targetQuantity > 0
            ? Math.round((activeMs.completedQuantity / activeMs.targetQuantity) * 100)
            : 0;
        const topRisk = o.riskWarnings[0];
        const healthStatus = isFinalDone
          ? 'Completed'
          : topRisk?.riskLevel === 'RED'
          ? 'Critical Deficit (RED)'
          : topRisk?.riskLevel === 'AMBER'
          ? 'Extra Caution (AMBER)'
          : 'On Track (GREEN)';

        return `• PO ${o.poNumber} ("${o.style}", ${o.totalQuantity.toLocaleString()} pcs, Buyer: ${
          o.buyer?.name || 'N/A'
        }, Unit: ${o.unit?.name || 'N/A'}, Ex-Factory: ${o.exFactoryDate.toISOString().slice(0, 10)}):
  - Status: ${healthStatus}
  - Active Stage: ${activeMs?.stage || 'N/A'} (${(activeMs?.completedQuantity || 0).toLocaleString()} / ${(activeMs?.targetQuantity || 0).toLocaleString()} pcs, ${progressPct}%)
  ${topRisk ? `- Risk: ${topRisk.riskLevel} (${topRisk.daysLate || 0}d late in ${topRisk.milestone?.stage || 'stage'})` : '- Risk: None / On Track'}`;
      })
      .join('\n');

    const unitsSummary = units.map((u: any) => `${u.name} (${u.code})`).join(', ');

    const navigationGuide = `
THREADFLOW PAGES & CAPABILITIES:
1. "Export Order Board" (/orders):
   - Overview of all foreign buyer orders across the 7 sequential TNA stages (Knitting, Dyeing/Washing, Printing, Cutting, Stitching, Checking, Finishing).
   - Filter by Buyer, Production Unit, TNA Stage, and Health Status (Critical Deficit, Extra Caution, On Track, Completed).
   - Pagination controls, bulk ex-factory date shifting, and standup memo generation.
   - Interactive Run-Rate Simulator: Test "What-If" output run-rates, evaluate overtime ROI, and calculate air freight conversion liabilities.
2. "Floor Production Work" (/supervisor/my-work):
   - Used by floor supervisors to track work in progress per factory unit.
   - Per-size output logging (S, M, L, XL individually) with automatic tolerance ceiling enforcement (+3%).
   - One-tap speech recognition in any language with AI auto-transcription into clean English.
   - Defect photo capture with client-side canvas compression.
   - Offline IndexedDB caching and sync queue.
3. "Order Detail & TNA Gantt" (/orders/:id):
   - Detailed visual breakdown of the order's 7 milestone timeline, production logs history, SHA-256 audit chain, and issue classification log.
`;

    const systemPrompt = `You are ThreadFlow AI, the dedicated factory and website assistant for the ThreadFlow apparel ERP.
User Role: ${user.role} (${user.email}).

STRICT OPERATIONAL GUIDELINES:
1. ONLY ThreadFlow Domain & Database:
   - You can ONLY answer questions about ThreadFlow, navigating the website, how to use features, and real-time order/milestone/risk statuses from the database.
   - If the user asks about ANY topic outside ThreadFlow (e.g. general coding, weather, sports, personal queries, movies, general banter), YOU MUST REFUSE politely and state:
     "I am ThreadFlow's Factory AI Guide. I can only assist with ThreadFlow orders, production floor operations, TNA milestone tracking, and navigating this application. I am not able to answer out-of-context requests."
2. LIVE DATABASE GROUNDING:
   - Use ONLY the provided database snapshot below. Never invent order numbers, quantities, stages, or completion dates.
   - If an order number is not listed, say it is not present in the current database.
3. CONCISE & PRACTICAL:
   - Keep answers concise (2 to 4 sentences or brief bullet points).
   - Direct the user to the exact page or button they need.

CURRENT LIVE DATABASE SNAPSHOT:
Units: ${unitsSummary}
Orders:
${ordersSummary}

${navigationGuide}`;

    // 2. Try Gemini API call
    const apiKey = config.ai.apiKey;
    const model = config.ai.model || 'gemini-3.1-flash-lite';

    if (apiKey) {
      try {
        const candidateModels = Array.from(
          new Set(['gemini-flash-lite-latest', model, 'gemini-3-flash-preview'])
        );

        for (const m of candidateModels) {
          try {
            const endpointUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
            const abort = new AbortController();
            const timer = setTimeout(() => abort.abort(), 4000);

            // Build conversation history contents
            const contents: any[] = [];
            // Take up to last 4 turns of history
            const recentHistory = history.slice(-4);
            for (const h of recentHistory) {
              contents.push({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.content }],
              });
            }
            contents.push({
              role: 'user',
              parts: [{ text: trimmed }],
            });

            const res = await fetch(endpointUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: abort.signal,
              body: JSON.stringify({
                systemInstruction: {
                  parts: [{ text: systemPrompt }],
                },
                contents,
                generationConfig: {
                  temperature: 0.2,
                  maxOutputTokens: 600,
                },
              }),
            }).finally(() => clearTimeout(timer));

            if (!res.ok) continue;

            const data: any = await res.json();
            const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply && reply.trim()) {
              return { reply: reply.trim(), grounded: true };
            }
          } catch {
            // try next model
          }
        }
      } catch {
        // fall back to deterministic response
      }
    }

    // 3. Deterministic Local Fallback if LLM unavailable or offline
    return {
      reply: runDeterministicAssistantFallback(trimmed, orders, user),
      grounded: true,
    };
  }
}

function runDeterministicAssistantFallback(query: string, orders: any[], user: AuthenticatedUser): string {
  const lower = query.toLowerCase();

  // Out of context filter
  if (
    /weather|movie|cricket|football|recipe|cook|joke|president|capital|song|who are you|code python|write a script/i.test(
      lower
    )
  ) {
    return 'I am ThreadFlow\'s Factory AI Guide. I can only assist with ThreadFlow orders, production floor operations, TNA milestone tracking, and navigating this application. I am not able to answer out-of-context requests.';
  }

  // Navigation: How to log output
  if (/how to log|how do i log|log shift|floor output|record output/i.test(lower)) {
    return 'To log shift output:\n1. Click "Floor Production Work" from the top navigation bar.\n2. Find your active order card and tap "Log Output".\n3. Enter the good output pieces per size (S, M, L, XL).\n4. You can also tap the speak button to dictate shift notes and numbers.\n5. Click "Submit Shift Output".';
  }

  // Navigation: Simulator
  if (/simulator|air freight|what-if|run rate/i.test(lower)) {
    return 'The Run-Rate & Air Freight Simulator is available on the Export Order Board (/orders). Click the "Simulator" button to test different daily production paces, see projected completion dates, and view overtime ROI and financial air freight liability.';
  }

  // Specific Order queries
  for (const o of orders) {
    if (lower.includes(o.poNumber.toLowerCase()) || (o.style && lower.includes(o.style.toLowerCase()))) {
      const activeMs =
        o.milestones.find((m: any) => m.completedQuantity < m.targetQuantity) ||
        o.milestones[o.milestones.length - 1];
      const isDone = activeMs && activeMs.completedQuantity >= activeMs.targetQuantity;
      const pct =
        activeMs && activeMs.targetQuantity > 0
          ? Math.round((activeMs.completedQuantity / activeMs.targetQuantity) * 100)
          : 0;

      return `Order ${o.poNumber} (${o.style}, ${o.totalQuantity.toLocaleString()} pcs):\n• Status: ${
        isDone ? 'Completed' : o.healthStatus
      }\n• Active Stage: ${activeMs?.stage || 'N/A'} (${(activeMs?.completedQuantity || 0).toLocaleString()} / ${(activeMs?.targetQuantity || 0).toLocaleString()} pcs, ${pct}%)\n• Buyer: ${
        o.buyer?.name || 'N/A'
      }\n• Ex-Factory Date: ${o.exFactoryDate.toISOString().slice(0, 10)}`;
    }
  }

  // Risk or delays query
  if (/risk|delay|late|critical|deficit/i.test(lower)) {
    const atRisk = orders.filter((o) => o.healthStatus === 'RED' || o.healthStatus === 'AMBER');
    if (atRisk.length === 0) {
      return 'All orders in the system are currently on track!';
    }
    const list = atRisk
      .map(
        (o) =>
          `• ${o.poNumber} (${o.style}): Status ${o.healthStatus}, Ex-Factory ${o.exFactoryDate.toISOString().slice(0, 10)}`
      )
      .join('\n');
    return `Currently ${atRisk.length} order(s) have risk warnings or delivery deficits:\n${list}\nYou can view their recovery plans on the Export Order Board.`;
  }

  // General help
  return 'Welcome to ThreadFlow! You can ask me:\n• Status of any PO (e.g. "What is the status of C-PO-0501?")\n• "Which orders are at risk?"\n• "How do I log shift output?"\n• "How does the air freight simulator work?"\nI will guide you strictly based on the live factory database.';
}
