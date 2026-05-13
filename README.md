# AI-Powered Workday Automation Extension

This project contains an MVP for automating Workday job application submissions using AI. It consists of a FastAPI backend to handle parsing and AI mapping, and a Chrome Extension (Manifest V3) that interacts with Workday DOM to autofill fields based on the parsed data.

## Project Structure
- `/backend`: Python FastAPI application handling Resume parsing and OpenAI integration.
- `/extension`: React + Vite Chrome Extension (Manifest V3) that performs DOM automation.

## Prerequisites
- Node.js (v18+)
- Python (3.9+)
- Chrome Browser

## Backend Setup
1. Open a terminal and navigate to the `backend` directory.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file in the `backend` folder and add your OpenAI API Key:
   ```
   OPENAI_API_KEY=your-api-key-here
   ```
4. Start the backend server:
   ```bash
   python main.py
   ```
   The API will run on `http://localhost:8000`.

## Extension Setup
1. Open a terminal and navigate to the `extension` directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
   This will generate a `dist` folder.
4. Open Chrome and go to `chrome://extensions/`.
5. Enable **Developer Mode** (toggle in the top right corner).
6. Click **Load unpacked** and select the `dist` folder from the `extension` directory.

## Usage
1. Navigate to a Workday job application (e.g., NVIDIA or Netflix).
2. Click the extension icon to open the popup.
3. Upload a PDF or DOCX resume. Click **Parse Resume**.
4. Once parsed, click **Start Autofill**.
5. The extension will map fields, fill them, and show you a review screen of what was filled, what was skipped due to low confidence, and what was unresolved.

## Key Features
- **Semantic Field Mapping**: Uses OpenAI to smartly match fields (e.g., "Given Name" -> "firstName").
- **Confidence Scoring**: Only autofills fields with >70% confidence. Low confidence fields are skipped and flagged for manual review.
- **React-Controlled Inputs**: Uses native value setters to bypass React event pooling and correctly triggers `input`, `change`, and `blur` events.
- **Retry Mechanisms**: Uses `MutationObserver` and polling to handle dynamic Workday DOM changes.
