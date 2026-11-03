export type Language = 'ta' | 'en';

export interface IssueChipItem {
  id: string;
  category: string;
  iconType: 'zap' | 'wrench' | 'scissors' | 'palette' | 'users' | 'clock';
  labelTa: string;
  labelEn: string;
  subtextTa: string;
  subtextEn: string;
}

export const SUPERVISOR_ISSUE_CHIPS: IssueChipItem[] = [
  {
    id: 'power_outage',
    category: 'POWER_OUTAGE',
    iconType: 'zap',
    labelTa: 'மின்வெட்டு',
    labelEn: 'Power Outage',
    subtextTa: 'ஜெனரேட்டர் / EB சப்ளை நின்றது',
    subtextEn: 'EB cut or generator fuel delay',
  },
  {
    id: 'machine_breakdown',
    category: 'MACHINE_BREAKDOWN',
    iconType: 'wrench',
    labelTa: 'ஊசி உடைவு',
    labelEn: 'Machine Breakdown',
    subtextTa: 'ஊசி / மோட்டார் பழுது',
    subtextEn: 'Needle / motor mechanical fault',
  },
  {
    id: 'fabric_defect',
    category: 'FABRIC_DEFECT',
    iconType: 'scissors',
    labelTa: 'நூல்/துணி குறை',
    labelEn: 'Fabric Defect',
    subtextTa: 'துணி ஓட்டை / GSM வேரியேஷன்',
    subtextEn: 'Yarn holes or GSM skew',
  },
  {
    id: 'dyeing_delay',
    category: 'FABRIC_DEFECT',
    iconType: 'palette',
    labelTa: 'சாயம் பழுது',
    labelEn: 'Dyeing Delay',
    subtextTa: 'சாயம் குறை / வாஷிங் தாமதம்',
    subtextEn: 'Shade variation / wash batch wait',
  },
  {
    id: 'labour_shortage',
    category: 'LABOUR_SHORTAGE',
    iconType: 'users',
    labelTa: 'ஆட்கள் பற்றாக்குறை',
    labelEn: 'Labour Shortage',
    subtextTa: 'தையல் கலைஞர்கள் லீவு',
    subtextEn: 'Operators / tailors on leave',
  },
  {
    id: 'subcontractor_delay',
    category: 'SUBCONTRACTOR_DELAY',
    iconType: 'clock',
    labelTa: 'தாமதம்',
    labelEn: 'Subcontractor Delay',
    subtextTa: 'பிரிண்டிங் / வாஷிங் இன்னும் வரல',
    subtextEn: 'Outside lot not returned on gate pass',
  },
];

export const STAGE_TRANSLATIONS: Record<string, { ta: string; en: string }> = {
  KNITTING: { ta: 'பின்னல்', en: 'Knitting' },
  DYEING_WASHING: { ta: 'சலவை / சாயம்', en: 'Dyeing & Washing' },
  PRINTING: { ta: 'அச்சிடுதல்', en: 'Printing' },
  CUTTING: { ta: 'வெட்டுதல்', en: 'Cutting' },
  STITCHING: { ta: 'தையல்', en: 'Stitching' },
  CHECKING: { ta: 'சரிபார்த்தல்', en: 'Checking' },
  FINISHING: { ta: 'முடித்தல் & பேக்கிங்', en: 'Finishing' },
};

// ==========================================
// Product, Style & Buyer Translations
// ==========================================

export const STYLE_TRANSLATIONS: Record<string, string> = {
  'Waffle Knit Henley': 'வாஃபிள் நிட் ஹென்லி டி-சர்ட்',
  'Striped Interlock Polo': 'கோடு போட்ட இன்டர்லாக் போலோ சட்டை',
  "Men's Polo White": 'ஆண்கள் வெள்ளை போலோ சட்டை',
  "Men's Crew Neck Tee Navy": 'ஆண்கள் குரூ நெக் நேவி டி-சர்ட்',
  'Organic Rib Tank': 'ஆர்கானிக் ரிப் டேங்க் டாப்',
  'Kids Printed Tee Yellow': 'சிறுவர் அச்சிட்ட மஞ்சள் டி-சர்ட்',
  'Womens French Terry Hoodie': 'பெண்கள் பிரெஞ்ச் டெர்ரி ஹூடி',
  'Boys Pique Polo Royal Blue': 'சிறுவர்கள் பிகே போலோ ராயல் ப்ளூ',
  'Girls Printed Cotton Tee': 'சிறுமிகள் அச்சிட்ட பருத்தி டீ',
};

