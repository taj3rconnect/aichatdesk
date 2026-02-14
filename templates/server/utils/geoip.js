/**
 * GeoIP Lookup Utility
 *
 * Provides IP address to location lookup using free ip-api.com service.
 * Includes in-memory caching (1-hour TTL) and private IP detection.
 *
 * Rate limit: 45 requests/minute (free tier, no API key needed)
 */

const https = require('https');

// In-memory cache: Map<ip, {data, expiry}>
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check if IP address is private/local
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if private IP
 */
function isPrivateIP(ip) {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return true;

  // Remove IPv6 prefix if present
  const cleanIp = ip.replace(/^::ffff:/, '');

  // Check private ranges
  if (cleanIp.startsWith('192.168.')) return true;
  if (cleanIp.startsWith('10.')) return true;
  if (cleanIp.startsWith('172.')) {
    const second = parseInt(cleanIp.split('.')[1], 10);
    if (second >= 16 && second <= 31) return true;
  }

  return false;
}

/**
 * Fetch location data from ip-api.com
 * @param {string} ip - IP address to lookup
 * @returns {Promise<Object|null>} - Location object or null on failure
 */
function fetchLocationFromAPI(ip) {
  return new Promise((resolve) => {
    const url = `http://ip-api.com/json/${ip}`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);

            // Check if API returned success status
            if (parsed.status === 'success') {
              resolve({
                country: parsed.country || 'Unknown',
                region: parsed.regionName || '',
                city: parsed.city || '',
                timezone: parsed.timezone || 'UTC',
                lat: parsed.lat || 0,
                lon: parsed.lon || 0
              });
            } else {
              // API returned error status
              resolve(null);
            }
          } else {
            // Non-200 status code
            resolve(null);
          }
        } catch (err) {
          // JSON parse error
          console.error('GeoIP parse error:', err);
          resolve(null);
        }
      });
    }).on('error', (err) => {
      // Network error
      console.error('GeoIP fetch error:', err);
      resolve(null);
    });
  });
}

/**
 * Get location from IP address with caching
 * @param {string} ipAddress - IP address to lookup
 * @returns {Promise<Object|null>} - Location object or null
 */
async function getLocationFromIP(ipAddress) {
  // Handle missing or invalid IP
  if (!ipAddress || typeof ipAddress !== 'string') {
    return {
      country: 'Unknown',
      region: '',
      city: 'Unknown',
      timezone: 'UTC',
      lat: 0,
      lon: 0
    };
  }

  // Check if private IP
  if (isPrivateIP(ipAddress)) {
    return {
      country: 'Unknown',
      region: '',
      city: 'Local',
      timezone: 'UTC',
      lat: 0,
      lon: 0
    };
  }

  // Check cache
  const cached = cache.get(ipAddress);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  // Fetch from API
  const location = await fetchLocationFromAPI(ipAddress);

  // Cache result (even if null, to avoid repeated failed lookups)
  if (location) {
    cache.set(ipAddress, {
      data: location,
      expiry: Date.now() + CACHE_TTL
    });
  }

  return location;
}

module.exports = { getLocationFromIP };
