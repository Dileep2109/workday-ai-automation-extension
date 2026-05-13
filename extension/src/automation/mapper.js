/**
 * Normalizes a field label by converting to lowercase and removing special characters.
 */
function normalizeLabel(label) {
  if (!label) return '';
  // Remove asterisks, dashes, colons, and extra whitespace
  return label.toLowerCase().replace(/[*:\-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Heuristic mapping dictionary for common Workday fields.
 * Maps normalized labels to the expected keys in the resume JSON data.
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
  'website': 'github', // fallback for generic portfolio
  
  'location': 'location',
  'address': 'location',
  'city': 'location',
};

/**
 * Attempts to map a field label to resume data using heuristics.
 * Returns the mapped result or null if no heuristic match is found.
 */
export function getHeuristicMapping(fieldLabel, resumeData) {
  const normalizedLabel = normalizeLabel(fieldLabel);
  
  // Try exact match in the dictionary first
  let targetKey = HEURISTIC_MAP[normalizedLabel];
  
  // If no exact match, try partial matching for common keywords
  if (!targetKey) {
    for (const [key, mappedKey] of Object.entries(HEURISTIC_MAP)) {
      if (normalizedLabel.includes(key)) {
        targetKey = mappedKey;
        break;
      }
    }
  }

  // If a mapping exists and we have data for it
  if (targetKey && resumeData[targetKey]) {
    return {
      value: resumeData[targetKey],
      confidence: 1.0, // High confidence for standard heuristic matches
      source: 'heuristic'
    };
  }

  return null;
}
