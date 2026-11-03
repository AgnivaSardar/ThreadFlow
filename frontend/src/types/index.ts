export type Role = 'MERCHANDISER' | 'SUPERVISOR' | 'BUYER' | 'ADMIN';

export type Stage =
  | 'KNITTING'
  | 'DYEING_WASHING'
  | 'PRINTING'
  | 'CUTTING'
  | 'STITCHING'
  | 'CHECKING'
  | 'FINISHING';

export type RiskLevel = 'GREEN' | 'AMBER' | 'RED' | 'COMPLETED';

export type ApprovalStatus = 'PENDING_REVIEW' | 'CONFIRMED' | 'OVERRIDDEN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  languagePreference: string;
  phone?: string | null;
  buyerId?: string | null;
  assignedUnitId?: string | null;
  buyer?: {
    id: string;
    name: string;
    code: string;
  } | null;
  assignedUnit?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  accessToken: string;
  user: User;
}

export interface Buyer {
  id: string;
  name: string;
  code: string;
  country?: string | null;
}

export interface Unit {
  id: string;
  name: string;
  code: string;
  type: 'OWN_UNIT' | 'SUBCONTRACTOR';
  location?: string | null;
}

export interface OrderLine {
  id: string;
  orderId: string;
  size: string;
  color: string;
  plannedQty: number;
  completedQty: number;
}

export interface TnaMilestone {
  id: string;
  orderId: string;
  stage: Stage;
  sequenceOrder: number;
  plannedStart: string;
  plannedEnd: string;
  bufferDaysAhead: number;
  targetQuantity: number;
  completedQuantity: number;
  unitId?: string | null;
  unit?: Unit | null;
  isCriticalPathBottleneck?: boolean;
  bufferCompressionDays?: number;
}

export interface AuditEvent {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  category: string;
  reasonCode: string;
  notes?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  financialImpactRupees?: number | null;
  currency?: string | null;
  auditHash?: string | null;
  userId: string;
  userRole: Role;
  user?: {
    id: string;
    name: string;
    email: string;
    role: Role;
  } | null;
  timestamp: string;
}

export interface RiskWarning {
  id: string;
  orderId: string;
  milestoneId: string;
  riskLevel: RiskLevel;
  requiredDailyRate: number;
  actualRollingRate: number;
  varianceQtyPerDay: number;
  projectedCompletionDate?: string | null;
  daysLate: number;
  financialExposureRupees: number;
  mathBreakdown?: string | null;
  mitigationPlan?: string | null;
  approvalStatus: ApprovalStatus;
  isBuyerVisible: boolean;
}

export interface FloorIssueContext {
  productionUpdateId: string;
  shift?: string | null;
  machineLine?: string | null;
  supervisorName: string;
  rawTamilText?: string | null;
  translatedText?: string | null;
  category: string;
  confidenceScore: number;
  classifiedBy?: string | null;
  loggedAt: string;
}

