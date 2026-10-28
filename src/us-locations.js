import { useEffect, useState } from 'react';

export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'], ['CO', 'Colorado'],
  ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'],
  ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'], ['SD', 'South Dakota'],
  ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'],
  ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
].map(([code, name]) => ({ code, name }));

// Combobox options: the two-letter code is the value, the full name is searchable.
export const STATE_OPTIONS = US_STATES.map(({ code, name }) => ({ value: code, label: code, hint: name, keywords: name }));

export const stateCodeFor = value => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  return US_STATES.find(state => state.code.toLowerCase() === text || state.name.toLowerCase() === text)?.code || '';
};

export const stateNameFor = value => US_STATES.find(state => state.code === stateCodeFor(value))?.name || '';

// City lists are static per-state files built by scripts/build-us-cities.mjs.
const cityRequests = new Map();
export const loadCities = code => {
  if (!code) return Promise.resolve([]);
  if (!cityRequests.has(code)) {
    const request = fetch(`/us-cities/${code}.json`)
      .then(response => { if (!response.ok) throw new Error(`City list unavailable for ${code}`); return response.json(); })
      .catch(error => { cityRequests.delete(code); throw error; });
    cityRequests.set(code, request);
  }
  return cityRequests.get(code);
};

// Returns { cities, status } for a state code or name. status: idle | loading | ready | error.
export function useCities(state) {
  const code = stateCodeFor(state);
  const [result, setResult] = useState({ code: '', cities: [], status: 'idle' });
  useEffect(() => {
    if (!code) return undefined;
    let active = true;
    loadCities(code)
      .then(cities => { if (active) setResult({ code, cities, status: 'ready' }); })
      .catch(() => { if (active) setResult({ code, cities: [], status: 'error' }); });
    return () => { active = false; };
  }, [code]);
  if (!code) return { cities: [], status: 'idle' };
  return result.code === code ? result : { cities: [], status: 'loading' };
}

// Matches a typed city to the official spelling, or '' when it is not in the list.
export const matchCity = (cities, value) => {
  const text = String(value || '').trim().toLowerCase();
  return cities.find(city => city.toLowerCase() === text) || '';
};
