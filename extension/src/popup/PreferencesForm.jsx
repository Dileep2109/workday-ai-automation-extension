import { useState, useEffect } from 'react';

const DEFAULT_PREFS = {
  gender: '',
  workAuthorization: '',
  visaSponsorship: false,
  veteranStatus: '',
  disabilityStatus: '',
  raceEthnicity: '',
  currentCompany: '',
  noticePeriod: '',
  yearsOfExperience: '',
  currentCTC: '',
  expectedCTC: '',
  preferredLocation: '',
  heardAboutUs: ''
};

const REMOVED_PREF_KEYS = new Set(['linkedin', 'github', 'portfolio']);

export default function PreferencesForm() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['userPreferences'], (result) => {
      if (result.userPreferences) {
        const cleanedPrefs = removeDeprecatedPrefs(result.userPreferences);
        setPrefs({ ...DEFAULT_PREFS, ...cleanedPrefs });
        if (Object.keys(cleanedPrefs).length !== Object.keys(result.userPreferences).length) {
          chrome.storage.local.set({ userPreferences: cleanedPrefs });
        }
      }
    });
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPrefs(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setSaved(false);
  };

  const handleCustomDelete = (key) => {
    const newPrefs = { ...prefs };
    delete newPrefs[key];
    setPrefs(newPrefs);
    setSaved(false);
  };

  const handleSave = () => {
    chrome.storage.local.set({ userPreferences: prefs }, () => {
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const savedPrefs = Object.entries(prefs).filter(([key, value]) => {
    if (REMOVED_PREF_KEYS.has(key)) return false;
    if (typeof value === 'boolean') return value;
    return String(value || '').trim() !== '';
  });

  if (!editing && savedPrefs.length > 0) {
    return (
      <div className="preferences-form">
        <div className="prefs-summary-card">
          <div>
            <h3>Application Preferences</h3>
            <p className="help-text">{savedPrefs.length} saved value{savedPrefs.length === 1 ? '' : 's'} ready for autofill.</p>
          </div>
          <button className="secondary-btn compact-btn" onClick={() => setEditing(true)}>
            Edit
          </button>
        </div>

        <div className="prefs-chip-list">
          {savedPrefs.slice(0, 6).map(([key, value]) => (
            <span className="prefs-chip" key={key}>
              {formatPreferenceLabel(key)}: {typeof value === 'boolean' ? 'Yes' : value}
            </span>
          ))}
          {savedPrefs.length > 6 && <span className="prefs-chip">+{savedPrefs.length - 6} more</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="preferences-form">
      <div className="prefs-form-header">
        <div>
          <h3>Application Preferences</h3>
          <p className="help-text">These values will be prioritized over AI guesses.</p>
        </div>
        {savedPrefs.length > 0 && (
          <button className="secondary-btn compact-btn" onClick={() => setEditing(false)}>
            Close
          </button>
        )}
      </div>
      
      <div className="form-group">
        <label>Gender</label>
        <select name="gender" value={prefs.gender} onChange={handleChange}>
          <option value="">Select...</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Decline to specify">Decline to specify</option>
        </select>
      </div>

      <div className="form-group">
        <label>Work Authorization</label>
        <select name="workAuthorization" value={prefs.workAuthorization} onChange={handleChange}>
          <option value="">Select...</option>
          <option value="Authorized to work">Authorized to work</option>
          <option value="Require sponsorship">Require sponsorship</option>
        </select>
      </div>

      <div className="form-group checkbox-group">
        <label>
          <input 
            type="checkbox" 
            name="visaSponsorship" 
            checked={prefs.visaSponsorship} 
            onChange={handleChange} 
          />
          Require Visa Sponsorship?
        </label>
      </div>

      <div className="form-group">
        <label>Veteran Status</label>
        <select name="veteranStatus" value={prefs.veteranStatus} onChange={handleChange}>
          <option value="">Select...</option>
          <option value="I am not a protected veteran">I am not a protected veteran</option>
          <option value="I identify as one or more of the classifications of a protected veteran">I identify as a protected veteran</option>
          <option value="I don't wish to answer">I don't wish to answer</option>
        </select>
      </div>

      <div className="form-group">
        <label>Disability Status</label>
        <select name="disabilityStatus" value={prefs.disabilityStatus} onChange={handleChange}>
          <option value="">Select...</option>
          <option value="No, I don't have a disability">No, I don't have a disability</option>
          <option value="Yes, I have a disability (or previously had a disability)">Yes, I have a disability</option>
          <option value="I don't wish to answer">I don't wish to answer</option>
        </select>
      </div>

      <div className="form-group">
        <label>Race/Ethnicity</label>
        <select name="raceEthnicity" value={prefs.raceEthnicity} onChange={handleChange}>
          <option value="">Select...</option>
          <option value="Asian">Asian</option>
          <option value="White">White</option>
          <option value="Black or African American">Black or African American</option>
          <option value="Hispanic or Latino">Hispanic or Latino</option>
          <option value="Decline to specify">Decline to specify</option>
        </select>
      </div>

      <div className="form-group">
        <label>How did you hear about us?</label>
        <select name="heardAboutUs" value={prefs.heardAboutUs} onChange={handleChange}>
          <option value="">Select...</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="Company Website">Company Website</option>
          <option value="Referral">Referral</option>
          <option value="Indeed">Indeed</option>
          <option value="Glassdoor">Glassdoor</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="form-group">
        <label>Current Company</label>
        <input type="text" name="currentCompany" value={prefs.currentCompany} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>Notice Period</label>
        <input type="text" name="noticePeriod" placeholder="e.g., 2 weeks, Immediate" value={prefs.noticePeriod} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>Years of Experience</label>
        <input type="text" name="yearsOfExperience" value={prefs.yearsOfExperience} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>Current CTC</label>
        <input type="text" name="currentCTC" value={prefs.currentCTC} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>Expected CTC</label>
        <input type="text" name="expectedCTC" value={prefs.expectedCTC} onChange={handleChange} />
      </div>

      <div className="form-group">
        <label>Preferred Location</label>
        <input type="text" name="preferredLocation" value={prefs.preferredLocation} onChange={handleChange} />
      </div>

      {Object.keys(prefs).filter(key => !(key in DEFAULT_PREFS) && !REMOVED_PREF_KEYS.has(key)).length > 0 && (
        <div className="custom-preferences" style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Custom Saved Fields</h4>
          <p className="help-text" style={{ marginBottom: '15px' }}>Custom values saved in your profile.</p>
          {Object.keys(prefs).filter(key => !(key in DEFAULT_PREFS) && !REMOVED_PREF_KEYS.has(key)).map(key => (
            <div className="form-group custom-group" key={key} style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
              <div style={{flex: 1}}>
                <label>{key}</label>
                <input type="text" name={key} value={prefs[key]} onChange={handleChange} />
              </div>
              <button 
                className="delete-btn" 
                onClick={() => handleCustomDelete(key)}
                style={{marginTop: '16px', background: '#ff4d4d', color: 'white', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer'}}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="save-btn" onClick={handleSave} style={{ marginTop: '20px' }}>
        {saved ? 'Saved!' : 'Save Preferences'}
      </button>
    </div>
  );
}

function formatPreferenceLabel(key) {
  const labels = {
    gender: 'Gender',
    workAuthorization: 'Authorization',
    visaSponsorship: 'Visa sponsorship',
    veteranStatus: 'Veteran',
    disabilityStatus: 'Disability',
    raceEthnicity: 'Race/ethnicity',
    currentCompany: 'Company',
    noticePeriod: 'Notice',
    yearsOfExperience: 'Experience',
    currentCTC: 'Current CTC',
    expectedCTC: 'Expected CTC',
    preferredLocation: 'Location',
    heardAboutUs: 'Source'
  };

  return labels[key] || key;
}

function removeDeprecatedPrefs(prefs) {
  return Object.fromEntries(
    Object.entries(prefs || {}).filter(([key]) => !REMOVED_PREF_KEYS.has(key))
  );
}
