import { AdminSession, AuthToken, BureauReport, DocExtractResult, FinalScore, SessionResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { headers, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error((err as { detail?: string }).detail ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function registerUser(
  name: string, email: string, password: string, role: "customer" | "banker"
): Promise<AuthToken> {
  return apiFetch<AuthToken>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, role }),
  });
}

export async function loginUser(email: string, password: string): Promise<AuthToken> {
  return apiFetch<AuthToken>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function saveAuth(token: AuthToken) {
  if (typeof window === "undefined") return;
  localStorage.setItem("auth_token", JSON.stringify(token));
}

export function loadAuth(): AuthToken | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("auth_token");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearAuth() {
  if (typeof window !== "undefined") localStorage.removeItem("auth_token");
}

// ── Session management ────────────────────────────────────────────────────────

export async function createSession(): Promise<SessionResponse> {
  const auth = loadAuth();
  const body: Record<string, string> = { source: "landing_page" };
  if (auth?.user_id) body.user_id = auth.user_id;
  // Pass the auth token so the backend links the session to this user
  return apiFetch<SessionResponse>("/api/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  }, auth?.access_token ?? undefined);
}

export async function fetchCustomerSessions(token: string): Promise<AdminSession[]> {
  return apiFetch<AdminSession[]>("/api/customer/sessions", {}, token);
}

// ── Document extraction ───────────────────────────────────────────────────────

export async function extractDocument(
  sessionId: string,
  blob: Blob,
  documentType: string,
  spokenName?: string | null,
  spokenDob?: string | null,
): Promise<DocExtractResult> {
  const form = new FormData();
  form.append("file", blob, "document.jpg");
  form.append("session_id", sessionId);
  form.append("document_type", documentType);
  if (spokenName) form.append("spoken_name", spokenName);
  if (spokenDob) form.append("spoken_dob", spokenDob);

  const res = await fetch(`${API_URL}/api/extract-document`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as { detail?: string }));
    throw new Error(err.detail ?? `Server error ${res.status}`);
  }
  return res.json();
}

// ── Bureau ────────────────────────────────────────────────────────────────────

export async function fetchBureauReport(panNumber: string): Promise<BureauReport> {
  return apiFetch<BureauReport>(`/api/bureau/credit-report/${encodeURIComponent(panNumber)}`);
}

// ── Admin API ─────────────────────────────────────────────────────────────────

export async function fetchAdminSessions(
  page = 1, limit = 20
): Promise<{ sessions: AdminSession[]; total: number; page: number; limit: number }> {
  return apiFetch(`/api/admin/sessions?page=${page}&limit=${limit}`);
}

export async function fetchSessionDetail(sessionId: string): Promise<AdminSession & {
  transcripts: Array<{ user: string; agent: string; created_at: string }>;
}> {
  return apiFetch(`/api/admin/sessions/${sessionId}`);
}

export async function updateSessionReview(
  sessionId: string,
  action: "APPROVED" | "REJECTED" | "FLAGGED",
  notes?: string
): Promise<{ ok: boolean; status: string }> {
  return apiFetch(`/api/admin/sessions/${sessionId}/review`, {
    method: "POST",
    body: JSON.stringify({ action, notes }),
  });
}

export async function fetchFinalScore(sessionId: string): Promise<FinalScore | null> {
  const detail = await fetchSessionDetail(sessionId);
  return detail.final_score ?? null;
}
