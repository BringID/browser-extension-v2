/**
 * Normalizes a permission URL to ensure it has the correct format for Chrome's permissions API.
 * - If URL ends with a TLD (e.g., .com, .xyz) without a path, appends "/*"
 * - If URL already has a path or wildcard, leaves it unchanged
 */
const normalizePermissionUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    // If the pathname is just "/" or empty, append "*"
    if (urlObj.pathname === '/' || urlObj.pathname === '') {
      return url.endsWith('/') ? `${url}*` : `${url}/*`;
    }
    // If already has a wildcard or specific path, return as-is
    return url;
  } catch (e) {
    // If URL parsing fails, return as-is
    console.warn('Failed to parse permission URL:', url, e);
    return url;
  }
};

const checkIfPermissionGranted = async (
  origins: string[],
): Promise<boolean> => {
  // Normalize all URLs before checking permissions
  const normalizedOrigins = origins.map(normalizePermissionUrl);
  
  return new Promise((resolve) => {
    chrome.permissions.contains({ origins: normalizedOrigins }, (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          'Permission check error:',
          chrome.runtime.lastError.message,
        );
        return resolve(false);
      }

      resolve(result);
    });
  });
};

export default checkIfPermissionGranted;
