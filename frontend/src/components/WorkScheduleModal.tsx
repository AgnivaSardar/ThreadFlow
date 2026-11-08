import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  MapPin,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../features/auth/authStore';
import { apiRequest, getAuthoritativeServerDate } from '../services/api';
import { useLanguage } from '../hooks/useLanguage';

export interface WorkTask {
  id: string;
  time: string;
  title: string;
  description: string;
  unit: string;
  buyerOrPo: string;
  completed: boolean;
  role: string[];
  isCarriedOver?: boolean;
}

interface WorkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
}

export const WorkScheduleModal: React.FC<WorkScheduleModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
}) => {
  const { user } = useAuthStore();
  const { lang } = useLanguage();
  const [currentDate, setCurrentDate] = useState<Date>(selectedDate);

  useEffect(() => {
    setCurrentDate(selectedDate);
  }, [selectedDate]);

  // Esc key listener to exit modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Unique date key: YYYY-MM-DD
  const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const currentRole = user?.role || 'MERCHANDISER';
  const storageKey = `threadflow_tasks_${currentRole}_${dateKey}`;

  const [activeFloorOrders, setActiveFloorOrders] = useState<Array<{
    poNumber: string;
    style: string;
    activeMilestone?: { stage: string };
  }> | null>(null);

  useEffect(() => {
    if (!isOpen || currentRole !== 'SUPERVISOR') return;
    let isSubscribed = true;
    const fetchActiveFloorOrders = async () => {
      try {
        const url = user?.assignedUnitId
          ? `/production/work?unitId=${user.assignedUnitId}`
          : '/production/work';
        const res = await apiRequest<{ data: { orders: Array<{ poNumber: string; style: string; activeMilestone?: { stage: string } }> } }>(url);
        if (isSubscribed && res.data?.orders) {
          setActiveFloorOrders(res.data.orders);
        }
      } catch {
        // Fallback gracefully to offline list
      }
    };
    fetchActiveFloorOrders();
    return () => {
      isSubscribed = false;
    };
  }, [isOpen, currentRole, user?.assignedUnitId]);

  // Role-specific task generator for given date
  const getTasksForRoleAndDate = (
    role: string,
    date: Date,
    floorOrders?: Array<{ poNumber: string; style: string; activeMilestone?: { stage: string } }> | null
  ): WorkTask[] => {
    const isTa = lang === 'ta';
    const today = getAuthoritativeServerDate();
    const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const dateZero = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const isPast = dateZero < todayZero;

    // 1. ADMIN - No tasks assigned (global oversight)
    if (role === 'ADMIN') {
      return [];
    }

    // 2. SUPERVISOR
    // Requirement:
    // - If any unit that supervisor is has functional problems detected on that day, or previous unresolved problems not tick-marked
    // - Then the POs which the supervisor has been assigned: daily shift production form filling of that day
    if (role === 'SUPERVISOR') {
      const userEmail = (user?.email || '').toLowerCase();
      const assignedUnitCode = user?.assignedUnit?.code || '';
      const assignedUnitName = user?.assignedUnit?.name || '';

      let unitCode = assignedUnitCode || 'UNIT_1';
      let unitTitle = assignedUnitName || (isTa ? 'யூனிட் 1 (காட்டன் ஹப் - சொந்த)' : 'Unit 1 (Cotton Hub - Own)');

      if (assignedUnitCode === 'UNIT_2' || userEmail.includes('selvam') || userEmail.includes('manickam') || assignedUnitName.includes('Unit 2')) {
        unitCode = 'UNIT_2';
        unitTitle = assignedUnitName || (isTa ? 'யூனிட் 2 (தையல் மையம் - சொந்த)' : 'Unit 2 (Stitching Hub - Own)');
      } else if (assignedUnitCode === 'UNIT_3' || userEmail.includes('murugan') || assignedUnitName.includes('Unit 3')) {
        unitCode = 'UNIT_3';
        unitTitle = assignedUnitName || (isTa ? 'யூனிட் 3 (ஸ்பெஷாலிட்டி & ஏற்றுமதி)' : 'Unit 3 (Specialty & Export - Own)');
      } else if (assignedUnitCode === 'PRINTTEX' || userEmail.includes('printtex')) {
        unitCode = 'PRINTTEX';
        unitTitle = isTa ? 'துணை ஒப்பந்தம் - PrintTex' : 'Subcontract - PrintTex';
      } else if (assignedUnitCode === 'WASHTEX' || userEmail.includes('washtex')) {
        unitCode = 'WASHTEX';
        unitTitle = isTa ? 'துணை ஒப்பந்தம் - WashTex' : 'Subcontract - WashTex';
      }

      const tasksList: WorkTask[] = [];

      // A. Check functional problem resolution tasks (previous un-ticked issues carry over until resolved)
      const prob1Key = `prob_needle_${unitCode}`;
      const prob1Resolved = localStorage.getItem(`threadflow_issue_${prob1Key}`) === 'resolved';

      // Problem 1: Machine / Line functional breakdown
      tasksList.push({
        id: `sup-issue-needle-${unitCode}-${dateKey}`,
        time: '07:00 AM - 08:00 AM',
        title: isTa
          ? 'உற்பத்தி லைன் செயல்பாட்டு சிக்கலை தீர்த்து முடித்தல்'
          : 'Resolve & Clear Line Functional Disruption',
        description: isTa
          ? `${unitTitle} இல் கண்டறியப்பட்ட இயந்திர ஊசி மற்றும் மோட்டார் அழுத்த சிக்கலை சரிசெய்து, பராமரிப்புக் குழுவுடன் உறுதிப்படுத்தவும்.`
          : `Inspect Line functional problem detected in ${unitTitle}. Verify machine needle alignment and motor tension with maintenance team before resuming bulk run.`,
        unit: unitTitle,
        buyerOrPo: isTa ? 'செயல்பாட்டு பிரச்சனை (Line 1)' : 'Functional Issue (Line 1)',
        completed: prob1Resolved || isPast,
        role: ['SUPERVISOR'],
        isCarriedOver: !prob1Resolved && dateZero >= todayZero,
      });

      // Problem 2: Batch defect quarantine check if Unit 1 or Unit 2
      if (unitCode === 'UNIT_1' || unitCode === 'UNIT_2') {
        const prob2Key = `prob_defect_${unitCode}`;
        const prob2Resolved = localStorage.getItem(`threadflow_issue_${prob2Key}`) === 'resolved';

        tasksList.push({
          id: `sup-issue-defect-${unitCode}-${dateKey}`,
          time: '08:15 AM - 09:00 AM',
          title: isTa
            ? 'செயல்பாட்டு குறைபாடு தனிமைப்படுத்தலை சரிசெய்து அனுமதித்தல்'
            : 'Clear Functional Defect Quarantine & Batch Re-Check',
          description: isTa
            ? 'முன்னர் தெரிவிக்கப்பட்ட துணி நிற வேறுபாடு / தையல் குறைபாட்டை சரிபார்த்து, குறைபாடு விகிதம் 1.5% க்கும் குறைவாக இருப்பதை உறுதிப்படுத்தவும்.'
            : 'Inspect previously reported fabric shade variation / skip stitch defect. Sign off quality clearance once defect rate is below 1.5%.',
          unit: unitTitle,
          buyerOrPo: isTa ? 'தர ஆய்வு (Defect Log)' : 'Quality Issue (Defect Log)',
          completed: prob2Resolved || isPast,
          role: ['SUPERVISOR'],
          isCarriedOver: !prob2Resolved && dateZero >= todayZero,
        });
      }

      // B. Daily Shift Form Filling for all ACTIVE POs assigned to this supervisor's unit
      const timeSlots = [
        '09:30 AM - 11:00 AM',
        '11:30 AM - 01:00 PM',
        '02:00 PM - 03:30 PM',
        '03:45 PM - 04:45 PM',
        '05:00 PM - 06:00 PM',
      ];

      if (floorOrders && floorOrders.length > 0) {
        // Dynamically synchronized with live Floor Production Work
        floorOrders.forEach((ord, idx) => {
          const timeSlot = timeSlots[idx % timeSlots.length];
          const stageName = ord.activeMilestone?.stage?.replace(/_/g, ' ') || 'Assembly';
          tasksList.push({
            id: `sup-form-${ord.poNumber}-${dateKey}`,
            time: timeSlot,
            title: isTa
              ? `தினசரி ஷிப்ட் உற்பத்தி படிவத்தை நிரப்புதல்: PO ${ord.poNumber}`
              : `Fill Daily Shift Production Form: PO ${ord.poNumber}`,
            description: isTa
              ? `${ord.style} தயாரிப்பிற்கான இன்றைய உற்பத்தி வெளியீட்டு எண்ணிக்கையை சமர்ப்பிக்கவும்.`
              : `Submit today piece count for active stage (${stageName} - ${ord.style}) and verify operator tally.`,
            unit: unitTitle,
            buyerOrPo: `PO: ${ord.poNumber}`,
            completed: isPast,
            role: ['SUPERVISOR'],
          });
        });
      } else {
        // Accurate unit-specific active orders (completed orders excluded)
        let activeUnitPOs: Array<{ po: string; style: string; stage: string }> = [];
        if (unitCode === 'UNIT_1') {
          activeUnitPOs = [
            { po: 'B-PO-88240', style: "Men's Polo White", stage: 'Knitting' },
            { po: 'B-PO-88255', style: 'French Terry Hoodie Navy', stage: 'Cutting' },
            { po: 'B-PO-88213', style: 'Classic Crew Neck T-Shirt Olive', stage: 'Stitching' },
            { po: 'IND-PO-77401', style: 'Oversized Acid Wash Tee Charcoal', stage: 'Dyeing & Washing' },
            { po: 'NEXT-PO-33104', style: 'Waffle Knit Henley Heather Grey', stage: 'Knitting' },
          ];
        } else if (unitCode === 'UNIT_2') {
          activeUnitPOs = [
            { po: 'C-PO-0501', style: 'Striped Interlock Polo Navy/White', stage: 'Checking' },
            { po: 'M-PO-91022', style: 'Pima Cotton V-Neck Black', stage: 'Stitching' },
            { po: 'C-PO-0515', style: 'Baby Rib Sleepsuit 2-Pack Pastel', stage: 'Cutting' },
          ];
        } else if (unitCode === 'UNIT_3') {
          activeUnitPOs = [
            { po: 'B-PO-88272', style: 'Mercerized Cotton Dress Polo Black', stage: 'Finishing' },
          ];
        } else if (unitCode === 'PRINTTEX') {
          activeUnitPOs = [
            { po: 'C-PO-0488', style: 'Kids Printed Tee Yellow', stage: 'Printing' },
          ];
        } else if (unitCode === 'WASHTEX') {
          activeUnitPOs = [
            { po: 'C-PO-0492', style: 'Organic Rib Tank Top Sage', stage: 'Dyeing & Washing' },
          ];
        }

        activeUnitPOs.forEach((ord, idx) => {
          tasksList.push({
            id: `sup-form-${ord.po}-${dateKey}`,
            time: timeSlots[idx % timeSlots.length],
            title: isTa
              ? `தினசரி ஷிப்ட் உற்பத்தி படிவத்தை நிரப்புதல்: PO ${ord.po}`
              : `Fill Daily Shift Production Form: PO ${ord.po}`,
            description: isTa
              ? `${ord.style} தயாரிப்பிற்கான இன்றைய உற்பத்தி வெளியீட்டு எண்ணிக்கையை சமர்ப்பிக்கவும்.`
              : `Submit today piece count for active stage (${ord.stage} - ${ord.style}) and verify operator tally.`,
            unit: unitTitle,
            buyerOrPo: `PO: ${ord.po}`,
            completed: isPast,
            role: ['SUPERVISOR'],
          });
        });
      }

      return tasksList;
    }

    // 3. MERCHANDISER
    // Requirement:
    // - Check all the supervisors have done their work
    // - Check upon the stuff and numbers and if all are going okay
    if (role === 'MERCHANDISER') {
      return [
        {
          id: `mer-check-supervisors-${dateKey}`,
          time: '09:00 AM - 10:30 AM',
          title: isTa
            ? 'அனைத்து மேற்பார்வையாளர்களும் தங்கள் பணியை முடித்துவிட்டார்களா என சரிபார்த்தல்'
            : 'Check All Floor Supervisors Have Completed Their Work',
          description: isTa
            ? 'யூனிட் 1 (முத்து/குமரவேல்), யூனிட் 2 (செல்வம்/மாணிக்கம்), மற்றும் யூனிட் 3 (முருகன்) மேற்பார்வையாளர்கள் மாலை 6 மணிக்குள் தங்களது ஷிப்ட் படிவங்களை சமர்ப்பித்துள்ளனரா என சரிபார்க்கவும்.'
            : 'Verify that supervisors across Unit 1 (Muthu/Kumaravel), Unit 2 (Selvam/Manickam), and Unit 3 (Murugan) have logged and submitted today shift production forms without missing updates.',
          unit: isTa ? 'தொழிற்சாலை முழுவதும் (யூனிட் 1, 2, 3)' : 'Factory-Wide (Unit 1, 2, 3)',
          buyerOrPo: isTa ? 'அனைத்து மேற்பார்வையாளர்கள்' : 'All Unit Supervisors',
          completed: isPast,
          role: ['MERCHANDISER'],
        },
        {
          id: `mer-check-numbers-${dateKey}`,
          time: '11:00 AM - 12:45 PM',
          title: isTa
            ? 'உற்பத்தி விவரங்கள் மற்றும் எண்ணிக்கைகளை சரிபார்த்தல்'
            : 'Check Production Stuff & Output Numbers',
          description: isTa
            ? 'அனைத்து லைன்களிலும் துண்டுகள் எண்ணிக்கை, நல்ல உற்பத்தி மற்றும் நிராகரிப்புகளை சரிபார்த்து, வெட்டுதல் மற்றும் துணி பயன்பாட்டுடன் ஒப்பிடவும்.'
            : 'Check upon the stuff and piece count numbers across lines. Verify good output vs rejects, and ensure numbers match cutting and fabric consumption allowances.',
          unit: isTa ? 'மத்திய வணிக அலுவலகம்' : 'Central Merchandising Hub',
          buyerOrPo: isTa ? 'அனைத்து 14 ஏற்றுமதி ஆர்டர்கள்' : 'All 14 Active POs',
          completed: isPast,
          role: ['MERCHANDISER'],
        },
        {
          id: `mer-check-pace-${dateKey}`,
          time: '02:00 PM - 03:30 PM',
          title: isTa
            ? 'அனைத்து லைன்களும் சரியாக இயங்குகிறதா என சரிபார்த்தல்'
            : 'Check If All Lines Are Going Okay & On Track',
          description: isTa
            ? 'உற்பத்தி வேகம், 3-நாள் சராசரி மற்றும் பஃபர் நாட்களை ஆய்வு செய்து அனைத்து ஏற்றுமதி ஆர்டர்களும் சரியான நேரத்தில் முடியும் என்பதை உறுதிப்படுத்தவும்.'
            : 'Audit "Show-Your-Math" run-rates, rolling 3-day weighted velocity, and downstream extra days to ensure all export orders will meet ex-factory shipping targets.',
          unit: isTa ? 'ஆபத்து & வேகம் மதிப்பாய்வு' : 'Risk & Throughput Engine',
          buyerOrPo: isTa ? 'முக்கிய வழித்தட கண்காணிப்பு' : 'Critical Path Run-Rate',
          completed: false,
          role: ['MERCHANDISER'],
        },
        {
          id: `mer-check-issues-${dateKey}`,
          time: '04:30 PM - 05:45 PM',
          title: isTa
            ? 'தள பிரச்சனைகள் மற்றும் AI குறிப்புகளை மதிப்பாய்வு செய்தல்'
            : 'Review Reported Floor Disruptions & AI Translation Gate',
          description: isTa
            ? 'மேற்பார்வையாளர்கள் சமர்ப்பித்த இயந்திர பழுது அல்லது தாமத எச்சரிக்கைகளை ஆய்வு செய்து, மாலை 6 மணிக்குள் தீர்வு நடவடிக்கைகளை உறுதிப்படுத்தவும்.'
            : 'Inspect supervisor downtime alerts (power cuts, machine breakdowns) and approve or remediate issues before 6:00 PM cutoff.',
          unit: isTa ? 'தள செயல்பாடுகள் & தரம்' : 'Floor Operations & QC',
          buyerOrPo: isTa ? 'AI மதிப்பாய்வு போர்டல்' : 'AI Issue Review Gate',
          completed: false,
          role: ['MERCHANDISER'],
        },
      ];
    }

    // 4. BUYERS
    // Requirement:
    // - The product under their company
    // - Check each day's function and acknowledge
    if (role === 'BUYER') {
      const userEmail = (user?.email || '').toLowerCase();
      const buyerCode = user?.buyer?.code || '';

      const isCompanyC = userEmail.includes('company-c') || buyerCode === 'COMPANY_C';
      const companyTitle = isCompanyC
        ? (isTa ? 'நிறுவனம் சி (ஜெர்மனி)' : 'Company C (Germany)')
        : (isTa ? 'நிறுவனம் பி (இங்கிலாந்து)' : 'Company B (UK)');
      const companyOrders = isCompanyC
        ? 'PO: C-PO-0488, C-PO-0492, C-PO-0501, C-PO-0515'
        : 'PO: B-PO-88213, B-PO-88240, B-PO-88255, B-PO-88260, B-PO-88272';

      return [
        {
          id: `buy-check-function-${dateKey}`,
          time: '09:30 AM GMT',
          title: isTa
            ? `${companyTitle} பொருட்களின் தினசரி உற்பத்தி செயல்பாட்டை சரிபார்த்தல்`
            : `Check Daily Production Functions for ${companyTitle} Products`,
          description: isTa
            ? 'உங்கள் நிறுவனத்திற்கு ஒதுக்கப்பட்ட அனைத்து ஆர்டர்களுக்கான உற்பத்தி நிலைகள், மணிநேர துண்டுகள் எண்ணிக்கை மற்றும் வேகத்தை சரிபார்க்கவும்.'
            : `Inspect today's active manufacturing stages, hourly piece counts, and throughput pace for all products under ${companyTitle}.`,
          unit: isTa ? 'ஒதுக்கப்பட்ட உற்பத்தி அலகுகள்' : 'Assigned Production Lines',
          buyerOrPo: companyOrders,
          completed: isPast,
          role: ['BUYER'],
        },
        {
          id: `buy-acknowledge-quality-${dateKey}`,
          time: '01:30 PM GMT',
          title: isTa
            ? 'ஷிப்ட் வெளியீடு மற்றும் தர ஆய்வு புகைப்படங்களை ஒப்புக்கொள்ளுதல்'
            : 'Review & Acknowledge Shift Output and Quality Photos',
          description: isTa
            ? 'மேற்பார்வையாளர் பதிவேற்றிய ஆய்வு புகைப்படங்கள் மற்றும் குறைபாடு பதிவுகளை ஆய்வு செய்து தரத்தை முறையாக ஒப்புக்கொள்ளவும்.'
            : 'Inspect today floor inspection photos, defect reports, and formally acknowledge acceptable workmanship for active consignments.',
          unit: isTa ? 'சரிபார்த்தல் & பேக்கிங் மையம்' : 'Checking & Packing Hub',
          buyerOrPo: isTa ? 'தள புகைப்பட சான்றுகள்' : 'Floor Photo Proofs',
          completed: isPast,
          role: ['BUYER'],
        },
        {
          id: `buy-acknowledge-schedule-${dateKey}`,
          time: '04:30 PM GMT',
          title: isTa
            ? 'மைல்கல் முன்னேற்றம் & தொழிற்சாலை புறப்பாடு அட்டவணையை ஒப்புக்கொள்ளுதல்'
            : 'Acknowledge Stage Progress & Ex-Factory Timeline',
          description: isTa
            ? 'மைல்கல் முன்னேற்றத்தை சரிபார்த்து வரவிருக்கும் ஏற்றுமதி வாரத்திற்கான தொழிற்சாலை புறப்பாடு நிலையை ஒப்புக்கொண்டு உறுதிப்படுத்தவும்.'
            : 'Verify on-track milestone completion and formally acknowledge today handover status for upcoming export shipping week.',
          unit: isTa ? 'வாங்குபவர் கண்காணிப்பு போர்டல்' : 'Buyer Tracking Portal',
          buyerOrPo: isTa ? 'மைல்கல் ஒப்புதல்' : 'Milestone Acknowledgment',
          completed: false,
          role: ['BUYER'],
        },
      ];
    }

    return [];
  };

  const [tasks, setTasks] = useState<WorkTask[]>(() => {
    const freshTasks = getTasksForRoleAndDate(currentRole, currentDate, activeFloorOrders);
    try {
      const savedChecks = localStorage.getItem(`checks_${storageKey}`);
      if (savedChecks) {
        const checkMap: Record<string, boolean> = JSON.parse(savedChecks);
        return freshTasks.map((t) => ({
          ...t,
          completed: checkMap[t.id] !== undefined ? checkMap[t.id] : t.completed,
        }));
      }
    } catch {
      // Fallback
    }
    return freshTasks;
  });

  // Reload when date, role, or floor orders change
  useEffect(() => {
    const freshTasks = getTasksForRoleAndDate(currentRole, currentDate, activeFloorOrders);
    try {
      const savedChecks = localStorage.getItem(`checks_${storageKey}`);
      if (savedChecks) {
        const checkMap: Record<string, boolean> = JSON.parse(savedChecks);
        setTasks(
          freshTasks.map((t) => ({
            ...t,
            completed: checkMap[t.id] !== undefined ? checkMap[t.id] : t.completed,
          }))
        );
        return;
      }
    } catch {
      // ignore
    }
    setTasks(freshTasks);
  }, [dateKey, currentRole, storageKey, lang, activeFloorOrders]);

  // Persist task updates
  const handleToggleTask = (taskId: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      // Save check map
      const checkMap: Record<string, boolean> = {};
      updated.forEach((t) => {
        checkMap[t.id] = t.completed;
      });
      localStorage.setItem(`checks_${storageKey}`, JSON.stringify(checkMap));

      // If this is a functional problem task, sync persistent problem resolution
      if (taskId.startsWith('sup-issue-needle-')) {
        const target = updated.find((t) => t.id === taskId);
        const unitPart = taskId.split('-')[3];
        if (target?.completed) {
          localStorage.setItem(`threadflow_issue_prob_needle_${unitPart}`, 'resolved');
        } else {
          localStorage.removeItem(`threadflow_issue_prob_needle_${unitPart}`);
        }
      } else if (taskId.startsWith('sup-issue-defect-')) {
        const target = updated.find((t) => t.id === taskId);
        const unitPart = taskId.split('-')[3];
        if (target?.completed) {
          localStorage.setItem(`threadflow_issue_prob_defect_${unitPart}`, 'resolved');
        } else {
          localStorage.removeItem(`threadflow_issue_prob_defect_${unitPart}`);
        }
      }

      return updated;
    });
  };

  const handlePrevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    setCurrentDate(prev);
  };

  const handleNextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  if (!isOpen) return null;

  const formattedDateString = currentDate.toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const today = getAuthoritativeServerDate();
  const isToday =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth() &&
    currentDate.getDate() === today.getDate();

  const isAdmin = currentRole === 'ADMIN';
  const completedCount = tasks.filter((t) => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh] mx-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0C2D48] text-white p-5 flex items-center justify-between border-b border-[#143D60]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-400 shrink-0">
              {isAdmin ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <CalendarIcon className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  {lang === 'ta' ? 'தினசரி பணி மற்றும் செயல்பாட்டு பட்டியல்' : 'Daily Work & Operations Checklist'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {user?.role}
                </span>
              </div>
              <p className="text-xs text-sky-200/70 mt-0.5">
                {isAdmin
                  ? (lang === 'ta'
                      ? 'அமைப்புக் கண்காணிப்பு மற்றும் நிர்வாக மேற்பார்வை'
                      : 'System governance, cryptographic audit logs, and global operational oversight')
                  : (lang === 'ta'
                      ? 'இன்றைய தேதிக்கான பணிகள், மேற்பார்வை மற்றும் மைல்கல் உறுதிப்பாடுகள்'
                      : 'Tasks, line supervisions, and milestone commitments for this date')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-sky-200/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Press Esc to close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date Selector Navigation Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-1 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-900 shadow-2xs flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-sky-700" />
              <span>{formattedDateString}</span>
              {isToday && (
                <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase">
                  {lang === 'ta' ? 'இன்று' : 'TODAY'}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextDay}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-[11px] font-semibold text-slate-500">
            {isAdmin
              ? (lang === 'ta' ? 'கண்காணிப்பு முறை' : 'Oversight Mode')
              : `${tasks.length} ${lang === 'ta' ? 'திட்டமிடப்பட்ட பணிகள்' : 'Planned Tasks'}`}
          </span>
        </div>

        {/* Progress Bar or Admin Oversight Banner */}
        {isAdmin ? (
          <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-slate-700">
                {lang === 'ta'
                  ? 'நிர்வாகக் கண்காணிப்பு • செயல்பாட்டு பட்டியல் தேவையில்லை'
                  : 'System Oversight • No Operational Checklist Required'}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {lang === 'ta' ? 'முழுமையான அணுகல்' : 'Full Governance Access'}
            </span>
          </div>
        ) : (
          <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">
                {lang === 'ta' ? 'நிறைவு:' : 'Completion:'}
              </span>
              <span className="text-xs font-black font-mono text-[#0C2D48]">
                {completedCount} / {tasks.length} {lang === 'ta' ? 'பணிகள்' : 'tasks'} ({progressPercent}%)
              </span>
            </div>

            <div className="flex-1 max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  progressPercent === 100 ? 'bg-emerald-500' : 'bg-sky-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Task List or Admin Clean Slate */}
        <div className="p-5 overflow-y-auto space-y-3 divide-y divide-slate-100 smooth-scroll flex-1">
          {isAdmin || tasks.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center justify-center my-auto">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-3 shadow-2xs">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                {lang === 'ta' ? 'பணிகள் எதுவும் ஒதுக்கப்படவில்லை' : 'No Operational Tasks Assigned'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
                {lang === 'ta'
                  ? 'நிர்வாகிகளுக்கு தொழிற்சாலை முழுமைக்குமான மேலாண்மை மற்றும் தணிக்கைக் கண்காணிப்பு பொறுப்பு உள்ளது. தினசரி ஷிப்ட் செயல்பாட்டு பட்டியல் தேவையில்லை.'
                  : 'Administrators have global oversight across all factory units, tamper-evident audit logs, and user roles. Daily operational checklist completion is not required.'}
              </p>
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task.id)}
                className={`pt-3 first:pt-0 flex items-start gap-3.5 p-3 rounded-2xl transition-all cursor-pointer ${
                  task.completed
                    ? 'bg-emerald-50/40 border border-emerald-100'
                    : task.isCarriedOver
                    ? 'bg-amber-50/50 border border-amber-200 shadow-2xs'
                    : 'hover:bg-slate-50 border border-transparent hover:border-slate-200'
                }`}
              >
                {/* Checkbox button */}
                <button
                  type="button"
                  className={`mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                    task.completed
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : task.isCarriedOver
                      ? 'border-2 border-amber-400 text-transparent hover:border-amber-600 bg-amber-50'
                      : 'border-2 border-slate-300 text-transparent hover:border-sky-600'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 fill-current stroke-white stroke-[2.5]" />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm font-bold tracking-tight ${
                          task.completed ? 'text-slate-500 line-through' : 'text-slate-900'
                        }`}
                      >
                        {task.title}
                      </h4>
                      {task.isCarriedOver && !task.completed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          {lang === 'ta' ? 'முந்தைய தீர்க்கப்படாத பிரச்சனை' : 'Unresolved Issue'}
                        </span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                      <Clock className="w-3 h-3 text-sky-600" />
                      {task.time}
                    </span>
                  </div>

                  <p
                    className={`text-xs mt-1 leading-relaxed ${
                      task.completed ? 'text-slate-400 line-through' : 'text-slate-600'
                    }`}
                  >
                    {task.description}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                      <MapPin className="w-3 h-3 text-rose-500" />
                      {task.unit}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg">
                      <Building2 className="w-3 h-3 text-sky-600" />
                      {task.buyerOrPo}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {isAdmin
              ? (lang === 'ta' ? 'மூட Esc அழுத்தவும்' : 'Press Esc to close')
              : (lang === 'ta'
                  ? 'முடிக்க பணிகளைக் கிளிக் செய்யவும் • மூட Esc அழுத்தவும்'
                  : 'Click tasks to complete • Press Esc to close')}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#0C2D48] hover:bg-[#164368] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            {lang === 'ta' ? 'முடிந்தது' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
