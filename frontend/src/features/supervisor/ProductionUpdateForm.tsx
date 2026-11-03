import React, { useState, useEffect, useRef } from 'react';
import {
  Stage,
  SupervisorWorkOrderItem,
  SupervisorActiveMilestone,
} from '../../types';
import {
  SUPERVISOR_ISSUE_CHIPS,
  STAGE_TRANSLATIONS,
  SUPERVISOR_I18N,
  Language,
  IssueChipItem,
} from './supervisorTranslations';
import {
  useTamilSpeechRecognition,
  SUPPORTED_SPEECH_LANGUAGES,
} from '../../hooks/useTamilSpeechRecognition';
import { compressImage, blobToBase64, formatByteSize } from '../../offline/compression';
import { enqueueFloorUpdate, isEffectiveOnline, generateUUIDv4 } from '../../offline/queue/queue';
import { apiRequest } from '../../services/api';
import { CustomSelect, Option } from '../../components/CustomSelect';
import {
  Mic,
  MicOff,
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Layers,
  Clock,
  Check,
  ChevronDown,
  Zap,
  Wrench,
  Scissors,
  Palette,
  Users,
  X,
} from 'lucide-react';

function getAiCategoryLabel(cat: string, lang: Language): string {
  switch (cat) {
    case 'POWER_OUTAGE':
      return lang === 'ta' ? 'மின்வெட்டு (Power Outage)' : 'Power Outage';
    case 'MACHINE_BREAKDOWN':
      return lang === 'ta' ? 'இயந்திரக் கோளாறு (Machine Breakdown)' : 'Machine Breakdown';
    case 'FABRIC_DEFECT':
      return lang === 'ta' ? 'நூல் / துணி குறைபாடு (Fabric Defect)' : 'Fabric Defect';
    case 'SUBCONTRACTOR_DELAY':
      return lang === 'ta' ? 'துணை ஒப்பந்த தாமதம் (Subcontractor Delay)' : 'Subcontractor Delay';
    case 'LABOUR_SHORTAGE':
      return lang === 'ta' ? 'ஆட்கள் பற்றாக்குறை (Labour Shortage)' : 'Labour Shortage';
    case 'QUALITY_HOLD':
      return lang === 'ta' ? 'தரக் கட்டுப்பாடு / தணிக்கை (Quality Hold)' : 'Quality Hold';
    case 'OTHER':
      return lang === 'ta' ? 'இதர குறிப்பு (Other Remark)' : 'Other Remark';
    default:
      return cat;
  }
}

interface ProductionUpdateFormProps {
  order: SupervisorWorkOrderItem;
  activeMilestone: SupervisorActiveMilestone;
  lang: Language;
  onSuccess: (message: string) => void;
  onCancel?: () => void;
}

