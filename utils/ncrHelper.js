/**
 * NCR (National Capital Region) Validation Helper
 */
const isNcrRegion = ({ state = '', district = '', pincode = '' }) => {
  const cleanState = (state || '').toLowerCase().trim();
  const cleanDistrict = (district || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanPincode = (pincode || '').toString().trim();

  // 1. Any Delhi address or 110xxx pincode
  if (cleanState.includes('delhi') || cleanPincode.startsWith('110')) {
    return true;
  }

  // 2. Haryana NCR Districts
  const haryanaNcr = [
    'gurgaon',
    'gurugram',
    'faridabad',
    'sonipat',
    'sonepat',
    'jhajjar',
    'bahadurgarh',
    'rohtak',
    'panipat',
    'palwal',
    'rewari',
    'nuh',
    'mewat',
    'bhiwani',
    'charkhidadri',
    'mahendragarh',
    'narnaul',
    'jind',
    'karnal',
  ];
  if (cleanState.includes('haryana') || !cleanState) {
    for (const d of haryanaNcr) {
      if (cleanDistrict.includes(d)) return true;
    }
  }

  // 3. Uttar Pradesh NCR Districts
  const upNcr = [
    'gautambuddhanagar',
    'gautambudhnagar',
    'noida',
    'greaternoida',
    'ghaziabad',
    'meerut',
    'hapur',
    'panchsheelnagar',
    'bulandshahr',
    'bulandshahar',
    'baghpat',
    'bagpat',
    'muzaffarnagar',
    'shamli',
  ];
  if (cleanState.includes('uttar') || cleanState.includes('up') || !cleanState) {
    for (const d of upNcr) {
      if (cleanDistrict.includes(d)) return true;
    }
  }

  // 4. Rajasthan NCR Districts
  const rajNcr = ['alwar', 'bharatpur'];
  if (cleanState.includes('rajasthan') || !cleanState) {
    for (const d of rajNcr) {
      if (cleanDistrict.includes(d)) return true;
    }
  }

  // General check across all NCR districts
  const allDistricts = [...haryanaNcr, ...upNcr, ...rajNcr];
  for (const d of allDistricts) {
    if (cleanDistrict.includes(d)) return true;
  }

  return false;
};

module.exports = {
  isNcrRegion,
};
