jest.mock('../authStorage', () => ({
    storage: { getBoolean: jest.fn(), set: jest.fn() },
}));
jest.mock('../../i18n/index', () => ({
    __esModule: true,
    default: { resolvedLanguage: 'en' },
}));

import {
    buildGeoCurve,
    flownCurvePath,
    formatTimeLeft,
    formatTravelTime,
    getClockOffsetMs,
    getLetterBird,
    getLiveProgress,
    pointOnCurve,
    resolveMapPins,
    splitGeoCurve,
    spreadNearbyPins,
} from '../letters';

const HOUR_MS = 60 * 60 * 1000;
const SENT = new Date('2026-10-20T12:00:00.000Z').getTime();

const flying = {
    status: 'flying',
    sentAt: new Date(SENT).toISOString(),
    deliverAt: new Date(SENT + 12 * HOUR_MS).toISOString(),
};

describe('letter helpers', () => {
    test('progress follows the clock and stops at the ends', () => {
        expect(getLiveProgress(flying, SENT - HOUR_MS)).toBe(0);
        expect(getLiveProgress(flying, SENT + 3 * HOUR_MS)).toBe(0.25);
        expect(getLiveProgress(flying, SENT + 20 * HOUR_MS)).toBe(1);
        expect(getLiveProgress({ ...flying, status: 'delivered' }, SENT)).toBe(1);
        expect(getLiveProgress({ ...flying, status: 'recalled' }, SENT + HOUR_MS)).toBe(0);
    });

    test('server clock offset corrects a wrong phone clock', () => {
        const deviceNow = SENT;
        const serverNow = new Date(SENT + 5 * 60 * 1000).toISOString();
        expect(getClockOffsetMs(serverNow, deviceNow)).toBe(5 * 60 * 1000);
        expect(getClockOffsetMs('not a date', deviceNow)).toBe(0);
    });

    test('countdowns read naturally', () => {
        expect(formatTimeLeft(0)).toBe('Landing now');
        expect(formatTimeLeft(12 * 60 * 1000)).toBe('12m');
        expect(formatTimeLeft(HOUR_MS + 5 * 60 * 1000)).toBe('1h 05m');
        expect(formatTimeLeft(52 * HOUR_MS)).toBe('2d 4h');
    });

    test('travel times match the birds', () => {
        expect(formatTravelTime(getLetterBird('falcon').travelMs)).toBe('45 minutes');
        expect(formatTravelTime(getLetterBird('swallow').travelMs)).toBe('3 hours');
        expect(formatTravelTime(getLetterBird('penguin').travelMs)).toBe('2 days');
        expect(getLetterBird('unknown').id).toBe('pigeon');
    });

    test('the flown trail ends where the bird is drawn', () => {
        const from = { x: 0, y: 100 };
        const control = { x: 50, y: 0 };
        const to = { x: 100, y: 100 };
        const point = pointOnCurve(from, control, to, 0.5);
        expect(point).toEqual({ x: 50, y: 50 });
        expect(flownCurvePath(from, control, to, 0.5)).toBe('M0 100 Q25 50 50 50');
    });

    test('map routes start and end at the two cities', () => {
        const delhi = { latitude: 28.6, longitude: 77.2 };
        const bengaluru = { latitude: 13, longitude: 77.6 };
        const curve = buildGeoCurve(delhi, bengaluru, 0.22, 10);
        expect(curve).toHaveLength(11);
        expect(curve[0]).toEqual(delhi);
        expect(curve[10].latitude).toBeCloseTo(13);
        expect(curve[10].longitude).toBeCloseTo(77.6);

        const { position, flown } = splitGeoCurve(curve, 0.5);
        expect(position).toEqual(curve[5]);
        expect(flown).toHaveLength(7);
        expect(splitGeoCurve(curve, 1).position).toEqual(curve[10]);
    });

    test('pins in the same city are pulled apart so the route shows', () => {
        const same = { latitude: 28.6, longitude: 77.2 };
        const { you, partner } = spreadNearbyPins(same, same);
        expect(you).not.toEqual(partner);
        const far = spreadNearbyPins(same, { latitude: 13, longitude: 77.6 });
        expect(far.you).toEqual(same);
    });

    test('a hidden partner gets a stand-in pin next to the one who shares', () => {
        const delhi = { latitude: 28.6, longitude: 77.2 };
        const onlyYou = resolveMapPins(delhi, null);
        expect(onlyYou.you).toEqual(delhi);
        expect(onlyYou.partnerApprox).toBe(true);
        expect(onlyYou.partner).not.toEqual(delhi);

        const onlyPartner = resolveMapPins(null, delhi);
        expect(onlyPartner.partner).toEqual(delhi);
        expect(onlyPartner.youApprox).toBe(true);

        expect(resolveMapPins(null, null)).toBeNull();
        expect(resolveMapPins(delhi, delhi).partnerApprox).toBe(false);
    });
});
