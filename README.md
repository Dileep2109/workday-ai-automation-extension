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
- Managing unresolved fields through reusable profile storage
- Stopping safely for manual review before submission

The goal is to automate 90–95% of repetitive Workday application workflows while keeping final user review and submission manual for reliability and safety.

---

# Tech Stack

## Backend
- Python 3
- FastAPI
- Pydantic
- Gemini / OpenAI API
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
Maps dynamic Workday fields intelligently:

Example:
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

## Missing Information Collector
If a field cannot be resolved:
- Resume data
- Stored profile
- Heuristics
- AI mapping

The extension asks the user for input and stores reusable values for future applications.

Example:
- Current Compensation
- Notice Period
- Visa Sponsorship

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
GEMINI_API_KEY=your_api_key
```

or

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

## 3. Multi-Step Navigation
- Continue autofill across application steps

## 4. Missing Information Handling
- Collect unresolved values
- Save reusable profile data

## 5. Validation Safety
- Detect Workday validation errors
- Pause automation for manual review

## 6. Final Review
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

- Some complex Workday dropdowns may vary between implementations
- Dynamic repeatable sections (education/experience) may require partial manual review
- Workday DOM structures differ slightly between companies
- Final submission remains manual intentionally

---

# Future Improvements

- Better repeatable section automation
- Improved dropdown intelligence
- Smarter validation correction
- Profile templates
- Cross-platform ATS support
- Adaptive learning from previous applications

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
- Reusable profile storage

to reduce repetitive job application effort while preserving user review and submission control.