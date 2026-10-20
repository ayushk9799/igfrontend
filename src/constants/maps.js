// Mapbox public token (pk.*), kept out of git because the repo is public.
// Copy mapboxToken.example.js to mapboxToken.js and paste the token there.
export { MAPBOX_ACCESS_TOKEN } from './mapboxToken';

// Keep the globe atmosphere while using Mapbox's built-in basemap styles.
export const LETTERS_MAP_ATMOSPHERE = {
    color: '#FFFDF8',
    highColor: '#D6E8F5',
    horizonBlend: 0.06,
    spaceColor: '#2E1E3C',
    starIntensity: 0.15,
};

export const LETTERS_DARK_MAP_ATMOSPHERE = {
    color: '#7B86A4',
    highColor: '#24405E',
    horizonBlend: 0.08,
    spaceColor: '#031729',
    starIntensity: 0.4,
};