export const DESCRIPTION_TRANSLATIONS: Record<string, string> = {
  'Thermal waffle knit long sleeve henley with coconut buttons':
    'தேங்காய் ஓடு பட்டன்களுடன் கூடிய நீண்ட கை வாஃபிள் பின்னல் ஹென்லி',
  'Yarn-dyed feeder stripe interlock polo with flat knit collar':
    'நூல் சாயம் பூசப்பட்ட இன்டர்லாக் கோடு போலோ காலர் சட்டை',
  '100% Combed Cotton Pique Polo with Ribbed Collar and Placket':
    '100% தூய சீப்புப் பருத்தி பிகே காலர் மற்றும் பிளாக்கெட் போலோ',
  '180 GSM Single Jersey with Lycra Rib Neck':
    '180 ஜிஎஸ்எம் லைக்ரா ரிப் நெக் ஒற்றை ஜெர்சி',
  '2x2 Stretch Rib Tank Top in Vintage Olive':
    'வின்டேஜ் ஆலிவ் நிற 2x2 ஸ்ட்ரெட்ச் ரிப் டேங்க் டாப்',
  'Organic Cotton Single Jersey with Chest Pigment Screen Print':
    'மார்பு அச்சுடன் கூடிய ஆர்கானிக் பருத்தி ஜெர்சி',
  'French terry lightweight casual pullover with kangaroo pocket':
    'கங்காரு பாக்கெட்டுடன் கூடிய இலகுரக சாதாரண புல்ஓவர் ஹூடி',
};

export const BUYER_TRANSLATIONS: Record<string, string> = {
  'Company B': 'கம்பெனி B',
  'Company B (UK)': 'கம்பெனி B (இங்கிலாந்து)',
  'Company C': 'கம்பெனி C',
  'Company C (Germany)': 'கம்பெனி C (ஜெர்மனி)',
  'Company A': 'கம்பெனி A',
};

export const UNIT_TRANSLATIONS: Record<string, string> = {
  'Unit 1 (Cotton Hub - Own)': 'பிரிவு 1 (காட்டன் ஹப் - சொந்தப் பிரிவு)',
  'Unit 2 (Knitting & Processing - Own)': 'பிரிவு 2 (பின்னல் & செயலாக்கம் - சொந்தப் பிரிவு)',
  'Unit 3 (Garmenting & Export - Own)': 'பிரிவு 3 (ஆடை தயாரிப்பு & ஏற்றுமதி - சொந்தப் பிரிவு)',
  'PrintTex Subcontract': 'பிரிண்ட்-டெக்ஸ் (துணை ஒப்பந்த அச்சிடுதல்)',
  'WashTex Subcontract': 'வாஷ்-டெக்ஸ் (துணை ஒப்பந்த சலவை)',
  'Unit 1': 'பிரிவு 1',
  'Unit 2': 'பிரிவு 2',
  'Unit 3': 'பிரிவு 3',
};

export const ROLE_TRANSLATIONS: Record<string, string> = {
  MERCHANDISER: 'வணிகப் பொறுப்பாளர்',
  SUPERVISOR: 'தள மேற்பார்வையாளர்',
  BUYER: 'வாங்குபவர்',
  ADMIN: 'முதன்மை நிர்வாகி',
};

export function translateStyle(style: string, lang: Language): string {
  if (lang !== 'ta') return style;
  return STYLE_TRANSLATIONS[style] || style;
}

export function translateDescription(desc: string | null | undefined, lang: Language): string {
  if (!desc) return '';
  if (lang !== 'ta') return desc;
  return DESCRIPTION_TRANSLATIONS[desc] || desc;
}

