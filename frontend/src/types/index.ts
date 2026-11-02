export type Role = 'MERCHANDISER' | 'SUPERVISOR' | 'BUYER' | 'ADMIN';

export type Stage =
  | 'KNITTING'
  | 'DYEING_WASHING'
  | 'PRINTING'
  | 'CUTTING'
  | 'STITCHING'
  | 'CHECKING'
  | 'FINISHING';

export type RiskLevel = 'GREEN' | 'AMBER' | 'RED';

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
