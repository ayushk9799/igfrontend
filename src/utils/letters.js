import { getUiLocale, translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import { storage } from './authStorage';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export const LETTER_BODY_MAX_LENGTH = 1000;

// Mirrors the server's bird list. The server decides the real delivery time.
export const LETTER_BIRDS = [
    { id: 'penguin', name: 'Penguin Post', travelMs: 48 * HOUR_MS, premium: false, ink: '#3A3348', tint: '#ECE8F2', route: '#4B3D5C', routeDark: '#D7CBEF' },
    { id: 'pigeon', name: 'Pigeon', travelMs: 12 * HOUR_MS, premium: false, ink: '#5B3A9E', tint: '#EFE6FB', route: '#7A52C7', routeDark: '#C3A0FF' },
    { id: 'swallow', name: 'Swallow', travelMs: 3 * HOUR_MS, premium: true, ink: '#2F5E96', tint: '#E3F0FB', route: '#2F6FA8', routeDark: '#80C8FF' },
    { id: 'falcon', name: 'Falcon', travelMs: 45 * MINUTE_MS, premium: true, ink: '#9A4716', tint: '#FCEBDD', route: '#B5541F', routeDark: '#FFB784' },
];

export const getLetterBird = (birdId) => (
    LETTER_BIRDS.find((bird) => bird.id === birdId) || LETTER_BIRDS[1]
);

export const LETTER_MAP_ROUTE_COLORS = {
    light: { outgoing: '#A9B9D6', incoming: '#BBA9D6' },
    dark: { outgoing: '#BFDAFF', incoming: '#E0C9FF' },
};

export const getLetterRouteColor = (birdId, isDark = false) => {
    const bird = getLetterBird(birdId);
    return isDark ? bird.routeDark : bird.route;
};

export const formatTravelTime = (ms) => {
    const minutes = Math.round(ms / MINUTE_MS);
    if (minutes < 60) return translateUiTemplate('{{0}} minutes', [minutes]);
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours === 1 ? translateUiText('1 hour') : translateUiTemplate('{{0}} hours', [hours]);
    const days = Math.round(hours / 24);
    return days === 1 ? translateUiText('1 day') : translateUiTemplate('{{0}} days', [days]);
};

// Short countdown for chips and headers: "2d 4h", "1h 05m", "12m".
export const formatTimeLeft = (ms) => {
    if (ms <= 0) return translateUiText('Landing now');
    const days = Math.floor(ms / DAY_MS);
    const hours = Math.floor((ms % DAY_MS) / HOUR_MS);
    const minutes = Math.ceil((ms % HOUR_MS) / MINUTE_MS);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${String(Math.min(minutes, 59)).padStart(2, '0')}m`;
    return `${Math.max(minutes, 1)}m`;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const formatArrival = (value, now = new Date()) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const time = date.toLocaleTimeString(getUiLocale(), { hour: 'numeric', minute: '2-digit' });
    const dayDiff = Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);
    if (dayDiff === 0) return translateUiTemplate('Today, {{0}}', [time]);
    if (dayDiff === 1) return translateUiTemplate('Tomorrow, {{0}}', [time]);
    if (dayDiff === -1) return translateUiTemplate('Yesterday, {{0}}', [time]);
    const day = date.toLocaleDateString(getUiLocale(), dayDiff > 1 && dayDiff < 7
        ? { weekday: 'long' }
        : { month: 'short', day: 'numeric' });
    return `${day}, ${time}`;
};

/**
 * Progress uses the server clock (serverNow) so a phone with a wrong clock
 * doesn't move the bird too fast or too slow.
 */
export const getClockOffsetMs = (serverNow, deviceNow = Date.now()) => {
    const server = new Date(serverNow).getTime();
    return Number.isNaN(server) ? 0 : server - deviceNow;
};

export const getLiveProgress = (letter, nowMs) => {
    if (letter?.status === 'delivered') return 1;
    if (letter?.status !== 'flying') return 0;
    const start = new Date(letter.sentAt).getTime();
    const end = new Date(letter.deliverAt).getTime();
    if (!(end > start)) return 1;
    return Math.min(1, Math.max(0, (nowMs - start) / (end - start)));
};

export const getTimeLeftMs = (letter, nowMs) => (
    Math.max(0, new Date(letter?.deliverAt).getTime() - nowMs)
);

// Point at t on a quadratic Bezier curve from p0 to p1 bending towards c.
export const pointOnCurve = (p0, c, p1, t) => {
    const u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x,
        y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y,
    };
};

// SVG path for the part of the curve already flown (0..t).
export const flownCurvePath = (p0, c, p1, t) => {
    const control = { x: p0.x + t * (c.x - p0.x), y: p0.y + t * (c.y - p0.y) };
    const end = pointOnCurve(p0, c, p1, t);
    return `M${p0.x} ${p0.y} Q${control.x} ${control.y} ${end.x} ${end.y}`;
};

export const curvePath = (p0, c, p1) => `M${p0.x} ${p0.y} Q${c.x} ${c.y} ${p1.x} ${p1.y}`;

const introKey = (userId) => `letters_intro_seen:${userId || 'anon'}`;

export const hasSeenLettersIntro = (userId) => {
    try {
        return storage.getBoolean(introKey(userId)) === true;
    } catch {
        return true;
    }
};

export const markLettersIntroSeen = (userId) => {
    try {
        storage.set(introKey(userId), true);
    } catch {
        // Showing the intro again is harmless.
    }
};

const MIN_PIN_SPREAD_DEGREES = 0.02;

/**
 * Keep two pins in the same (rounded) city apart so the route is visible.
 */
export const spreadNearbyPins = (you, partner) => {
    const dLat = partner.latitude - you.latitude;
    const dLng = partner.longitude - you.longitude;
    if (Math.abs(dLat) + Math.abs(dLng) >= MIN_PIN_SPREAD_DEGREES * 2) return { you, partner };
    const midLat = (you.latitude + partner.latitude) / 2;
    const midLng = (you.longitude + partner.longitude) / 2;
    return {
        you: { latitude: midLat + MIN_PIN_SPREAD_DEGREES, longitude: midLng - MIN_PIN_SPREAD_DEGREES },
        partner: { latitude: midLat - MIN_PIN_SPREAD_DEGREES, longitude: midLng + MIN_PIN_SPREAD_DEGREES },
    };
};

/**
 * A gently curved route between two map points as a list of coordinates.
 * Positive and negative bends give the two directions their own arcs.
 */
export const buildGeoCurve = (from, to, bend = 0.25, samples = 48) => {
    const dLat = to.latitude - from.latitude;
    const dLng = to.longitude - from.longitude;
    const control = {
        latitude: from.latitude + dLat / 2 - dLng * bend,
        longitude: from.longitude + dLng / 2 + dLat * bend,
    };
    const points = [];
    for (let i = 0; i <= samples; i += 1) {
        const t = i / samples;
        const u = 1 - t;
        points.push({
            latitude: u * u * from.latitude + 2 * u * t * control.latitude + t * t * to.latitude,
            longitude: u * u * from.longitude + 2 * u * t * control.longitude + t * t * to.longitude,
        });
    }
    return points;
};

// Position at progress t (0..1) along a sampled curve, plus the part already flown.
export const splitGeoCurve = (points, t) => {
    const clamped = Math.min(1, Math.max(0, t));
    const exact = clamped * (points.length - 1);
    const index = Math.floor(exact);
    const next = points[Math.min(index + 1, points.length - 1)];
    const fraction = exact - index;
    const position = {
        latitude: points[index].latitude + (next.latitude - points[index].latitude) * fraction,
        longitude: points[index].longitude + (next.longitude - points[index].longitude) * fraction,
    };
    return { position, flown: [...points.slice(0, index + 1), position] };
};

// Roughly 40–50 km: far enough for a visible flight, close enough to stay local.
const STAND_IN_OFFSET = { latitude: 0.35, longitude: 0.45 };

/**
 * Map pins when one partner hides their location: the hidden partner gets a
 * stand-in pin near the other, marked approximate. Null when neither shares.
 */
export const resolveMapPins = (you, partner) => {
    if (you && partner) return { you, partner, youApprox: false, partnerApprox: false };
    if (you) {
        return {
            you,
            partner: { latitude: you.latitude + STAND_IN_OFFSET.latitude, longitude: you.longitude + STAND_IN_OFFSET.longitude },
            youApprox: false,
            partnerApprox: true,
        };
    }
    if (partner) {
        return {
            you: { latitude: partner.latitude - STAND_IN_OFFSET.latitude, longitude: partner.longitude - STAND_IN_OFFSET.longitude },
            partner,
            youApprox: true,
            partnerApprox: false,
        };
    }
    return null;
};

const mapPointsKey = (userId) => `letters_map_points:${userId || 'anon'}`;

// Last known cities, so the real map can appear before the network answers.
export const getCachedMapPoints = (userId) => {
    try {
        const raw = storage.getString(mapPointsKey(userId));
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const cacheMapPoints = (userId, points) => {
    try {
        storage.set(mapPointsKey(userId), JSON.stringify(points));
    } catch {
        // Only a speed-up; the next fetch fills it in.
    }
};