export interface RiskAlertItem {
  id: string;
  orderId: string;
  milestoneId: string;
  poNumber: string;
  style: string;
  totalQuantity: number;
  exFactoryDate: string;
  currency: string;
  buyer: { id: string; name: string; code: string };
  unit?: { id: string; name: string; code: string } | null;
  stage: Stage;
  sequenceOrder: number;
  targetQuantity: number;
  completedQuantity: number;
  riskLevel: RiskLevel;
  requiredDailyRate: number;
  actualRollingRate: number;
  varianceQtyPerDay: number;
  projectedCompletionDate?: string | null;
  daysLate: number;
  financialExposureRupees: number;
  approvalStatus: ApprovalStatus;
  isBuyerVisible: boolean;
  mitigationPlan?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: { id: string; name: string; email?: string } | null;
  floorIssue?: FloorIssueContext | null;
  mitigationActions?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface RiskAlertSummary {
  totalAtRiskRupees: number;
  ordersAtRiskCount: number;
  totalPendingReview: number;
  totalConfirmed: number;
  totalOverridden: number;
}

export interface RiskAlertsResponse {
  summary: RiskAlertSummary;
  alerts: RiskAlertItem[];
}

export interface OrderListItem {
  id: string;
  poNumber: string;
  style: string;
  description?: string | null;
  totalQuantity: number;
  currency: string;
  exchangeRate: number;
  fobPricePerPiece?: number | null;
  totalOrderValue?: number | null;
  exFactoryDate: string;
  orderDate: string;
  status: string;
  shipWeek: number;
  workingDaysLeft: number;
  buyer: Buyer;
  unit: Unit;
  activeStage: Stage;
  activeStageSequence: number;
  activeStageProgressPct: number;
  activeMilestoneCompleted?: number;
  activeMilestoneTarget?: number;
  overallCompletionPct: number;
  totalPlanned: number;
  totalCompleted: number;
  healthStatus: RiskLevel;
  hasCriticalBottleneck?: boolean;
  bufferCompressionDays?: number;
  riskWarning?: {
    id: string;
    riskLevel: RiskLevel;
    requiredDailyRate: number;
    actualRollingRate: number;
    daysLate: number;
  } | null;
  orderLines: OrderLine[];
  milestones: TnaMilestone[];
}

export interface SizeProgress {
  id: string;
  size: string;
  color: string;
  plannedQty: number;
  completedQty: number;
  remainingQty: number;
  completionPct: number;
  isSkewed: boolean;
  lagDeficit: number;
}

export interface FloorPhoto {
  id: string;
  s3Url: string;
  stage: Stage;
  approvalStatus: ApprovalStatus;
  isBuyerVisible: boolean;
  createdAt: string;
}

export interface FloorIssueClassification {
  id: string;
  category: string;
  confidenceScore: number;
  needsReview: boolean;
  isConfirmed: boolean;
  rawTamilText?: string | null;
  translatedText?: string | null;
  classifiedBy?: string | null;
  createdAt: string;
}

export interface FloorProductionUpdate {
  id: string;
  idempotencyKey: string;
  stage: Stage;
  shift?: string | null;
  machineLine?: string | null;
  goodQuantity: number;
  rejectedQuantity: number;
  notes?: string | null;
  clientEventAt: string;
  approvalStatus: ApprovalStatus;
  supervisor: {
    id: string;
    name: string;
    email: string;
    role?: Role;
  };
  photos: FloorPhoto[];
  issueClassification?: FloorIssueClassification | null;
  sizeBreakdownLines?: Array<{
    id: string;
    goodQuantity: number;
    rejectedQuantity: number;
    orderLine?: {
      size: string;
      color: string;
    };
  }>;
}

export interface OrderDetail extends Omit<OrderListItem, 'sizeProgress'> {
  version: number;
  hasSkewWarning: boolean;
  sizeProgress: SizeProgress[];
  auditEvents: AuditEvent[];
  productionUpdates?: FloorProductionUpdate[];
  latestRiskWarning?: RiskWarning | null;
  criticalPathAlert?: {
    stage: Stage;
    stageDisplayName: string;
    bufferCompressionDays: number;
    message: string;
    downstreamRisk: string;
  } | null;
  sizeSkewRecommendation?: {
    laggedSize: string;
    laggedColor: string;
    advancedSize: string;
    lagDeficit: number;
    remainingQty: number;
    directive: string;
  } | null;
}

export interface CreateOrderPayload {
  poNumber: string;
  buyerId: string;
  unitId: string;
  style: string;
  description?: string;
  totalQuantity: number;
  exFactoryDate: string;
  orderDate?: string;
  currency?: string;
  exchangeRate?: number;
  fobPricePerPiece?: number;
  sizeBreakdowns: {
    size: string;
    color: string;
    plannedQty: number;
  }[];
}

export interface UpdateExFactoryDatePayload {
  newExFactoryDate: string;
  reasonCode: string;
  notes?: string;
  financialImpactRupees?: number;
}

export interface BulkShiftExFactoryDatePayload {
  orderIds: string[];
  shiftDays?: number;
  newExFactoryDate?: string;
  reasonCode: string;
  notes?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Feature 5: Transparent Show-Your-Math Run-Rate Engine Types
export interface FormulaBreakdown {
  formula: string;
  substituted: string;
  result: number;
}

export interface MathExplanationPayload {
  requiredRateMath: FormulaBreakdown;
  actualRateMath: FormulaBreakdown;
  varianceMath: FormulaBreakdown;
  daysLateMath: FormulaBreakdown;
  workingDaysTotal: number;
  downstreamBufferDays: number;
  effectiveWorkingDays: number;
  remainingPieces: number;
  weightsApplied: { day1: number; day2: number; day3: number };
  recentLogsSample: { date: string; quantity: number }[];
  rulesTriggered: string[];
}

export interface RiskEvaluationResult {
  riskLevel: RiskLevel;
  isCompleted?: boolean;
  requiredDailyRate: number;
  actualRollingRate: number;
  varianceQtyPerDay: number;
  differencePill: string;
  workingDaysNeeded: number;
  projectedCompletionDate: string;
  daysLate: number;
  financialExposureRupees: number;
  mathBreakdown: MathExplanationPayload;
  rulesTriggered: string[];
}

export interface RiskItem {
  orderId: string;
  poNumber: string;
  style: string;
  buyer: { id: string; name: string; code: string };
  unit: { id: string; name: string; code: string; type: string };
  totalQuantity: number;
  exFactoryDate: string;
  workingDaysLeft: number;
  shipWeek?: number;
  activeStage: Stage;
  milestoneId?: string;
  riskLevel: RiskLevel;
  isCompleted?: boolean;
  requiredDailyRate: number;
  actualRollingRate: number;
  varianceQtyPerDay: number;
  differencePill: string;
  workingDaysNeeded: number;
  projectedCompletionDate: string;
  daysLate: number;
  financialExposureRupees: number;
  mathBreakdown: MathExplanationPayload;
  rulesTriggered: string[];
  recentDailyLogs?: { date: string; quantity: number }[];
}

export interface RiskSummary {
  totalMonitoredOrders: number;
  redCount: number;
  amberCount: number;
  greenCount: number;
  completedCount?: number;
  totalExposureRupees: number;
}

export interface RiskListResponse {
  summary: RiskSummary;
  risks: RiskItem[];
}

export interface RateSimulationResult {
  simulatedRate: number;
  requiredDailyRate: number;
  variance: number;
  workingDaysNeeded: number;
  projectedCompletionDate: string;
  daysLate: number;
  simulatedRisk: RiskLevel;
  financialExposureRupees: number;
}

// ==========================================
// Feature 6: Supervisor Mobile PWA Types
// ==========================================

export interface SupervisorActiveMilestone {
  id: string;
  stage: Stage;
  sequenceOrder: number;
  targetQuantity: number;
  completedQuantity: number;
  remainingQuantity: number;
  progressPct: number;
}

export interface SupervisorWorkOrderItem {
  orderId: string;
  poNumber: string;
  style: string;
  description?: string | null;
  totalQuantity: number;
  exFactoryDate: string;
  buyer: { id: string; name: string; code: string };
  unit: { id: string; name: string; code: string; type?: string };
  activeMilestone: SupervisorActiveMilestone | null;
  isCompleted?: boolean;
  milestones: {
    id: string;
    stage: Stage;
    sequenceOrder: number;
    targetQuantity: number;
    completedQuantity: number;
    isCompleted: boolean;
  }[];
  orderLines: OrderLine[];
  overallProgress: number;
}

export interface SupervisorWorkResponse {
  unit: { id: string; name: string; code: string; type: string } | null;
  allUnits?: { id: string; name: string; code: string; type: string }[];
  assignedOrdersCount: number;
  orders: SupervisorWorkOrderItem[];
  recentUpdates: {
    id: string;
    idempotencyKey: string;
    poNumber: string;
    style: string;
    stage: Stage;
    shift: string;
    machineLine?: string | null;
    goodQuantity: number;
    rejectedQuantity: number;
    notes?: string | null;
    clientEventAt: string;
    approvalStatus: ApprovalStatus;
    issueCategory?: string | null;
  }[];
}

