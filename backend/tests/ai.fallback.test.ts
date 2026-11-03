import { prisma } from '../src/config/db';
import { AIService } from '../src/modules/ai/ai.service';
import {
  classifyWithGemini,
  runDeterministicFallback,
  aiCircuitBreaker,
  TAMIL_FALLBACK_DICTIONARY,
} from '../src/modules/ai/provider';
import { IssueCategory, Role } from '@prisma/client';
import { randomUUID } from 'crypto';

async function runAiFallbackTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING FEATURE 9: RESILIENT TAMIL AI PIPELINE & DETERMINISTIC FALLBACK');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test Group 1: Live Gemini 3.1 Flash Lite Colloquial Tamil & Tanglish
    // -------------------------------------------------------------
    console.log('--- Test Group 1: Gemini 3.1 Flash Lite API Classification ---');

    const liveTamilNote = '2 மணி நேரம் கரண்ட் கட் ஆகிவிட்டது, ஜெனரேட்டர் ஆன் செய்ய முடியவில்லை';
    console.log(`  Calling Gemini 3.1 Flash Lite with Tamil note: "${liveTamilNote}"...`);
    
    const liveResult = await AIService.classifyIssueNote(liveTamilNote, {
      timeoutMs: 5000,
    });

    assert(
      liveResult.category === IssueCategory.POWER_OUTAGE,
      'Gemini correctly classifies Tamil power outage note',
      `Got ${liveResult.category}`
    );
    assert(
      liveResult.confidenceScore >= 0.65,
      `Gemini confidence score is above threshold (score: ${liveResult.confidenceScore})`
    );
    assert(
      liveResult.englishSummary.length > 5,
      `Gemini generates English summary: "${liveResult.englishSummary}"`
    );
    assert(
      liveResult.classifiedBy === 'GEMINI_3_1_FLASH_LITE' || liveResult.classifiedBy === 'LOCAL_REGEX_FALLBACK',
      `Classified by provider: ${liveResult.classifiedBy}`
    );

    // Tanglish Floor Note
    const tanglishNote = 'Needle break aagiduchu, machine stop for 1 hour';
    console.log(`  Calling Gemini 3.1 Flash Lite with Tanglish note: "${tanglishNote}"...`);
    const tanglishResult = await AIService.classifyIssueNote(tanglishNote, {
      timeoutMs: 5000,
    });

    assert(
      tanglishResult.category === IssueCategory.MACHINE_BREAKDOWN,
      'Gemini correctly classifies Tanglish needle break note as MACHINE_BREAKDOWN',
      `Got ${tanglishResult.category}`
    );

    // -------------------------------------------------------------
    // Test Group 2: 3,000 ms SLA Timeout Race & Fallback
    // -------------------------------------------------------------
    console.log('\n--- Test Group 2: Timeout Race & Deterministic Engagement ---');

    // Force an ultra-short 1ms timeout to verify promise race fallback engagement
    const timeoutTamilNote = 'மோட்டார் ரிப்பேர் ஆகிவிட்டது, ஊசி உடைந்தது';
    const timedOutResult = await AIService.classifyIssueNote(timeoutTamilNote, {
      timeoutMs: 1, // 1 ms guarantees timeout race triggers fallback
    });

    assert(
      timedOutResult.classifiedBy === 'LOCAL_REGEX_FALLBACK',
      'Timeout (>SLA) immediately engages LOCAL_REGEX_FALLBACK',
      `Provider: ${timedOutResult.classifiedBy}`
    );
    assert(
      timedOutResult.category === IssueCategory.MACHINE_BREAKDOWN,
      'Deterministic fallback accurately resolves MACHINE_BREAKDOWN from regex',
      `Category: ${timedOutResult.category}`
    );
    assert(
      timedOutResult.confidenceScore === 0.50,
      'Fallback sets confidenceScore to 0.50 as required by blueprint',
      `Confidence: ${timedOutResult.confidenceScore}`
    );
    assert(
      timedOutResult.needsReview === true,
      'Fallback marks needsReview = true for Merchandiser verification'
    );

    // -------------------------------------------------------------
    // Test Group 3: Deterministic Dictionary Across All 6 Operational Categories
    // -------------------------------------------------------------
    console.log('\n--- Test Group 3: Comprehensive Dual-Script Fallback Matrix ---');

    const testCases: { text: string; expectedCategory: IssueCategory; label: string }[] = [
      {
        text: 'மெயின் கரண்ட் ஆப் ஆகிவிட்டது eb off',
        expectedCategory: IssueCategory.POWER_OUTAGE,
        label: 'Tamil + Tanglish Power Outage',
      },
      {
        text: 'stitching machine motor problem ஊசி உடைந்துவிட்டது',
        expectedCategory: IssueCategory.MACHINE_BREAKDOWN,
        label: 'Tanglish Machine Breakdown / Needle Break',
      },
      {
        text: 'துணி ஓட்டை மற்றும் shade variation சாயம் போச்சு',
        expectedCategory: IssueCategory.FABRIC_DEFECT,
        label: 'Tamil Fabric Defect / Shade Variation',
      },
      {
        text: 'பிரிண்டிங் யூனிட் லேட் gate pass challan வரல',
        expectedCategory: IssueCategory.SUBCONTRACTOR_DELAY,
        label: 'Subcontractor Printing / Gate Pass Delay',
      },
      {
        text: 'இன்னைக்கு ஆட்கள் வரல tailor leave shift empty',
        expectedCategory: IssueCategory.LABOUR_SHORTAGE,
        label: 'Labour Shortage / Tailor Leave',
      },
      {
        text: 'quality audit rejection measurement issue recheck',
        expectedCategory: IssueCategory.QUALITY_HOLD,
        label: 'Quality Hold / Measurement Rejection',
      },
      {
        text: 'சாப்பாடு நேரம் முடிந்தது (Routine lunch break remark)',
        expectedCategory: IssueCategory.OTHER,
        label: 'Unmatched note falling back to OTHER',
      },
    ];

    for (const tc of testCases) {
      const fallbackResult = runDeterministicFallback(tc.text, Date.now(), 'Direct Test');
      assert(
        fallbackResult.category === tc.expectedCategory,
        `Dictionary regex matches "${tc.label}" -> ${tc.expectedCategory}`,
        `Got ${fallbackResult.category}`
      );
      assert(
        fallbackResult.needsReview === true,
        `needsReview is true for ${tc.label}`
      );
    }

    // -------------------------------------------------------------
    // Test Group 4: Low-Confidence (<0.65) Fallback Engagement
    // -------------------------------------------------------------
    console.log('\n--- Test Group 4: Low Confidence Handling ---');

    // Test deterministic fallback direct execution when confidence is below 0.65
    const fallbackLowConf = runDeterministicFallback(
      'துணி தரம் gsm mismatch',
      Date.now(),
      'Low LLM confidence score: 0.52 < 0.65'
    );
    assert(
      fallbackLowConf.confidenceScore === 0.50,
      'Low confidence fallback sets score to 0.50',
      `Got ${fallbackLowConf.confidenceScore}`
    );
    assert(
      fallbackLowConf.category === IssueCategory.FABRIC_DEFECT,
      'Resolves FABRIC_DEFECT from keyword scanning'
    );

    // -------------------------------------------------------------
    // Test Group 5: Database Persistence & HITL Review Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- Test Group 5: Database Persistence & Merchandiser HITL Gate ---');

    // Setup an order and production update
    const sampleOrder = await prisma.order.findFirst({
      where: { status: 'ACTIVE', deletedAt: null },
      include: { milestones: true },
    });

    if (!sampleOrder || sampleOrder.milestones.length === 0) {
      throw new Error('No active order found in database for persistence test');
    }

    const sampleSupervisor = await prisma.user.findFirst({
      where: { role: Role.SUPERVISOR },
    });
    const sampleMerchandiser = await prisma.user.findFirst({
      where: { role: Role.MERCHANDISER },
    });

    if (!sampleSupervisor || !sampleMerchandiser) {
      throw new Error('Required supervisor or merchandiser user missing from database');
    }

    const testUpdate = await prisma.productionUpdate.create({
      data: {
        idempotencyKey: `test_ai_${randomUUID()}`,
        orderId: sampleOrder.id,
        milestoneId: sampleOrder.milestones[0].id,
        supervisorId: sampleSupervisor.id,
        stage: sampleOrder.milestones[0].stage,
        goodQuantity: 100,
        rejectedQuantity: 5,
        notes: '2 மணி நேரம் eb off கரண்ட் இல்லை',
      },
    });

    // Run classification
    const classification = await AIService.classifyIssueNote(testUpdate.notes!, {
      orderId: sampleOrder.id,
      productionUpdateId: testUpdate.id,
    });

    // Persist to IssueClassification
    const persisted = await AIService.persistClassification(testUpdate.id, classification);

    assert(
      persisted.productionUpdateId === testUpdate.id,
      'Persisted IssueClassification record linked to production update'
    );
    assert(
      persisted.category === IssueCategory.POWER_OUTAGE,
      'Persisted category matches POWER_OUTAGE',
      `Got ${persisted.category}`
    );
    assert(
      persisted.rawTamilText === testUpdate.notes,
      'Persisted original raw Tamil/Tanglish text accurately'
    );
    assert(
      persisted.translatedText !== null && persisted.translatedText!.length > 0,
      'Persisted translated English text'
    );

    // Test Merchandiser HITL Queue Retrieval
    const queue = await AIService.getIssuesQueue({
      category: IssueCategory.POWER_OUTAGE,
      page: 1,
      limit: 10,
    });
    assert(queue.total > 0, `Issues queue successfully lists pending issues (total: ${queue.total})`);

    // Test Merchandiser HITL Override
    const overridden = await AIService.overrideClassification(
      persisted.id,
      IssueCategory.MACHINE_BREAKDOWN,
      sampleMerchandiser.id,
      'Floor supervisor mistakenly attributed generator mechanical motor fault to grid EB'
    );

    assert(
      overridden.category === IssueCategory.MACHINE_BREAKDOWN,
      'Merchandiser override updates category to MACHINE_BREAKDOWN',
      `Got ${overridden.category}`
    );
    assert(
      overridden.classifiedBy === 'MERCHANDISER_OVERRIDE',
      'classifiedBy updated to MERCHANDISER_OVERRIDE'
    );
    assert(
      overridden.isConfirmed === true,
      'isConfirmed flagged true after merchandiser override'
    );

    // Verify Audit Event logged for override
    const auditRecord = await prisma.auditEvent.findFirst({
      where: {
        action: 'OVERRIDE_ISSUE_CLASSIFICATION',
        entityId: sampleOrder.id,
      },
      orderBy: { timestamp: 'desc' },
    });

    assert(
      auditRecord !== null,
      'Tamper-evident AuditEvent created for classification override'
    );
    assert(
      auditRecord?.auditHash !== null,
      `Audit record contains cryptographic SHA-256 hash: ${auditRecord?.auditHash?.slice(0, 16)}...`
    );

    // Cleanup test record
    await prisma.issueClassification.delete({ where: { id: persisted.id } }).catch(() => {});
    await prisma.productionUpdate.delete({ where: { id: testUpdate.id } }).catch(() => {});
  } catch (error: any) {
    console.error('Test Suite encountered fatal error:', error);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAiFallbackTestSuite()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
