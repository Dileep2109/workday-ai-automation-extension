import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

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
      
      // Save to chrome storage
      chrome.storage.local.set({ resumeData: data }, () => {
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
              setStatus('Autofill completed for current step.');
              setReviewData(response.data.results);
            } else {
               setStatus(`Autofill failed: ${response.data.message || 'Unknown error'}`);
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
        <h3>3. Autofill Application</h3>
        <button onClick={handleAutofill} disabled={!resumeData || loading}>
          {loading ? 'Autofilling...' : 'Start Autofill'}
        </button>
      </div>

      {reviewData && (
        <div className="section review-section">
          <h3>Autofill Summary</h3>
          <p><strong>Filled:</strong> {reviewData.filled.length}</p>
          <p><strong>Skipped (Low Confidence):</strong> {reviewData.skipped.length}</p>
          {reviewData.skipped.length > 0 && (
            <ul className="review-list">
              {reviewData.skipped.map((item, idx) => (
                <li key={idx}>
                  <strong>{item.label}</strong>: {item.suggested} <em>({(item.confidence * 100).toFixed(0)}%)</em>
                </li>
              ))}
            </ul>
          )}
          <p><strong>Unresolved:</strong> {reviewData.unresolved.length}</p>
        </div>
      )}

      {status && <div className="status">{status}</div>}
    </div>
  );
}

export default App;