export const ProductionUpdateForm: React.FC<ProductionUpdateFormProps> = ({
  order,
  activeMilestone,
  lang,
  onSuccess,
  onCancel,
}) => {
  const t = SUPERVISOR_I18N[lang];
  const [selectedStage, setSelectedStage] = useState<Stage>(activeMilestone.stage);
  const [shift, setShift] = useState<'DAY' | 'NIGHT'>('DAY');
  const [machineLine, setMachineLine] = useState('Line 1');

  // Production stage restriction: only applicable for current and immediate next stage, not previous
  const activeIndex = order.milestones.findIndex(
    (m) => m.stage === activeMilestone.stage || m.id === activeMilestone.id
  );
  const selectableMilestones = order.milestones.filter((_, idx) => {
    if (activeIndex === -1) return true;
    return idx === activeIndex || idx === activeIndex + 1;
  });

  const stageOptions: Option[] = selectableMilestones.map((m) => {
    const isCurrent = m.stage === activeMilestone.stage;
    return {
      value: m.stage,
      label: STAGE_TRANSLATIONS[m.stage]?.[lang] || m.stage,
      badge: isCurrent
        ? (lang === 'ta' ? 'தற்போது' : 'Current')
        : (lang === 'ta' ? 'அடுத்து' : 'Next Stage'),
    };
  });

  const machineLineOptions: Option[] = [
    { value: 'Line 1', label: lang === 'ta' ? 'வரிசை 1' : 'Line 1' },
    { value: 'Line 2', label: lang === 'ta' ? 'வரிசை 2' : 'Line 2' },
    { value: 'Line 3', label: lang === 'ta' ? 'வரிசை 3' : 'Line 3' },
    { value: 'Line 4', label: lang === 'ta' ? 'வரிசை 4' : 'Line 4' },
    { value: 'Subcontract', label: t.outsideUnit },
  ];

  // Quantities
  const [goodQty, setGoodQty] = useState<number>(0);
  const [rejectedQty, setRejectedQty] = useState<number>(0);

  // Per-size Breakdown state: orderLineId -> pcs logged this shift
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>({});

  // Initialize size breakdown map when order changes
  useEffect(() => {
    if (order.orderLines && order.orderLines.length > 0) {
      const initial: Record<string, number> = {};
      order.orderLines.forEach((line) => {
        initial[line.id] = 0;
      });
      setSizeQuantities(initial);
    }
  }, [order.orderId]);

  // Issues & Notes
  const [selectedChip, setSelectedChip] = useState<IssueChipItem | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [compressedPhoto, setCompressedPhoto] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoSizeLabel, setPhotoSizeLabel] = useState<string | null>(null);
  const [rawPhotoFile, setRawPhotoFile] = useState<File | null>(null);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);

  // Status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Speech Recognition Hook
  const {
    isListening,
    isSupported: isSpeechSupported,
    transcript,
    interimTranscript,
    error: speechError,
    speechLang,
    setSpeechLang,
    startListening,
    stopListening,
    resetTranscript,
  } = useTamilSpeechRecognition('ta-IN');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live AI Classification Preview (Upgradation 1: Real-Time Floor Note Intelligence)
  const [aiPreview, setAiPreview] = useState<{
    category: string;
    confidence: number;
    summary: string;
    classifiedBy: string;
    isLoading: boolean;
  } | null>(null);

  // Track original raw speech for transparency
  const [rawSpokenText, setRawSpokenText] = useState<string>('');

  const isListeningRef = useRef(isListening);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  /**
   * Normalizes colloquial Tamil number words into digits so entity extractors can parse quantities accurately.
   */
  const normalizeTamilSpeechNumbers = (text: string): string => {
    if (!text) return '';
    let normalized = text;
    const tamilWordMap: [RegExp, string][] = [
      [/ஒன்று|ஒரு\s*பீஸ்/gi, '1 '],
      [/இரண்டு|ரெண்டு/gi, '2 '],
      [/மூன்று|மூணு/gi, '3 '],
      [/நான்கு|நாலு/gi, '4 '],
      [/ஐந்து|அஞ்சு/gi, '5 '],
      [/ஆறு/gi, '6 '],
      [/ஏழு/gi, '7 '],
      [/எட்டு/gi, '8 '],
      [/ஒன்பது/gi, '9 '],
      [/பத்து/gi, '10 '],
      [/இருபது/gi, '20 '],
      [/முப்பது/gi, '30 '],
      [/நாற்பது/gi, '40 '],
      [/ஐம்பது/gi, '50 '],
      [/அறுபது/gi, '60 '],
      [/எழுபது/gi, '70 '],
      [/எண்பது/gi, '80 '],
      [/தொண்ணூறு/gi, '90 '],
      [/நூறு/gi, '100 '],
      [/இருநூறு/gi, '200 '],
      [/முந்நூறு/gi, '300 '],
      [/நானூறு/gi, '400 '],
      [/ஐந்நூறு/gi, '500 '],
      [/அறுநூறு/gi, '600 '],
      [/எழுநூறு/gi, '700 '],
      [/எண்ணூறு/gi, '800 '],
      [/தொள்ளாயிரம்/gi, '900 '],
      [/ஆயிரம்/gi, '1000 '],
      [/இரண்டாயிரம்/gi, '2000 '],
      [/மூவாயிரம்/gi, '3000 '],
      [/ஐந்தாயிரம்/gi, '5000 '],
    ];

    for (const [pattern, replacement] of tamilWordMap) {
      normalized = normalized.replace(pattern, replacement);
    }
    return normalized;
  };

  // Smart speech entity extractor: parses good quantity, rejected quantity, and issue reasons
  const parseAndAutofillFromSpeech = (rawText: string) => {
    if (!rawText.trim()) return;
    const spokenText = normalizeTamilSpeechNumbers(rawText);

    // 1. Extract Good Output Quantity
    // Matches patterns like "300 good outputs", "300 pieces done", "output 300", "completed 250 pcs", etc.
    // 1. Extract Good Output Quantity (Tamil, English, Hindi keywords)
    const goodQtyRegex =
      /(\d+)\s*(?:good\s*(?:output|outputs|pcs|pieces)?|output|outputs|pieces|pcs|completed|done|finished|பீஸ்|பீஸ்கள்|முடிந்தது|உற்பத்தி|தயார்|தயாரானது|நல்லது|tayar|banaya)/i;
    const goodQtyRegex2 =
      /(?:good\s*output|good\s*outputs|output|produced|done|completed|finished|உற்பத்தி|தயாரானது|முடிந்தது)\s*(?:is|was|were|of|ஆக)?\s*(\d+)/i;

    let extractedGood: number | null = null;
    const matchG1 = spokenText.match(goodQtyRegex);
    const matchG2 = spokenText.match(goodQtyRegex2);

    if (matchG1) {
      extractedGood = parseInt(matchG1[1], 10);
    } else if (matchG2) {
      extractedGood = parseInt(matchG2[1], 10);
    } else {
      const numMatch = spokenText.match(/(\d+)\s*(?:have\s*been\s*done|produced|made)/i);
      if (numMatch) extractedGood = parseInt(numMatch[1], 10);
    }

    // 2. Extract Rejected Quantity (Tamil, English, Hindi keywords)
    const rejRegex =
      /(\d+)\s*(?:reject|rejected|rejection|defect|defects|damaged|damage|waste|alteration|ரிஜெக்ட்|ரிஜக்ட்|கழிவு|சேதம்|குறைபாடு|வேஸ்ட்)/i;
    const rejRegex2 =
      /(?:reject|rejected|rejection|defect|defects|damaged|damage|ரிஜெக்ட்|கழிவு|சேதம்)\s*(?:is|was|were|of|ஆக)?\s*(\d+)/i;

    let extractedRej: number | null = null;
    const matchR1 = spokenText.match(rejRegex);
    const matchR2 = spokenText.match(rejRegex2);
    if (matchR1) extractedRej = parseInt(matchR1[1], 10);
    else if (matchR2) extractedRej = parseInt(matchR2[1], 10);

    if (extractedRej !== null && !isNaN(extractedRej) && extractedRej > 0) {
      setRejectedQty(extractedRej);
    }

    // 3. Extract Per-Size Breakdown with Order Context (handling "others are of XS", "50 of small", etc.)
    const targetLines = order.orderLines || [];
    const sizeMap: Record<string, number> = {};
    let totalExplicit = 0;
    let remainingTargetId: string | null = null;

    targetLines.forEach((line) => {
      const sUpper = line.size.toUpperCase();
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
          : line.size;

      const r1 = new RegExp(
        `(\\d+)(?:\\s+(?:pcs|pieces|are|hour|hours|of|good))+\\s+${sNamePattern}`,
        'i'
      );
      const r2 = new RegExp(`${sNamePattern}\\s*(?:is|was|were|of|:)?\\s*(\\d+)`, 'i');

      const m1 = spokenText.match(r1);
      const m2 = spokenText.match(r2);

      if (m1) {
        const q = parseInt(m1[1], 10);
        sizeMap[line.id] = q;
        totalExplicit += q;
      } else if (m2) {
        const q = parseInt(m2[1], 10);
        sizeMap[line.id] = q;
        totalExplicit += q;
      }

      const otherRegex = new RegExp(
        `(?:others?|remaining|rest|balance)(?:\\s+(?:are|is|of|for|in|the))+\\s+${sNamePattern}`,
        'i'
      );
      if (otherRegex.test(spokenText)) {
        remainingTargetId = line.id;
      }
    });

    if (extractedGood !== null && !isNaN(extractedGood) && extractedGood > 0) {
      setGoodQty(extractedGood);
      if (remainingTargetId && extractedGood > totalExplicit) {
        sizeMap[remainingTargetId] = extractedGood - totalExplicit;
      }
      if (Object.keys(sizeMap).length > 0) {
        setSizeQuantities((prev) => ({ ...prev, ...sizeMap }));
      } else {
        distributeTotalAcrossSizes(extractedGood);
      }
    } else if (Object.keys(sizeMap).length > 0) {
      setSizeQuantities((prev) => ({ ...prev, ...sizeMap }));
    }

    // 4. Extract Issue Reason & Auto-select Chip
    const lower = spokenText.toLowerCase();
    let matchedCategory: string | null = null;

    if (
      /machine\s*breakdown|needle\s*break|motor|cutter\s*jam|stitching\s*stop|overlock|mechanic|மெஷின்|ஊசி|ரிப்பேர்/i.test(
        lower
      )
    ) {
      matchedCategory = 'MACHINE_BREAKDOWN';
    } else if (/power\s*cut|power\s*outage|eb\s*off|generator|கரண்ட்|மின்சாரம்|மின்வெட்டு/i.test(lower)) {
      matchedCategory = 'POWER_OUTAGE';
    } else if (/fabric\s*defect|shade|gsm|dye|color\s*patch|hole|துணி|சாயம்/i.test(lower)) {
      matchedCategory = 'FABRIC_DEFECT';
    } else if (/subcontract|printing|washing|embroidery|gate\s*pass|challan|பிரிண்டிங்|வாஷிங்/i.test(lower)) {
      matchedCategory = 'SUBCONTRACTOR_DELAY';
    } else if (/labour\s*shortage|tailor\s*leave|tailor\s*shortage|operator\s*absent|workers\s*absent|ஆட்கள்|level\s*short\s*age|label\s*short\s*age/i.test(lower)) {
      matchedCategory = 'LABOUR_SHORTAGE';
    } else if (/quality\s*hold|audit\s*hold|measurement|rejection\s*high|ஆடிட்/i.test(lower)) {
      matchedCategory = 'QUALITY_HOLD';
    }

    if (matchedCategory) {
      const targetChip = SUPERVISOR_ISSUE_CHIPS.find((c) => c.category === matchedCategory);
      if (targetChip) {
        setSelectedChip(targetChip);
      }
    }
  };

  // Synchronize transcribed speech into notes input and autofill quantities/issues
  useEffect(() => {
    if (transcript) {
      setRawSpokenText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setNotes((prev) => {
        const trimmed = prev.trim();
        const combined = trimmed ? `${trimmed} ${transcript}` : transcript;
        parseAndAutofillFromSpeech(combined);
        return combined;
      });
      resetTranscript();
    }
  }, [transcript, resetTranscript]);

  // Debounced Live AI Classification Preview effect
  useEffect(() => {
    const trimmed = notes.trim();
    if (!trimmed || trimmed.length < 3) {
      setAiPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      setAiPreview((prev) => (prev ? { ...prev, isLoading: true } : { category: '', confidence: 0, summary: '', classifiedBy: '', isLoading: true }));

      // If client is currently offline, run local deterministic regex in browser
      if (!isEffectiveOnline()) {
        const lower = trimmed.toLowerCase();
        let cat = 'OTHER';
        if (/கரண்ட்|மின்சாரம்|power|eb\s*off/i.test(lower)) cat = 'POWER_OUTAGE';
        else if (/ஊசி|மெஷின்|motor|needle/i.test(lower)) cat = 'MACHINE_BREAKDOWN';
        else if (/துணி|சாயம்|gsm|shade|hole/i.test(lower)) cat = 'FABRIC_DEFECT';
        else if (/பிரிண்டிங்|வாஷிங்|printtex|gate\s*pass/i.test(lower)) cat = 'SUBCONTRACTOR_DELAY';
        else if (/ஆட்கள்|tailor|leave|shift\s*empty|labour\s*shortage|level\s*short\s*age/i.test(lower)) cat = 'LABOUR_SHORTAGE';
        else if (/ஆடிட்|rejection|measurement/i.test(lower)) cat = 'QUALITY_HOLD';

        setAiPreview({
          category: cat,
          confidence: 0.50,
          summary: `Offline Fallback: Identified ${cat}`,
          classifiedBy: 'LOCAL_OFFLINE_DICTIONARY',
          isLoading: false,
        });
        return;
      }

      try {
        const res = await apiRequest<{
          success: boolean;
          data: {
            category: string;
            confidenceScore: number;
            englishSummary: string;
            classifiedBy: string;
            totalGoodOutput?: number | null;
            totalRejected?: number | null;
            sizeBreakdown?: Record<string, number> | null;
          };
        }>('/ai/classify', {
          method: 'POST',
          body: JSON.stringify({
            rawText: trimmed,
            timeoutMs: 3000,
            orderId: order.orderId,
            context: {
              orderId: order.orderId,
              style: order.style,
              buyer: order.buyer?.name || (order as any).buyerName,
              stage: selectedStage,
              sizes: order.orderLines?.map((l) => l.size) || [],
              colors: order.orderLines?.map((l) => l.color) || [],
            },
          }),
        });

        if (res.data) {
          setAiPreview({
            category: res.data.category,
            confidence: res.data.confidenceScore,
            summary: res.data.englishSummary,
            classifiedBy: res.data.classifiedBy,
            isLoading: false,
          });

          // Autofill good quantity if returned
          if (res.data.totalGoodOutput && res.data.totalGoodOutput > 0) {
            setGoodQty(res.data.totalGoodOutput);
          }

          // Autofill rejected quantity if returned
          if (res.data.totalRejected && res.data.totalRejected > 0) {
            setRejectedQty(res.data.totalRejected);
          }

          // Autofill per-size breakdown directly matching order lines
          if (res.data.sizeBreakdown && Object.keys(res.data.sizeBreakdown).length > 0) {
            const updatedSizes: Record<string, number> = {};
            order.orderLines?.forEach((line) => {
              const matchKey = Object.keys(res.data.sizeBreakdown!).find(
                (k) => k.toUpperCase() === line.size.toUpperCase()
              );
              if (matchKey !== undefined) {
                updatedSizes[line.id] = res.data.sizeBreakdown![matchKey];
              }
            });
            if (Object.keys(updatedSizes).length > 0) {
              setSizeQuantities((prev) => ({ ...prev, ...updatedSizes }));
            }
          }

          // Auto-select issue chip
          if (res.data.category) {
            const chip = SUPERVISOR_ISSUE_CHIPS.find((c) => c.category === res.data.category);
            if (chip) setSelectedChip(chip);
          }
        }
      } catch {
        setAiPreview({
          category: 'FALLBACK',
          confidence: 0.50,
          summary: 'Deterministic local fallback active',
          classifiedBy: 'LOCAL_REGEX_FALLBACK',
          isLoading: false,
        });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [notes, order.orderId, selectedStage]);

  // Haptic feedback helper for mobile touch
  const triggerHaptic = (ms = 40) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        // ignore
      }
    }
  };

  // Helper to distribute a total goodQty proportionally across order lines
  const distributeTotalAcrossSizes = (total: number) => {
    if (!order.orderLines || order.orderLines.length === 0) return;
    const totalRemaining = order.orderLines.reduce(
      (acc, l) => acc + Math.max(1, l.plannedQty - l.completedQty),
      0
    );
    const updated: Record<string, number> = {};
    let allocated = 0;
    order.orderLines.forEach((l, idx) => {
      if (idx === order.orderLines.length - 1) {
        updated[l.id] = Math.max(0, total - allocated);
      } else {
        const remaining = Math.max(1, l.plannedQty - l.completedQty);
        const share = Math.round((remaining / totalRemaining) * total);
        updated[l.id] = share;
        allocated += share;
      }
    });
    setSizeQuantities(updated);
  };

  // Per-size input change handler
  const handleSizeChange = (lineId: string, val: number) => {
    triggerHaptic(25);
    const updated = { ...sizeQuantities, [lineId]: Math.max(0, val) };
    setSizeQuantities(updated);
    const sum = Object.values(updated).reduce((acc, curr) => acc + curr, 0);
    setGoodQty(sum);
    setFormError(null);
  };

  // Per-size quick increment handler
  const handleSizeAdd = (lineId: string, delta: number) => {
    triggerHaptic(35);
    const current = sizeQuantities[lineId] || 0;
    handleSizeChange(lineId, current + delta);
  };

  // Quick increment handlers for overall Good Quantity
  const handleAddGoodQty = (amount: number) => {
    triggerHaptic(40);
    const newTotal = Math.max(0, goodQty + amount);
    setGoodQty(newTotal);
    distributeTotalAcrossSizes(newTotal);
    setFormError(null);
  };

  const handleResetGoodQty = () => {
    triggerHaptic(30);
    setGoodQty(0);
    if (order.orderLines && order.orderLines.length > 0) {
      const resetMap: Record<string, number> = {};
      order.orderLines.forEach((l) => {
        resetMap[l.id] = 0;
      });
      setSizeQuantities(resetMap);
    }
  };

  // Quick increment handlers for Rejected Quantity
  const handleAddRejectedQty = (amount: number) => {
    triggerHaptic(40);
    setRejectedQty((prev) => Math.max(0, prev + amount));
  };

  const handleResetRejectedQty = () => {
    triggerHaptic(30);
    setRejectedQty(0);
  };

  // Issue Chip toggle
  const handleToggleChip = (chip: IssueChipItem) => {
    triggerHaptic(50);
    if (selectedChip?.id === chip.id) {
      setSelectedChip(null);
    } else {
      setSelectedChip(chip);
      const chipText = lang === 'ta' ? chip.labelTa : chip.labelEn;
      if (!notes.includes(chipText)) {
        setNotes((prev) => (prev ? `${prev} [${chipText}]` : `[${chipText}]`));
      }
    }
  };

  // Helper to render pure Lucide SVG icons instead of emojis
  const renderChipIcon = (iconType: string) => {
    switch (iconType) {
      case 'zap':
        return <Zap className="w-5 h-5 text-amber-500" />;
      case 'wrench':
        return <Wrench className="w-5 h-5 text-sky-600" />;
      case 'scissors':
        return <Scissors className="w-5 h-5 text-rose-500" />;
      case 'palette':
        return <Palette className="w-5 h-5 text-purple-600" />;
      case 'users':
        return <Users className="w-5 h-5 text-indigo-600" />;
      case 'clock':
        return <Clock className="w-5 h-5 text-orange-500" />;
      default:
        return <Sparkles className="w-5 h-5 text-amber-500" />;
    }
  };

  // Photo compression handler (Client-Side Canvas, max 1024px, WebP ~85 KB)
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressingPhoto(true);
      setRawPhotoFile(file);
      const blob = await compressImage(file, 1024, 0.72);
      setPhotoBlob(blob);
      setPhotoSizeLabel(formatByteSize(blob.size));
      const base64Preview = await blobToBase64(blob);
      setCompressedPhoto(base64Preview);
      triggerHaptic(60);
    } catch (err: any) {
      setFormError(`Photo error: ${err.message || 'Failed to compress photo'}`);
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  // Voice recording toggle
  const handleToggleVoice = () => {
    triggerHaptic(50);
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (goodQty <= 0 && rejectedQty <= 0 && !notes.trim() && !selectedChip) {
      setFormError(t.validationErrorQty);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const targetMilestone =
      order.milestones.find((m) => m.stage === selectedStage) || activeMilestone;

    // Prepare per-size breakdown array for database and offline queue
    const sizeBreakdownLines =
      order.orderLines && order.orderLines.length > 0
        ? order.orderLines
            .map((line) => ({
              orderLineId: line.id,
              goodQuantity: sizeQuantities[line.id] || 0,
              rejectedQuantity: 0,
            }))
            .filter((l) => l.goodQuantity > 0 || l.rejectedQuantity > 0)
        : undefined;

    // Save exclusively in clean English translation as requested
    const englishText = aiPreview?.summary
      ? aiPreview.summary
      : notes.includes('[English:')
      ? notes.split('[English:')[1]?.replace(/\]$/, '').trim()
      : notes.trim();

    const finalFormattedNote = englishText || undefined;

    const payload = {
      orderId: order.orderId,
      poNumber: order.poNumber,
      style: order.style,
      milestoneId: targetMilestone.id,
      stage: selectedStage,
      shift,
      machineLine,
      goodQuantity: goodQty,
      rejectedQuantity: rejectedQty,
      notes: finalFormattedNote,
      issueCategory: selectedChip?.category || undefined,
      compressedPhotoBase64: compressedPhoto || undefined,
      clientEventAt: new Date().toISOString(),
      sizeBreakdownLines,
    };

    try {
      if (isEffectiveOnline()) {
        try {
          await apiRequest('/production/updates', {
            method: 'POST',
            body: JSON.stringify({
              ...payload,
              idempotencyKey: generateUUIDv4(),
            }),
          });
          triggerHaptic(100);
          onSuccess(
            lang === 'ta'
              ? `ஆர்டர் #${order.poNumber} க்கு வெற்றிகரமாக பதிவாகியது!`
              : `Successfully logged update for ${order.poNumber}!`
          );
          return;
        } catch (apiErr: any) {
          // Check if this is an actual network connectivity failure (fetch failed / status 0)
          const isNetworkError =
            apiErr.status === 0 ||
            !navigator.onLine ||
            apiErr.message?.includes('Network request failed') ||
            apiErr.message?.includes('Failed to fetch') ||
            apiErr.name === 'TypeError';

          if (isNetworkError) {
            console.warn('Network failure detected, saving to offline queue:', apiErr);
            await enqueueFloorUpdate({
              orderId: order.orderId,
              poNumber: order.poNumber,
              style: order.style,
              milestoneId: targetMilestone.id,
              stage: selectedStage,
              shift,
              machineLine,
              goodQty,
              rejectedQty,
              notes: finalFormattedNote || null,
              issueCategory: selectedChip?.category || null,
              photoFile: rawPhotoFile,
              sizeBreakdownLines,
              cacheKey: `work_${order.unit?.id || 'default'}`,
            });
            triggerHaptic(80);
            onSuccess(
              lang === 'ta'
                ? `நெட்வொர்க் இணைப்பு துண்டிக்கப்பட்டது. பதிவு ஆஃப்லைன் வரிசையில் சேர்க்கப்பட்டது.`
                : `Network dropped. Saved to Offline Queue (Auto-syncs when online)!`
            );
            return;
          }

          // If server was reached and responded with HTTP error (e.g. 400 validation error, tolerance ceiling, etc.):
          // Do NOT save to offline queue! Show the actual server error to the user!
          console.error('Server rejected production update:', apiErr);
          setFormError(apiErr.message || 'Server error occurred during submission');
          setIsSubmitting(false);
          return;
        }
      } else {
        await enqueueFloorUpdate({
          orderId: order.orderId,
          poNumber: order.poNumber,
          style: order.style,
          milestoneId: targetMilestone.id,
          stage: selectedStage,
          shift,
          machineLine,
          goodQty,
          rejectedQty,
          notes: finalFormattedNote || null,
          issueCategory: selectedChip?.category || null,
          photoFile: rawPhotoFile,
          sizeBreakdownLines,
          cacheKey: `work_${order.unit?.id || 'default'}`,
        });
        triggerHaptic(80);
        onSuccess(
          lang === 'ta'
            ? `ஆஃப்லைன் பதிவு சேமிக்கப்பட்டது! இணையம் வந்ததும் தானாக சர்வரில் சேரும்.`
            : `Saved offline! Will automatically synchronize once back online.`
        );
      }
    } catch (err: any) {
      setFormError(err.message || 'Submission error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Target PO Header Card (Preserves authentic commercial buyer & product names) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {order.buyer.name}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            {order.poNumber}
          </span>
        </div>
        <div className="text-base font-extrabold text-slate-900 truncate">
          {order.style}
        </div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">
          {order.description || (lang === 'ta' ? 'ஏற்றுமதி பின்னலாடை ஆர்டர்' : 'Export Knitwear Style')}
        </div>

        {/* Stage Selector (Restricted to current stage and immediate next stage only) */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            {t.stageLabel}:
          </div>
          <div className="w-full sm:w-64">
            <CustomSelect
              value={selectedStage}
              options={stageOptions}
              onChange={(val) => setSelectedStage(val as Stage)}
              placeholder="Select Stage"
              buttonClassName="bg-slate-100 hover:bg-slate-200/80 border-slate-200 py-1.5 text-xs font-bold"
            />
          </div>
        </div>
      </div>

      {/* Shift & Line Selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Shift Toggle */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-2 shadow-2xs">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>{t.shiftLabel}:</span>
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(30);
                setShift('DAY');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                shift === 'DAY'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.shiftDay}
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(30);
                setShift('NIGHT');
              }}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                shift === 'NIGHT'
                  ? 'bg-indigo-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.shiftNight}
            </button>
          </div>
        </div>

        {/* Machine Line Selector with CustomSelect & comfortable spacing */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-3 shadow-2xs">
          <span className="text-xs font-bold text-slate-700 shrink-0">{t.lineSelector}:</span>
          <div className="flex-1 max-w-[170px]">
            <CustomSelect
              value={machineLine}
              options={machineLineOptions}
              onChange={(val) => setMachineLine(val)}
              placeholder="Select Line"
              buttonClassName="bg-slate-100 hover:bg-slate-200/80 border-slate-200 py-1.5 text-xs font-bold"
            />
          </div>
        </div>
      </div>

      {/* PER-SIZE BREAKDOWN CARD (S, M, L, XL Separately) */}
      {order.orderLines && order.orderLines.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>{t.sizeBreakdownTitle}</span>
            </span>
            <span className="text-[11px] font-bold text-slate-400">
              {order.orderLines.length} {t.sizesCount}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 mb-3">
            {lang === 'ta'
              ? 'அளவுகள் வாரியாக (S, M, L, XL) எண்ணிக்கையை தனித்தனியாக உள்ளிடவும்:'
              : 'Log output per size individually (S, M, L, XL):'}
          </p>

          <div className="space-y-2.5">
            {order.orderLines.map((line) => {
              const lineQty = sizeQuantities[line.id] || 0;
              const isDone = line.completedQty >= line.plannedQty;
              const pct =
                line.plannedQty > 0
                  ? Math.min(100, Math.round((line.completedQty / line.plannedQty) * 100))
                  : 0;

              return (
                <div
                  key={line.id}
                  className="p-3 bg-slate-50/90 rounded-xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Size Label & Planning Progress */}
                  <div className="flex-1 min-w-[130px]">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-black text-xs font-mono tracking-wider shadow-xs">
                        {line.size}
                      </span>
                      {line.color && (
                        <span className="text-[11px] font-semibold text-slate-600 truncate max-w-[120px]">
                          {line.color}
                        </span>
                      )}
                      {isDone && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                          <span>{lang === 'ta' ? 'முடிந்தது' : 'Done'}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
                      <span>{t.completedPcs}:</span>
                      <span className="font-bold text-slate-800">
                        {line.completedQty.toLocaleString()} / {line.plannedQty.toLocaleString()}
                      </span>
                      <span className="text-slate-400">({pct}%)</span>
                    </div>
                  </div>

                  {/* Size Input & Quick Increment Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <div className="relative w-24">
                      <input
                        type="number"
                        min={0}
                        value={lineQty === 0 ? '' : lineQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          handleSizeChange(line.id, isNaN(val) ? 0 : val);
                        }}
                        placeholder="0"
                        className="w-full text-center text-sm font-black text-slate-900 bg-white border border-slate-300 rounded-lg py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono shadow-inner"
                      />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none">
                        {t.pieces}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      {[10, 25, 50].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleSizeAdd(line.id, amt)}
                          className="px-2 py-1.5 bg-white hover:bg-sky-50 active:scale-95 text-sky-800 font-bold text-xs rounded-lg border border-slate-200 shadow-2xs transition-all cursor-pointer"
                        >
                          +{amt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* GOOD OUTPUT QUANTITY COUNTER (Compact Single-Row matching Rejections) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            {t.goodQuantity}
          </span>
          {goodQty > 0 && (
            <button
              type="button"
              onClick={handleResetGoodQty}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-600 px-2 py-0.5 rounded cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              {t.reset}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min={0}
              value={goodQty === 0 ? '' : goodQty}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                const safeVal = isNaN(val) ? 0 : Math.max(0, val);
                setGoodQty(safeVal);
                distributeTotalAcrossSizes(safeVal);
                setFormError(null);
              }}
              placeholder="0"
              className="w-full text-center text-2xl font-black text-emerald-800 bg-emerald-50 border-2 border-emerald-200 rounded-xl py-2 px-3 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-inner font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 pointer-events-none">
              {t.pieces.toUpperCase()}
            </span>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleAddGoodQty(50)}
              className="min-h-[46px] px-4 bg-slate-100 hover:bg-emerald-600 hover:text-white active:scale-95 text-emerald-800 font-black text-sm rounded-xl border border-slate-300 transition-all cursor-pointer shadow-2xs"
            >
              +50
            </button>
          </div>
        </div>
      </div>

      {/* REJECTED QUANTITY COUNTER (Defective output - Cursor-wise Editable) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-black uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            {t.rejectedQuantity}
          </span>
          {rejectedQty > 0 && (
            <button
              type="button"
              onClick={handleResetRejectedQty}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-600 px-2 py-0.5 rounded cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              {t.reset}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min={0}
              value={rejectedQty === 0 ? '' : rejectedQty}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setRejectedQty(isNaN(val) ? 0 : Math.max(0, val));
              }}
              placeholder="0"
              className="w-full text-center text-2xl font-black text-rose-700 bg-rose-50 border-2 border-rose-200 rounded-xl py-2 px-3 focus:outline-none focus:border-rose-500 focus:bg-white transition-all shadow-inner font-mono"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-400 pointer-events-none">
              {t.pieces}
            </span>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleAddRejectedQty(5)}
              className="min-h-[46px] px-4 bg-slate-100 hover:bg-rose-100 active:scale-95 text-rose-800 font-black text-sm rounded-xl border border-slate-300 transition-all cursor-pointer shadow-2xs"
            >
              +5
            </button>
          </div>
        </div>
      </div>

      {/* 6 VISUAL ISSUE CHIPS (Lucide SVG Icons - No Emojis) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t.issueChipsTitle}
          </span>
          {selectedChip && (
            <button
              type="button"
              onClick={() => setSelectedChip(null)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
            >
              {t.clear}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SUPERVISOR_ISSUE_CHIPS.map((chip) => {
            const isSelected = selectedChip?.id === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => handleToggleChip(chip)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-amber-100 border-amber-500 shadow-md ring-2 ring-amber-400/50'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="p-1 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                    {renderChipIcon(chip.iconType)}
                  </div>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div className="text-xs font-extrabold text-slate-900 leading-tight">
                  {lang === 'ta' ? chip.labelTa : chip.labelEn}
                </div>
                <div className="text-[10px] text-slate-500 leading-tight mt-0.5">
                  {lang === 'ta' ? chip.subtextTa : chip.subtextEn}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* VOICE-TO-TEXT & NOTES (Multi-Lingual Speech Engine with Language Selector) */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-800">
              {t.notesVoiceTitle}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              AI Voice & Text
            </span>
          </div>

          {/* Voice Language Switcher: Explicitly tunes SpeechRecognition to Tamil, English, or Hindi */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Voice:</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 shadow-2xs">
              {SUPPORTED_SPEECH_LANGUAGES.map((sl) => (
                <button
                  key={sl.code}
                  type="button"
                  onClick={() => setSpeechLang(sl.code)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                    speechLang === sl.code
                      ? 'bg-[#0C2D48] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title={`Switch microphone speech recognizer to ${sl.label} (${sl.code})`}
                >
                  {sl.native}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Voice Recognition Control: Microphone Button */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleToggleVoice}
            disabled={!isSpeechSupported}
            className={`w-full min-h-[52px] rounded-xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-sm cursor-pointer ${
              isListening
                ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                : 'bg-indigo-50 border-2 border-indigo-200 text-indigo-900 hover:bg-indigo-100 active:scale-98'
            }`}
          >
            {isListening ? (
              <>
                <MicOff className="w-5 h-5 text-white animate-bounce" />
                <span>
                  {speechLang === 'ta-IN'
                    ? 'கேட்கிறது... தமிழில் பேசுங்கள் (Tap to Stop)'
                    : speechLang === 'hi-IN'
                    ? 'सुन रहा है... हिंदी में बोलें (Tap to Stop)'
                    : 'Listening... Speak in English (Tap to Stop)'}
                </span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 text-indigo-700" />
                <span>
                  {speechLang === 'ta-IN'
                    ? 'தமிழில் பேசவும் (Tap to Speak in Tamil)'
                    : speechLang === 'hi-IN'
                    ? 'हिंदी में बोलें (Tap to Speak in Hindi)'
                    : 'Tap to Speak in English'}
                </span>
              </>
            )}
          </button>

          {/* Quick Tamil speech prompt templates */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[10px] font-bold text-slate-400">உதாரணம் (Examples):</span>
            <button
              type="button"
              onClick={() => {
                const sample = 'இன்று 400 பீஸ் முடிந்தது 10 ரிஜெக்ட்';
                setNotes(sample);
                parseAndAutofillFromSpeech(sample);
              }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              "400 பீஸ் முடிந்தது 10 ரிஜெக்ட்"
            </button>
            <button
              type="button"
              onClick={() => {
                const sample = '350 தயார் இயந்திர கோளாறு காரணமாக தாமதம்';
                setNotes(sample);
                parseAndAutofillFromSpeech(sample);
              }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              "350 தயார் இயந்திர கோளாறு"
            </button>
          </div>

          {/* Interim speech transcript live preview */}
          {isListening && interimTranscript && (
            <div className="p-2.5 bg-indigo-50/80 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-950 italic flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              <span>"{interimTranscript}..."</span>
            </div>
          )}

          {speechError && (
            <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold">
              {speechError}
            </div>
          )}
        </div>

        {/* Notes Textarea */}
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t.notesPlaceholder}
          className="w-full text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:bg-white resize-none"
        />

        {/* Live AI Classification Preview Badge */}
        {aiPreview && (
          <div className="mt-2.5 p-2.5 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 to-blue-50/90 shadow-2xs transition-all animate-fadeIn">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Sparkles
                  className={`w-3.5 h-3.5 flex-shrink-0 ${
                    aiPreview.isLoading ? 'text-amber-500 animate-spin' : 'text-indigo-600'
                  }`}
                />
                <span className="text-[11px] font-black text-slate-800 truncate">
                  {aiPreview.isLoading
                    ? lang === 'ta'
                      ? 'AI பகுப்பாய்வு செய்கிறது...'
                      : 'AI Analyzing...'
                    : getAiCategoryLabel(aiPreview.category, lang)}
                </span>
              </div>
            </div>
            {aiPreview.summary && !aiPreview.isLoading && (
              <div className="mt-2 pt-2 border-t border-indigo-200/60">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Clean English Note
                </div>
                <div className="text-xs font-bold text-slate-900 bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs whitespace-pre-wrap leading-relaxed">
                  {aiPreview.summary}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Client-Side Canvas Compressed Photo Capture */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handlePhotoSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isCompressingPhoto}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <Camera className="w-4 h-4 text-slate-600" />
            {isCompressingPhoto ? (lang === 'ta' ? 'சுருக்கப்படுகிறது...' : 'Compressing...') : t.takePhoto}
          </button>

          {compressedPhoto && (
            <div className="flex items-center gap-2">
              <img
                src={compressedPhoto}
                alt="Floor capture"
                className="w-9 h-9 object-cover rounded-lg border border-emerald-400 shadow-sm"
              />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-emerald-700">
                  {t.photoAttached}
                </span>
                <span className="text-[9px] font-mono text-slate-500">
                  {photoSizeLabel ? `${photoSizeLabel} WebP` : '~85 KB'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCompressedPhoto(null);
                  setPhotoBlob(null);
                  setPhotoSizeLabel(null);
                  setRawPhotoFile(null);
                }}
                className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                title="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{formError}</span>
        </div>
      )}

      {/* SUBMIT BUTTON */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[56px] bg-slate-900 hover:bg-black active:scale-[0.98] text-white font-black text-base rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? (
            <span>{t.submitting}</span>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>{t.submitShiftUpdate}</span>
            </>
          )}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full mt-2 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 text-center cursor-pointer"
          >
            {t.cancel}
          </button>
        )}
      </div>
    </form>
  );
};
