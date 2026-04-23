// Simple fix for case sensitivity issue
// Add this to your API endpoint to normalize company names

export function normalizeCompanyName(name) {
  if (!name) return '';
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// In your activities API, add this before returning data:
// data = data.map(item => ({
//   ...item,
//   company_name: normalizeCompanyName(item.company_name)
// }));
