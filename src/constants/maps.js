// Mapbox public token (pk.*), kept out of git because the repo is public.
// Copy mapboxToken.example.js to mapboxToken.js and paste the token there.
export { MAPBOX_ACCESS_TOKEN } from './mapboxToken';

const LABEL_FONT = ['DIN Pro Medium', 'Arial Unicode MS Regular'];
const LABEL_NAME = ['coalesce', ['get', 'name_en'], ['get', 'name']];

// Pastel globe style matching the app's colors, built on Mapbox Streets tiles
// so no Mapbox Studio style is needed.
export const LETTERS_MAP_STYLE = {
    version: 8,
    name: 'Letters pastel',
    glyphs: 'mapbox://fonts/mapbox/{fontstack}/{range}.pbf',
    projection: { name: 'globe' },
    fog: {
        color: '#FFFDF8',
        'high-color': '#D6E8F5',
        'horizon-blend': 0.06,
        'space-color': '#2E1E3C',
        'star-intensity': 0.15,
    },
    sources: {
        streets: { type: 'vector', url: 'mapbox://mapbox.mapbox-streets-v8' },
    },
    layers: [
        { id: 'land', type: 'background', paint: { 'background-color': '#F6EEDF' } },
        {
            id: 'parks',
            type: 'fill',
            source: 'streets',
            'source-layer': 'landuse',
            filter: ['==', ['get', 'class'], 'park'],
            paint: { 'fill-color': '#E8F0DA' },
        },
        {
            id: 'water',
            type: 'fill',
            source: 'streets',
            'source-layer': 'water',
            paint: { 'fill-color': '#D6E8F5' },
        },
        {
            id: 'roads',
            type: 'line',
            source: 'streets',
            'source-layer': 'road',
            minzoom: 6,
            filter: ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'street'], true, false],
            paint: {
                'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], '#FBE3E8', '#FFFFFF'],
                'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 14, 6],
            },
        },
        {
            id: 'borders',
            type: 'line',
            source: 'streets',
            'source-layer': 'admin',
            filter: ['all', ['==', ['get', 'maritime'], 'false'], ['<=', ['get', 'admin_level'], 1]],
            paint: { 'line-color': '#E5DAEE', 'line-width': 1.2 },
        },
        {
            id: 'place-labels',
            type: 'symbol',
            source: 'streets',
            'source-layer': 'place_label',
            filter: ['match', ['get', 'class'], ['country', 'state', 'settlement'], true, false],
            layout: {
                'text-field': LABEL_NAME,
                'text-font': LABEL_FONT,
                'text-size': ['match', ['get', 'class'], 'country', 13, 12],
            },
            paint: {
                'text-color': '#7C6E8F',
                'text-halo-color': '#FFFDF8',
                'text-halo-width': 1.2,
            },
        },
    ],
};