export function translateBuyer(buyerName: string, lang: Language): string {
  if (lang !== 'ta') return buyerName;
  return BUYER_TRANSLATIONS[buyerName] || buyerName.replace('(UK)', '(இங்கிலாந்து)').replace('(Germany)', '(ஜெர்மனி)');
}

export function translateUnit(unitName: string | null | undefined, lang: Language): string {
  if (!unitName) return '';
  if (lang !== 'ta') return unitName;
  return UNIT_TRANSLATIONS[unitName] || unitName.replace('Unit', 'பிரிவு').replace('Own', 'சொந்தப் பிரிவு');
}

export function translateRole(role: string, lang: Language): string {
  if (lang !== 'ta') return role;
  return ROLE_TRANSLATIONS[role] || role;
}

export function formatPieces(qty: number, lang: Language): string {
  const num = qty.toLocaleString();
  return lang === 'ta' ? `${num} துண்டுகள்` : `${num} pcs`;
}

export function formatDateLocalized(dateInput: string | Date, lang: Language): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';

  if (lang === 'ta') {
    const monthsTa = [
      'ஜன', 'பிப்', 'மார்ச்', 'ஏப்', 'மே', 'ஜூன்',
      'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'
    ];
    const day = String(d.getDate()).padStart(2, '0');
    const month = monthsTa[d.getMonth()];
    const year = d.getFullYear();
    return `${month} ${day}, ${year}`;
  }

  return d.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ==========================================
// UI Localization Dictionary
// ==========================================

