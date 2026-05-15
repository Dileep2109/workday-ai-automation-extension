/**
 * Normalizes a field label by converting to lowercase and removing special characters.
 */
function normalizeLabel(label) {
  if (!label) return '';
  // Remove asterisks, dashes, colons, and extra whitespace
  return label.toLowerCase().replace(/[*:\-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Heuristic mapping dictionary for common Workday fields to User Preferences.
 */
const PREFERENCE_MAP = {
  'gender': 'gender',
  'sex': 'gender',
  'authorization': 'workAuthorization',
  'authorized': 'workAuthorization',
  'legally authorized': 'workAuthorization',
  'sponsorship': 'visaSponsorship',
  'visa': 'visaSponsorship',
  'veteran': 'veteranStatus',
  'disability': 'disabilityStatus',
  'race': 'raceEthnicity',
  'ethnicity': 'raceEthnicity',
  'current company': 'currentCompany',
  'employer': 'currentCompany',
  'notice period': 'noticePeriod',
  'years of experience': 'yearsOfExperience',
  'experience in years': 'yearsOfExperience',
  'current ctc': 'currentCTC',
  'current salary': 'currentCTC',
  'expected ctc': 'expectedCTC',
  'expected salary': 'expectedCTC',
  'linkedin': 'linkedin',
  'github': 'github',
  'portfolio': 'portfolio',
  'website': 'portfolio',
  'preferred location': 'preferredLocation',
  'location preference': 'preferredLocation',
  'how did you hear': 'heardAboutUs',
  'source': 'heardAboutUs'
};

/**
 * Heuristic mapping dictionary for common Workday fields to Resume Data.
 */
const HEURISTIC_MAP = {
  'first name': 'firstName',
  'given name': 'firstName',
  'legal first name': 'firstName',
  'preferred first name': 'firstName',

  'last name': 'lastName',
  'family name': 'lastName',
  'legal last name': 'lastName',

  'email': 'email',
  'email address': 'email',

  'phone': 'phone',
  'phone number': 'phone',
  'mobile phone': 'phone',
  'primary phone': 'phone',

  'linkedin': 'linkedin',
  'linkedin url': 'linkedin',
  'linkedin profile': 'linkedin',

  'github': 'github',
  'github url': 'github',
  'github profile': 'github',
  'website': 'github',

  'location': 'location',
  'address': 'location',
  'city': 'location',
  'state': 'location',
  'province': 'location',
  'country': 'location',
  'skills': 'skills',
  'skill': 'skills',
  'technical skills': 'skills',
  'certifications': 'certifications',
  'certification': 'certifications',
};

/**
 * Attempts to map a field label to resume data using heuristics.
 */
export function getHeuristicMapping(fieldLabel, resumeData, preferences = null, sessionValues = null) {
  const normalizedLabel = normalizeLabel(fieldLabel);

  if (isAgreementField(normalizedLabel)) {
    return { value: true, confidence: 1.0, source: 'heuristic' };
  }

  // 1. Check Preferences First (Most Important)
  if (preferences) {
    const prefKey = getPreferenceKey(normalizedLabel);
    if (prefKey && preferences[prefKey] !== undefined && preferences[prefKey] !== '') {
      let val = preferences[prefKey];
      if (typeof val === 'boolean') {
        val = val ? 'Yes' : 'No';
      }
      return {
        value: val,
        confidence: 1.0,
        source: 'preference'
      };
    }
  }

  // 2. Check Session Values
  if (sessionValues && sessionValues[fieldLabel] !== undefined && sessionValues[fieldLabel] !== '') {
    return {
      value: sessionValues[fieldLabel],
      confidence: 1.0,
      source: 'session'
    };
  }

  // 3. Application Questions
  const applicationQuestionMatch = getApplicationQuestionMapping(normalizedLabel, resumeData);
  if (applicationQuestionMatch) return applicationQuestionMatch;

  // 4. Resume Data Heuristics
  const targetKey = getResumeHeuristicKey(normalizedLabel);
  if (targetKey && resumeData?.[targetKey]) {
    const rawValue = getResumeValueForField(targetKey, normalizedLabel, resumeData);
    return {
      value: Array.isArray(rawValue) ? rawValue.join(', ') : rawValue,
      confidence: 1.0,
      source: 'heuristic'
    };
  }

  // 5. Experience & Education
  const experienceMatch = getExperienceMapping(normalizedLabel, resumeData);
  if (experienceMatch) return experienceMatch;

  const educationMatch = getEducationMapping(normalizedLabel, resumeData);
  if (educationMatch) return educationMatch;

  return null;
}

function getResumeValueForField(targetKey, normalizedLabel, resumeData) {
  if (targetKey !== 'location') return resumeData[targetKey];

  const location = String(resumeData.location || '');
  if (wordIncludes(normalizedLabel, 'city')) return getCityFromLocation(location);
  if (matchesAny(normalizedLabel, ['state', 'province', 'region'])) return getStateFromLocation(location);
  if (wordIncludes(normalizedLabel, 'country')) return getCountryFromLocation(location);
  return location;
}

function getPreferenceKey(normalizedLabel) {
  const label = normalizedLabel.toLowerCase();

  if (matchesAny(label, [
    'require sponsorship',
    'sponsorship to legally work',
    'visa sponsorship',
    'require visa',
    'need visa',
    'work visa',
    'immigration sponsorship',
    'immigration support',
    'need sponsorship',
    'sponsorship required',
    'require employer support',
    'maintain authorization'
  ])) {
    return 'visaSponsorship';
  }

  if (matchesAny(label, [
    'legally authorized',
    'authorized to work',
    'work authorization',
    'authorization to work'
  ])) {
    return 'workAuthorization';
  }

  const exactKey = PREFERENCE_MAP[normalizedLabel];
  if (exactKey) return exactKey;

  // Fuzzy fallback
  for (const [key, mappedKey] of Object.entries(PREFERENCE_MAP)) {
    if (label.includes(key)) {
      return mappedKey;
    }
  }
  return null;
}

function getResumeHeuristicKey(normalizedLabel) {
  const exactKey = HEURISTIC_MAP[normalizedLabel];
  if (exactKey) return exactKey;

  if (matchesAny(normalizedLabel, ['first name', 'given name'])) return 'firstName';
  if (matchesAny(normalizedLabel, ['last name', 'family name'])) return 'lastName';
  if (wordIncludes(normalizedLabel, 'email')) return 'email';
  if (matchesAny(normalizedLabel, ['phone number', 'mobile phone', 'primary phone'])) return 'phone';
  if (wordIncludes(normalizedLabel, 'linkedin')) return 'linkedin';
  if (wordIncludes(normalizedLabel, 'github')) return 'github';
  if (matchesAny(normalizedLabel, ['portfolio', 'personal website'])) return 'portfolio';
  if (matchesAny(normalizedLabel, ['state', 'province', 'country'])) return 'location';
  if (matchesAny(normalizedLabel, ['technical skills', 'type to add skills'])) return 'skills';
  if (wordIncludes(normalizedLabel, 'certification')) return 'certifications';

  return null;
}

function getApplicationQuestionMapping(normalizedLabel, resumeData) {
  if (normalizedLabel.includes('preferred name') || normalizedLabel.includes('preferred first name')) {
    return { value: 'No', confidence: 0.95, source: 'heuristic' };
  }

  if (normalizedLabel.includes('how did you hear') || normalizedLabel.includes('source')) {
    return { value: 'LinkedIn', confidence: 0.95, source: 'heuristic' };
  }

  if (normalizedLabel.includes('previously worked') || normalizedLabel.includes('former employee')) {
    return { value: 'No', confidence: 0.9, source: 'heuristic' };
  }

  if (
    normalizedLabel.includes('currently working for netflix') ||
    normalizedLabel.includes('working for netflix as a contractor') ||
    normalizedLabel.includes('independent vendor or temporary worker')
  ) {
    return { value: 'No', confidence: 0.95, source: 'heuristic' };
  }

  if (
    normalizedLabel.includes('worked for netflix') ||
    normalizedLabel.includes('netflix subsidiaries') ||
    normalizedLabel.includes('netflix in the past')
  ) {
    return { value: 'No', confidence: 0.95, source: 'heuristic' };
  }

  if (matchesAny(normalizedLabel, [
    'do you require sponsorship',
    'require sponsorship to legally work',
    'sponsorship to legally work',
    'do you require visa',
    'require visa',
    'need visa',
    'work visa',
    'immigration sponsorship',
    'immigration support',
    'employer support to obtain',
    'employer support to maintain'
  ])) {
    return { value: 'No', confidence: 0.9, source: 'heuristic' };
  }

  if (matchesAny(normalizedLabel, ['legally authorized to work', 'authorized to work in the country'])) {
    return { value: 'Yes', confidence: 0.9, source: 'heuristic' };
  }

  if (normalizedLabel.includes('current employer') && resumeData?.experience?.[0]?.company) {
    return {
      value: resumeData.experience[0].company,
      confidence: 1.0,
      source: 'heuristic'
    };
  }
  return null;
}

// ==================== Existing Helper Functions (Unchanged) ====================

function getExperienceMapping(normalizedLabel, resumeData) {
  const experience = Array.isArray(resumeData?.experience) ? resumeData.experience[0] : null;
  if (!experience) return null;

  let value = '';
  if (matchesAny(normalizedLabel, ['job title', 'position title', 'role title'])) {
    value = experience.title;
  } else if (isSimpleCompanyField(normalizedLabel)) {
    value = experience.company;
  } else if (matchesAny(normalizedLabel, ['currently work here', 'current role', 'i currently work here'])) {
    value = isCurrentExperience(experience) ? 'Yes' : 'No';
  } else if (isStartDateField(normalizedLabel)) {
    value = experience.startDate;
  } else if (isEndDateField(normalizedLabel)) {
    value = experience.endDate;
  } else if (matchesAny(normalizedLabel, ['role description', 'description', 'responsibilities', 'work summary'])) {
    value = experience.description;
  }

  if (!value) return null;
  return { value, confidence: 1.0, source: 'heuristic' };
}

function getEducationMapping(normalizedLabel, resumeData) {
  const education = Array.isArray(resumeData?.education) ? resumeData.education[0] : null;
  if (!education) return null;

  let value = '';
  if (matchesAny(normalizedLabel, ['school', 'university', 'college', 'institution'])) {
    value = education.school;
  } else if (matchesAny(normalizedLabel, ['degree'])) {
    value = education.degree;
  } else if (matchesAny(normalizedLabel, ['field of study', 'major', 'discipline'])) {
    value = education.major;
  } else if (isStartDateField(normalizedLabel)) {
    value = education.startDate;
  } else if (isEndDateField(normalizedLabel)) {
    value = education.endDate;
  }

  if (!value) return null;
  return { value, confidence: 1.0, source: 'heuristic' };
}

function isCurrentExperience(experience) {
  const endDate = String(experience?.endDate || '').toLowerCase();
  return !endDate || endDate.includes('present') || endDate.includes('current');
}

function matchesAny(normalizedLabel, keywords) {
  return keywords.some(keyword => normalizedLabel.includes(keyword));
}

function wordIncludes(normalizedLabel, word) {
  return new RegExp(`\\b${word}\\b`).test(normalizedLabel);
}

function getCityFromLocation(location) {
  const first = location.split(',')[0]?.trim();
  if (first) return first;
  if (location.toLowerCase().includes('bengaluru') || location.toLowerCase().includes('bangalore')) return 'Bengaluru';
  return location;
}

function getStateFromLocation(location) {
  const parts = location.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 3) return parts[1];

  const normalized = location.toLowerCase();
  if (normalized.includes('bengaluru') || normalized.includes('bangalore')) return 'Karnataka';

  return '';
}

function getCountryFromLocation(location) {
  const parts = location.split(',').map(part => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  if (location.toLowerCase().includes('india')) return 'India';
  return '';
}

function isSimpleCompanyField(normalizedLabel) {
  return ['company', 'company name', 'employer', 'employer name', 'organization', 'organization name', 'current employer', 'current company']
    .includes(normalizedLabel);
}

function isStartDateField(normalizedLabel) {
  return normalizedLabel === 'from' ||
    normalizedLabel === 'start' ||
    normalizedLabel.includes('start date') ||
    normalizedLabel.includes('start month') ||
    normalizedLabel.includes('start year');
}

function isEndDateField(normalizedLabel) {
  return normalizedLabel === 'to' ||
    normalizedLabel === 'end' ||
    normalizedLabel.includes('end date') ||
    normalizedLabel.includes('end month') ||
    normalizedLabel.includes('end year');
}

function isAgreementField(normalizedLabel) {
  const hasAgreementLanguage = (
    normalizedLabel.includes('terms') ||
    normalizedLabel.includes('condition') ||
    normalizedLabel.includes('privacy') ||
    normalizedLabel.includes('policy') ||
    normalizedLabel.includes('consent') ||
    normalizedLabel.includes('acknowledge') ||
    normalizedLabel.includes('agree') ||
    normalizedLabel.includes('certify')
  );
  const isDangerousConsent = (
    normalizedLabel.includes('marketing') ||
    normalizedLabel.includes('sms') ||
    normalizedLabel.includes('text message') ||
    normalizedLabel.includes('newsletter')
  );
  return hasAgreementLanguage && !isDangerousConsent;
}
