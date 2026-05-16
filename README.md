# AI-Powered Workday Automation Extension

AI-powered Chrome extension for automating Workday job applications using resume parsing, semantic field mapping, and intelligent DOM automation.

---

# Project Overview

This project is a Manifest V3 Chrome extension backed by a FastAPI AI service.

The system automates repetitive Workday application workflows by:

- Parsing resumes into structured JSON
- Detecting Workday fields dynamically
- Mapping fields using heuristics + AI semantic matching
- Autofilling multi-step forms
- Handling React-controlled inputs
- Reusing parsed candidate information across application steps
- Stopping safely for manual review before submission

The goal is to automate repetitive Workday application workflows while keeping final user review and submission manual for reliability and safety.

---

# Tech Stack

## Backend
- Python 3
- FastAPI
- Pydantic
- OpenAI API
- pdfplumber
- python-docx

## Chrome Extension
- React
- Vite
- Manifest V3
- Chrome Storage API

---

# Project Structure

```txt
/backend
  /routes
  /services
  /models
  /prompts

/extension
  /src
  /dist
```

---

# Features

## Resume Parsing
- Upload PDF/DOCX resumes
- Extract structured candidate information
- Convert unstructured text into application-ready JSON

## AI Semantic Field Mapping
Maps dynamic Workday fields intelligently.

Examples:
- "Given Name" → `firstName`
- "Mobile Phone" → `phone`
- "Current Employer" → experience/company

## React-Controlled Input Handling
Uses native value setters + DOM events:
- input
- change
- blur

Ensures React state synchronizes correctly with Workday forms.

## Multi-Step Workflow Handling
Supports:
- Personal information pages
- Skills pages
- Application question pages
- Review flows

## Parsed Candidate Information Collector

After uploading and parsing a resume, the extension extracts structured candidate information and stores it locally for reuse during the Workday application flow.

The parsed profile information is reused across multiple application steps to reduce repetitive manual entry.

Example reusable information:
- Full Name
- Email
- Phone Number
- Address
- LinkedIn Profile
- Skills
- Resume-derived details

## Validation Error Detection
Automation safely pauses when Workday validation errors are detected.

This prevents:
- Infinite submit loops
- Incorrect submissions
- Unsafe automation behavior

## Confidence-Based Review System
Low-confidence fields are:
- skipped
- flagged
- shown for manual review

---

# Backend Setup

## 1. Navigate to backend

```bash
cd backend
```

## 2. Install dependencies

```bash
pip install -r requirements.txt
```

## 3. Create `.env`

```env
OPENAI_API_KEY=your_api_key
```

## 4. Start backend

```bash
python main.py
```

Backend runs on:

```txt
http://localhost:8000
```

---

# Extension Setup

## 1. Navigate to extension

```bash
cd extension
```

## 2. Install dependencies

```bash
npm install
```

## 3. Build extension

```bash
npm run build
```

## 4. Load extension

Open:

```txt
chrome://extensions
```

- Enable Developer Mode
- Click "Load unpacked"
- Select:

```txt
extension/dist
```

---

# Demo Flow

## 1. Upload Resume
- Upload PDF/DOCX resume
- Parse structured candidate data

## 2. Start Autofill
- Detect Workday fields
- Autofill supported fields
- Reuse parsed candidate information

## 3. Multi-Step Navigation
- Continue autofill across application steps
- Reuse previously parsed candidate data

## 4. Validation Safety
- Detect Workday validation errors
- Pause automation for manual review

## 5. Final Review
- Show filled/skipped fields
- Stop before manual submission

---

# Supported Field Types

- Text inputs
- Textareas
- Dropdowns / Comboboxes
- Email fields
- Phone fields
- Skills
- Profile links
- Basic application questions

---

# Current Limitations

- Some complex Workday dropdown implementations vary between companies
- Repeatable sections like Education and Experience may still require partial manual interaction
- Certain skills and application-specific fields may not autofill consistently across all Workday implementations
- Dynamic Workday DOM structures differ slightly between organizations
- Final submission intentionally remains manual for user review and safety

---

# Future Improvements

- Improved Education and Experience section automation
- Better dropdown intelligence and selection handling
- Enhanced skills extraction and autofill support
- AI-assisted validation error correction
- Smarter company/location inference from resume context
- Adaptive learning from previous application behavior
- Reusable profile editing and management UI
- Support for additional ATS platforms beyond Workday
- More advanced multi-step workflow orchestration

---

# Deployment

## Backend
Deployed using Render.

## Extension
Prebuilt extension available inside:

```txt
extension/dist
```

---

# Submission Checklist

- Full source code
- Prebuilt extension
- README documentation
- Demo video walkthrough
- Backend deployment
- Manual review safety

---

# Short Project Pitch

This project is an AI-powered Manifest V3 Chrome extension designed to automate Workday job applications using resume parsing, semantic field mapping, and intelligent DOM automation.

The system combines:
- FastAPI backend
- AI-assisted field mapping
- React-based Chrome extension
- Multi-step workflow automation
- Validation-aware safety checks
- Parsed candidate information reuse

to reduce repetitive job application effort while preserving user review and submission control.