export const SUPERVISOR_I18N = {
  ta: {
    appTitle: 'தொழிற்சாலை உற்பத்தி தளம்',
    subHeader: 'திருப்பூர் பின்னலாடை உற்பத்தி',
    pageSubtitle: 'நடப்பு உற்பத்தி ஆர்டர்கள் மற்றும் மேற்பார்வையாளர் ஷிப்ட் பதிவுகள்',
    assignedUnit: 'ஒதுக்கப்பட்ட பிரிவு',
    activeOrders: 'நடப்பு ஆர்டர்கள்',
    myWork: 'தளப் பணி',
    shiftDay: 'பகல்',
    shiftNight: 'இரவு',
    stageLabel: 'உற்பத்தி நிலை',
    goodQuantity: 'முடிந்த நல்ல துணிகள்',
    rejectedQuantity: 'நிராகரிக்கப்பட்ட குறைபாடுகள் (Reject)',
    reset: 'மீட்டமை (0)',
    quickAdd: 'விரைவு சேர்ப்பு',
    issueChipsTitle: 'தள சிக்கல்கள் (தேர்ந்தெடுக்கவும்)',
    notesPlaceholder: 'சிக்கல்கள் அல்லது விபரங்களை இங்கே குறிப்பிடவும் அல்லது குரல் பதிவு செய்யவும்...',
    voiceStart: 'தமிழில் பேசவும் (மைக்)',
    voiceListening: 'கேட்கிறது... தமிழில் பேசுங்கள்',
    voiceStop: 'முடிக்கவும்',
    voiceNotSupported: 'உங்கள் உலாவியில் குரல் வசதி இல்லை',
    takePhoto: 'சேதமடைந்த துணி படம் எடுக்கவும்',
    photoAttached: 'படம் இணைக்கப்பட்டது (~85 KB)',
    submitShiftUpdate: 'ஷிப்ட் பதிவை சமர்ப்பிக்கவும்',
    submitting: 'பதிவாகிறது...',
    offlineQueueNotice: 'ஆஃப்லைன் வரிசை: {count} பதிவுகள் காத்திருக்கின்றன (இணைப்பு வந்ததும் தானாக சேரும்)',
    syncNow: 'இப்போதே சேமி',
    syncSuccess: 'அனைத்து பதிவுகளும் வெற்றிகரமாக சர்வரில் சேர்க்கப்பட்டன!',
    offlineSimulatedPill: 'ஆஃப்லைன் மாதிரி',
    onlineStatus: 'இணைப்பில் உள்ளது',
    offlineStatus: 'இணைப்பில்லை (ஆஃப்லைன்)',
    recentLogs: 'சமீபத்திய ஷிப்ட் பதிவுகள்',
    noActiveOrders: 'தற்போது செயலில் உள்ள உற்பத்தி ஆர்டர்கள் எதுவும் இல்லை.',
    remainingPcs: 'மீதமுள்ளவை',
    targetPcs: 'இலக்கு',
    completedPcs: 'முடிந்தது',
    lineSelector: 'இயந்திர வரிசை',
    selectOrderPrompt: 'பதிவு செய்ய ஒரு ஆர்டரைத் தேர்ந்தெடுக்கவும்',
    validationErrorQty: 'தயவுசெய்து சரியான எண்ணிக்கையை உள்ளிடவும்',
    clickToLog: 'பதிவு செய்ய கார்டை அழுத்தவும்',
    logOutput: 'பதிவு செய்',
    cancel: 'ரத்து செய்',
    shiftLabel: 'ஷிப்ட்',
    pieces: 'துண்டுகள்',
    productionModalTitle: 'ஷிப்ட் உற்பத்தி பதிவு',
    outsideUnit: 'வெளியூர் பிரிவு / துணை ஒப்பந்தம்',
    clear: 'அழி',
    notesVoiceTitle: 'குறிப்புகள் / குரல் பதிவு',
    orderBoard: 'ஆர்டர் பலகை',
    floorWork: 'தளப் பணி',
    riskDelays: 'இடர் & தாமதங்கள்',
    buyerPortal: 'வாங்குபவர் தளம்',
    auditHistory: 'தணிக்கை வரலாறு',
    weeklyReports: 'வாராந்திர அறிக்கைகள்',
    productionOps: 'உற்பத்தி மேலாண்மை',
    shiftRunRate: 'ஷிப்ட் உற்பத்தி விகிதம்',
    shiftRunRateDesc: '14 நாட்களுக்கு முன்னதாக தளம் மற்றும் உற்பத்தி வரிசையை உருவகப்படுத்தவும்.',
    openSimulator: 'சிமுலேட்டரைத் திற',
    logout: 'வெளியேறு',
    tiruppurKnitwear: 'திருப்பூர் பின்னலாடை',
    sizeBreakdownTitle: 'அளவு வாரியாக (S, M, L, XL)',
    bySize: 'அளவு வாரியாக பதிவு',
    allSizesProportional: 'மொத்த எண்ணிக்கை (விகிதப்படி)',
    sizesCount: 'அளவுகள்',
    allocated: 'பங்கீடு',
    inspectQueue: 'வரிசையைக் காண்க',
    queueDrawerTitle: 'ஆஃப்லைன் பதிவு வரிசை',
    queueDrawerSubtitle: 'இணையம் இல்லாத போது தளத்தில் சேமிக்கப்பட்ட உற்பத்தி பதிவுகள்',
    noPendingItems: 'காத்திருக்கும் ஆஃப்லைன் பதிவுகள் எதுவும் இல்லை',
    storageUsage: 'சாதன சேமிப்பகம்',
    networkQualityFast: 'வேகமான இணைப்பு',
    networkQualitySlow: 'மெதுவான சிக்னல் (ஆட்டோ வரிசை)',
    networkQualityOffline: 'இணைப்பில்லை (ஆஃப்லைன்)',
    pendingServerConfirm: 'சர்வர் உறுதிப்படுத்தல் காத்திருக்கிறது',
    retryRecord: 'மீண்டும் முயற்சி செய்',
    discardRecord: 'நீக்கு',
    syncAllNow: 'அனைத்தையும் ஒத்திசை',
    discardConfirm: 'இந்த ஆஃப்லைன் பதிவை நீக்க விரும்புகிறீர்களா?',
    statusQueued: 'வரிசையில்',
    statusSyncing: 'ஒத்திசைக்கப்படுகிறது',
    statusError: 'பிழை',
    optimisticPendingBadge: 'நிலுவை பதிவு',
    close: 'மூடு',
    storageFree: 'இடம் உள்ளது',
  },
  en: {
    appTitle: 'Floor Production Work',
    subHeader: 'Tiruppur Knitwear Operations',
    pageSubtitle: 'Active floor work orders, shift logs and supervisor output tracking',
    assignedUnit: 'Assigned Unit',
    activeOrders: 'Active Orders',
    myWork: 'Floor Work',
    shiftDay: 'Day',
    shiftNight: 'Night',
    stageLabel: 'Production Stage',
    goodQuantity: 'Good Output (Completed)',
    rejectedQuantity: 'Rejections (Defective)',
    reset: 'Reset (0)',
    quickAdd: 'Quick Add',
    issueChipsTitle: 'Floor Issue Chips (Tap to Log)',
    notesPlaceholder: 'Mention issues or details here, or tap the microphone to speak Tamil...',
    voiceStart: 'Speak Tamil (Mic)',
    voiceListening: 'Listening... speak now',
    voiceStop: 'Stop',
    voiceNotSupported: 'Speech API not supported on this browser',
    takePhoto: 'Snap Defect / Floor Photo',
    photoAttached: 'Photo Compressed (~85 KB)',
    submitShiftUpdate: 'Submit Shift Output',
    sizeBreakdownTitle: 'Size Breakdown (S, M, L, XL)',
    bySize: 'Log By Size',
    allSizesProportional: 'Lump Sum (Ratio Distributed)',
    sizesCount: 'Sizes',
    allocated: 'Allocated',
    inspectQueue: 'Inspect Queue',
    queueDrawerTitle: 'Offline Sync Queue',
    queueDrawerSubtitle: 'Floor updates queued while offline / low signal',
    noPendingItems: 'No pending updates in offline queue',
    storageUsage: 'Device Storage',
    networkQualityFast: 'Fast Network',
    networkQualitySlow: 'Weak Signal (Auto-Queue)',
    networkQualityOffline: 'Offline',
    pendingServerConfirm: 'Pending Server Confirmation',
    retryRecord: 'Retry',
    discardRecord: 'Discard',
    syncAllNow: 'Sync All Now',
    discardConfirm: 'Discard this offline record?',
    statusQueued: 'Queued',
    statusSyncing: 'Syncing',
    statusError: 'Sync Error',
    optimisticPendingBadge: 'Pending Sync',
    close: 'Close',
    storageFree: 'Free',
    submitting: 'Saving...',
    offlineQueueNotice: 'Offline Queue: {count} pending (auto-syncs on network return)',
    syncNow: 'Sync Now',
    syncSuccess: 'All offline records synced successfully!',
    offlineSimulatedPill: 'Offline Simulated',
    onlineStatus: 'ONLINE',
    offlineStatus: 'OFFLINE',
    recentLogs: 'Recent Shift Logs',
    noActiveOrders: 'No active production orders assigned to this unit.',
    remainingPcs: 'Remaining',
    targetPcs: 'Target',
    completedPcs: 'Completed',
    lineSelector: 'Machine Line',
    selectOrderPrompt: 'Select an order card to log output',
    validationErrorQty: 'Please enter a valid completed quantity',
    clickToLog: 'Click any card to log shift output',
    logOutput: 'Log Output',
    cancel: 'Cancel',
    shiftLabel: 'Shift',
    pieces: 'pcs',
    productionModalTitle: 'Log Shift Output',
    outsideUnit: 'Outside Unit / Subcontract',
    clear: 'Clear',
    notesVoiceTitle: 'Notes / Voice Input',
    orderBoard: 'Order Board',
    floorWork: 'Floor Work',
    riskDelays: 'Risk & Delays',
    buyerPortal: 'Buyer Portal',
    auditHistory: 'Audit History',
    weeklyReports: 'Weekly Reports',
    productionOps: 'Production Ops',
    shiftRunRate: 'Shift Run-Rate',
    shiftRunRateDesc: 'Simulate floor recovery & line reallocations 14 days ahead.',
    openSimulator: 'Open Simulator',
    logout: 'Logout',
    tiruppurKnitwear: 'Tiruppur Knitwear',
  },
};
