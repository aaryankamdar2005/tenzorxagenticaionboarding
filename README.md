# 🛡️ SecureBank Agentic AI Video KYC

SecureBank is a state-of-the-art digital onboarding platform that leverages Agentic AI, computer vision, and strict regulatory guardrails to perform secure, remote Video KYC (Know Your Customer) for institutional loan applications.

![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)
![Stack](https://img.shields.io/badge/stack-FastAPI%20%7C%20Next.js%20%7C%20MongoDB-emerald.svg)
![AI](https://img.shields.io/badge/AI-Computer%20Vision%20%7C%20Agentic%20LLM-purple.svg)
![Compliance](https://img.shields.io/badge/Compliance-Regulatory%20Guardrails-red.svg)

## 🚀 Key Features

### 1. Agentic AI Interviewer (Aria)
- **Natural Conversation**: A voice-enabled AI agent conducts the KYC interview.
- **Dynamic Language Support**: Real-time switching between English, Hindi, and other regional languages.
- **Field Extraction**: Automatically extracts KYC data (Name, DOB, Income, etc.) from the conversation.

### 2. Advanced Biometric Verification
- **Liveness Detection**: Anti-spoofing checks using Eye Aspect Ratio (EAR) for blinks, head yaw for turns, and expression analysis for smiles.
- **AI Age Estimation**: Real-time facial age detection using a mode-based tracking algorithm (calculating the most recurring age over a rolling window).
- **Face Matching**: Ensures the person in the video matches the identity document.

### 3. Smart Document Processing & Underwriting
- **Multi-Document Capture**: Integrated OCR for PAN and Aadhaar cards.
- **FOIR Enforcement**: Automated "Fixed Obligation to Income Ratio" check. Rejects any applicant whose debt-to-income ratio exceeds 50% based on their bureau profile and declared income.
- **Authenticity Checks**: Cross-references spoken data with document metadata.

### 4. Regulatory Guardrails
- **Eligibility Pre-Check**: Automatic gating of users before session initiation based on rolling bureau history.
- **Cooling-Off Periods**: Mandatory 180-day block after an application rejection.
- **Inquiry Limits**: Dynamic restriction if more than 2 credit inquiries are detected within a 30-day window.
- **Automatic Reset**: Database-backed rolling windows ensure eligibility is automatically restored once the cooling-off or inquiry period expires.

### 5. Security & Fraud Prevention
- **Geo-Fencing**: Detects location mismatches between IP and GPS data.
- **Stress Detection**: Analyzes speech patterns for signs of coercion or stress.
- **Audit Logs**: Every verification step is logged in a secure, immutable audit trail.

## ⚙️ How it Works: Regulatory Logic

| Rule | Threshold | Reset Mechanism |
| :--- | :--- | :--- |
| **Cooling-Off** | 180 Days | Automatic (Day 181) |
| **Inquiry Limit** | 2 per 30 Days | Rolling (Day 31) |
| **FOIR Limit** | > 50% Debt | Manual Review |

## 🛠️ Technical Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS, Framer Motion, Lucide React.
- **Computer Vision**: `face-api.js` (TensorFlow.js) for browser-side facial analysis.
- **Backend**: FastAPI (Python), WebSocket for real-time streaming, Pydantic for schema validation.
- **AI/LLM**: Groq Llama-3 (Agent logic), Whisper (STT).
- **Database**: MongoDB (User profiles, Sessions, Audit logs, Transcripts).

---

## 📦 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB instance

### Backend Setup
1. Navigate to the `backend` directory.
2. Install dependencies: `pip install -r requirements.txt`
3. Configure your `.env` file with Groq and Database keys.
4. Start the server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### Frontend Setup
1. Navigate to the `frontend` directory.
2. Install dependencies: `npm install`
3. Ensure face-api models are present in `public/models/`.
4. Start the dev server:
   ```bash
   npm run dev
   ```

---

## 🔐 Compliance & Privacy
- **AES-256 Encryption** for all PII data in transit and at rest.
- **Regulatory Ready**: Built to comply with RBI/Central Bank guidelines for video-based identity verification.
- **Dynamic Guardrails**: Implements automated business rules to prevent predatory lending and ensure credit quality.
