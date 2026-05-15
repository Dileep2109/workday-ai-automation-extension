import { useState, useEffect } from 'react';
import PreferencesForm from './PreferencesForm';

const API_BASE = 'https://workday-ai-backend.onrender.com';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [resumeData, setResumeData] = useState(null);
  const [reviewData, setReviewData] = useState(null);

  useEffect(() => {
    // Load existing parsed data if any
    chrome.storage.local.get(['resumeData'], (result) => {
      if (result.resumeData) {
        setResumeData(result.resumeData);
        setStatus('Resume loaded from storage.');
      }
    });
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleParse = async () => {
    if (!file) return;
    setLoading(true);
    setStatus('Parsing resume...');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/parse-resume`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse resume');
      }

      const data = await response.json();
      setResumeData(data);
      
      const resumeFile = await fileToStoredResume(file);

      // Save parsed data and original resume file to chrome storage
      chrome.storage.local.set({ resumeData: data, resumeFile }, () => {
        setStatus('Resume parsed and saved successfully!');
      });
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAutofill = async () => {
    if (!resumeData) {
      setStatus('Please upload and parse a resume first.');
      return;
    }
    
    setStatus('Initiating autofill...');
    setReviewData(null);
    setLoading(true);

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'START_AUTOFILL' }, (response) => {
          if (chrome.runtime.lastError) {
            setStatus('Error: Content script not found. Are you on a Workday page?');
            setLoading(false);
            return;
          }
          if (response && response.status === 'completed') {
            if (response.data && response.data.success) {
              setStatus(response.data.message || 'Autofill completed.');
              setReviewData(response.data.results);
            } else {
               setStatus(`Autofill failed: ${response.data.message || 'Unknown error'}`);
               if (response.data && response.data.results) {
                 setReviewData(response.data.results);
               }
            }
          }
          setLoading(false);
        });
      }
    } catch (err) {
      setStatus(`Error communicating with page: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <h2>Workday AI Autofill</h2>
      
      <div className="section">
        <h3>1. Upload Resume (PDF/DOCX)</h3>
        <input type="file" accept=".pdf,.docx" onChange={handleFileChange} />
        <button onClick={handleParse} disabled={!file || loading}>
          {loading ? 'Parsing...' : 'Parse Resume'}
        </button>
      </div>

      {resumeData && (
        <div className="section">
          <h3>2. Parsed Data Ready</h3>
          <p>Candidate: {resumeData.firstName} {resumeData.lastName}</p>
          <p>Email: {resumeData.email}</p>
        </div>
      )}

      <div className="section">
        <h3>User Preferences</h3>
        <PreferencesForm />
      </div>

      <div className="section">
        <h3>3. Autofill Application</h3>
        <button onClick={handleAutofill} disabled={!resumeData || loading}>
          {loading ? 'Autofilling...' : 'Start Autofill'}
        </button>
      </div>

      {reviewData && (
        <div className="section review-section">
          <h3>Autofill Summary</h3>
          <div className="summary-stats">
            <p><strong>Total Filled:</strong> {reviewData.filled.length}</p>
            <p className="sub-stat">- From Preferences: {reviewData.filled.filter(f => f.source === 'preference').length}</p>
            <p className="sub-stat">- From Heuristics: {reviewData.filled.filter(f => f.source === 'heuristic').length}</p>
            <p className="sub-stat">- From AI: {reviewData.filled.filter(f => f.source === 'ai').length}</p>
            <p><strong>Skipped:</strong> {reviewData.skipped.length}</p>
            <p><strong>Missing/Unresolved:</strong> {reviewData.unresolved.length}</p>
          </div>

          {reviewData.skipped.length > 0 && (
            <>
              <h4>Skipped Fields</h4>
              <ul className="review-list">
                {reviewData.skipped.map((item, idx) => (
                  <li key={idx}>
                    <strong>{item.label}</strong>: {item.suggested} <em>({(item.confidence * 100).toFixed(0)}%)</em>
                  </li>
                ))}
              </ul>
            </>
          )}
          {reviewData.unresolved.length > 0 && (
            <>
              <h4>Missing Values</h4>
              <ul className="review-list">
                {reviewData.unresolved.map((label, idx) => (
                  <li key={idx}>{label}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {status && <div className="status">{status}</div>}
    </div>
  );
}

export default App;

function fileToStoredResume(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        type: file.type || getResumeMimeType(file.name),
        dataUrl: reader.result
      });
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read resume file'));
    reader.readAsDataURL(file);
  });
}

function getResumeMimeType(fileName) {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}
