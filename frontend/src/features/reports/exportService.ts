import { apiRequest } from '../../services/api';

export interface BuyerExportOrder {
  id: string;
  poNumber: string;
  style: string;
  description: string | null;
  totalQuantity: number;
  currency: string;
  exFactoryDate: string;
  daysToExFactory: number;
  activeStage: string;
  progressPercent: number;
  unit: {
    name: string;
    location: string | null;
  };
  milestones: Array<{
    stage: string;
    sequenceOrder: number;
    targetQuantity: number;
    completedQuantity: number;
    isCompleted: boolean;
  }>;
  confirmedAlerts: Array<{
    stage: string;
    riskLevel: string;
    mitigationPlan: string | null;
    reviewedAt: string;
  }>;
  latestDailyLog?: {
    notes: string;
    goodQuantity: number;
    stage: string;
  } | null;
}

export interface BuyerProfile {
  id: string;
  name: string;
  code: string;
  country: string | null;
  contactEmail: string | null;
}

/**
 * Generates an RFC 4180 CSV blob with UTF-8 BOM for Microsoft Excel compatibility
 * and triggers immediate browser download.
 */
export function exportOrdersToCsv(buyer: BuyerProfile, orders: BuyerExportOrder[]) {
  const headers = [
    'PO Number',
    'Style',
    'Description',
    'Contracted Quantity (pcs)',
    'Currency',
    'Production Unit',
    'Ex-Factory Date',
    'Days Left',
    'Active Stage',
    'Milestone Progress (%)',
    'Knitting (pcs)',
    'Dyeing & Washing (pcs)',
    'Printing & Embroidery (pcs)',
    'Cutting (pcs)',
    'Stitching (pcs)',
    'Quality Checking (pcs)',
    'Finishing & Packing (pcs)',
    'Confirmed Mitigation Directives',
    'Latest Supervisor Shift Notes',
  ];

  const rows = orders.map((o) => {
    const getStageQty = (stageName: string) => {
      const m = o.milestones.find((ms) => ms.stage === stageName);
      return m ? m.completedQuantity : 0;
    };

    const mitigation = o.confirmedAlerts.map((a) => a.mitigationPlan).filter(Boolean).join(' | ') || 'On track';
    const notes = o.latestDailyLog?.notes || 'Operations running as scheduled';

    return [
      `"${o.poNumber}"`,
      `"${o.style}"`,
      `"${(o.description || '').replace(/"/g, '""')}"`,
      o.totalQuantity,
      `"${o.currency}"`,
      `"${o.unit.name}"`,
      new Date(o.exFactoryDate).toISOString().split('T')[0],
      o.daysToExFactory,
      `"${o.activeStage.replace(/_/g, ' ')}"`,
      `${o.progressPercent}%`,
      getStageQty('KNITTING'),
      getStageQty('DYEING_WASHING'),
      getStageQty('PRINTING'),
      getStageQty('CUTTING'),
      getStageQty('STITCHING'),
      getStageQty('CHECKING'),
      getStageQty('FINISHING'),
      `"${mitigation.replace(/"/g, '""')}"`,
      `"${notes.replace(/"/g, '""')}"`,
    ];
  });

  // UTF-8 BOM (\uFEFF) ensures Excel opens without character corruption
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const todayStr = new Date().toISOString().split('T')[0];
  const safeBuyerCode = (buyer.code || buyer.name || 'BUYER').replace(/[^a-zA-Z0-9-_]/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `${safeBuyerCode}_Weekly_Status_${todayStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Compiles and fetches complete weekly export dataset for a given buyer.
 */
export async function fetchWeeklyBuyerData(buyerId?: string): Promise<{ buyer: BuyerProfile; orders: BuyerExportOrder[] }> {
  const queryStr = buyerId ? `?buyerId=${encodeURIComponent(buyerId)}` : '';

  const [profileRes, ordersRes] = await Promise.all([
    apiRequest<{ success: boolean; data: BuyerProfile }>(`/buyer-portal/profile${queryStr}`),
    apiRequest<{ success: boolean; data: BuyerExportOrder[] }>(`/buyer-portal/orders${queryStr}`),
  ]);

  return {
    buyer: profileRes.data,
    orders: ordersRes.data || [],
  };
}

/**
 * Main export service function satisfying Feature 14.
 */
export async function generateWeeklyBuyerExport(
  buyerId?: string,
  format: 'csv' | 'pdf' = 'csv',
  onPdfPreview?: (data: { buyer: BuyerProfile; orders: BuyerExportOrder[] }) => void
) {
  const { buyer, orders } = await fetchWeeklyBuyerData(buyerId);

  if (format === 'csv') {
    exportOrdersToCsv(buyer, orders);
  } else if (format === 'pdf' && onPdfPreview) {
    onPdfPreview({ buyer, orders });
  }
}
