export type BackendEventType =
  | "CONNECTED"
  | "TRANSCRIPT_UPDATE"
  | "AGENT_REPLY"
  | "EXTRACTED_FIELDS"
  | "CONSENT_DETECTED"
  | "LIVENESS_CHALLENGE"
  | "LIVENESS_ACK"
  | "DOC_VERIFIED"
  | "GEO_RESULT"
  | "PROCESSING_OFFER"
  | "OFFER_READY"
  | "FINAL_SCORE"
  | "SESSION_FAILED"
  | "ERROR"
  | "TTS_AUDIO";

export interface BackendEvent {
  type: BackendEventType;
  payload?: Record<string, unknown>;
}

export interface SessionResponse {
  session_id: string;
}

export interface KYCFields {
  full_name?: string | null;
  dob?: string | null;
  employer?: string | null;
  tenure_at_employer?: string | null;
  income_declaration?: number | null;
  monthly_emi_obligations?: number | null;
  property_ownership?: string | null;
  loan_purpose?: string | null;
  explicit_consent?: boolean;
  stress_flag?: boolean;
  stress_reasons?: string[];
  is_complete?: boolean;
  next_field_needed?: string | null;
}

export interface OfferResult {
  status: "APPROVED" | "REJECTED" | "REVIEW";
  amount?: number | null;
  roi?: number | null;
  tenure_months?: number | null;
  reason?: string | null;
  cibil_score?: number | null;
  dti_ratio?: number | null;
  income_verification_status?: string | null;
}

export interface LivenessResultPayload {
  challenge: string;
  passed: boolean;
  attempts: number;
}

export interface DocExtractResult {
  document_type: string;
  ocr_raw_text?: string | null;
  extracted: {
    name?: string | null;
    dob?: string | null;
    id_number?: string | null;
    verified_monthly_income?: number | null;
    account_holder_name?: string | null;
    bank_name?: string | null;
    income_source?: string | null;
  };
  match_score: number;
  is_match: boolean;
  error?: string;
}

export interface DocVerifyResult {
  ocr_name?: string | null;
  ocr_dob?: string | null;
  match_score: number;
  is_match: boolean;
  ocr_raw_text?: string | null;
}

export interface GeoResult {
  distance_km?: number | null;
  is_mismatch: boolean;
  ip_address?: string | null;
}

export interface FinalScore {
  confidence_score: number;
  approval_recommendation: "APPROVE" | "REJECT" | "MANUAL_REVIEW";
  reasons: string[];
}

export interface BureauReport {
  pan_number: string;
  cibil_score: number;
  active_trade_lines: number;
  historical_defaults: boolean;
  report_date: string;
}

// ── Auth types ────────────────────────────────────────────────────

export type UserRole = "customer" | "banker";

export interface AuthToken {
  access_token: string;
  token_type: string;
  role: UserRole;
  name: string;
  user_id: string;
}

// ── Admin types ────────────────────────────────────────────────────

export interface AdminSession {
  _id?: string;
  session_id: string;
  source?: string;
  state?: string;
  created_at?: string;
  user_id?: string;
  customer_name?: string;
  latest_extraction?: KYCFields;
  latest_offer?: OfferResult;
  liveness_result?: LivenessResultPayload;
  document_verification?: DocVerifyResult;
  geo_result?: GeoResult;
  final_score?: FinalScore;
  review_status?: "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";
  conversation_history?: Array<{ role: string; content: string }>;
  bureau_data?: BureauReport;
  underwriting_result?: {
    decision: string;
    cibil_score: number;
    dti_ratio: number;
    income_verification_status: string;
    loan_amount?: number | null;
    interest_rate?: number | null;
    tenure_months?: number | null;
    reject_reasons: string[];
    review_reasons: string[];
  };
}
