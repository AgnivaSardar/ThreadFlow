import { Stage, UnitType, Role, RiskLevel, ApprovalStatus, GatePassStatus } from '@prisma/client';

export type SeedProfile = 'calibrated' | 'stress' | 'minimal' | 'master-only';

export interface SeedCliOptions {
  profile: SeedProfile;
  clean: boolean;
  stressCount?: number;
  forceDestructiveWipe?: boolean;
  confirmationKey?: string;
  verbose?: boolean;
}

export interface BuyerFixture {
  name: string;
  code: string;
  country: string;
  contactEmail: string;
}

export interface UnitFixture {
  name: string;
  code: string;
  type: UnitType;
  location: string;
}

export interface UserFixture {
  email: string;
  name: string;
  role: Role;
  languagePreference: string;
  phone?: string;
  assignedUnitCode?: string;
  buyerCode?: string;
}

export interface OrderLineFixture {
  size: string;
  color: string;
  plannedQty: number;
}

export interface MilestoneFixture {
  stage: Stage;
  sequenceOrder: number;
  plannedStartOffsetDays: number;
  plannedEndOffsetDays: number;
  bufferDaysAhead: number;
  targetQuantity: number;
  completedQuantity: number;
  unitCode: string;
}

export interface DailyLogFixture {
  dateOffsetDays: number;
  completedQty: number;
  reworkQty: number;
  rejectedQty: number;
  stage: Stage;
  unitCode: string;
  userEmail: string;
  shift: string;
  operatorNotes: string;
}

export interface PhotoFixture {
  caption: string;
  category: string;
  mimeType: string;
  fileName: string;
}

export interface RiskWarningFixture {
  stage: Stage;
  riskLevel: RiskLevel;
  requiredDailyRate: number;
  actualRollingRate: number;
  varianceQtyPerDay: number;
  projectedCompletionDaysLate: number;
  financialExposureRupees: number;
  mathBreakdown: any;
  mitigationPlan: string;
  isBuyerVisible: boolean;
  approvalStatus: ApprovalStatus;
}

export interface GatePassFixture {
  passNumber: string;
  destinationUnitCode: string;
  stage: Stage;
  quantityDispatched: number;
  quantityReturned?: number;
  status: GatePassStatus;
  outwardOffsetDays: number;
  expectedReturnOffsetDays: number;
  actualReturnOffsetDays?: number;
  vehicleNumber: string;
}

export interface CalibratedOrderFixture {
  poNumber: string;
  buyerCode: string;
  unitCode: string;
  style: string;
  description: string;
  totalQuantity: number;
  fobPricePerPiece: number;
  currency: string;
  exchangeRate: number;
  exFactoryDateStr: string;
  orderLines: OrderLineFixture[];
  milestones: MilestoneFixture[];
  dailyLogs: DailyLogFixture[];
  photos?: PhotoFixture[];
  riskWarnings?: RiskWarningFixture[];
  gatePasses?: GatePassFixture[];
}
