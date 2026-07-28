import { formatRelativeTime } from '../uiTranslation';

jest.mock('../index', () => ({
    __esModule: true,
    default: { resolvedLanguage: 'en' },
}));

describe('formatRelativeTime', () => {
    const originalRelativeTimeFormat = Intl.RelativeTimeFormat;

    afterEach(() => {
        Object.defineProperty(Intl, 'RelativeTimeFormat', {
            configurable: true,
            writable: true,
            value: originalRelativeTimeFormat,
        });
    });

    it('uses a readable fallback when the runtime has no RelativeTimeFormat', () => {
        Object.defineProperty(Intl, 'RelativeTimeFormat', {
            configurable: true,
            writable: true,
            value: undefined,
        });

        expect(formatRelativeTime(-3, 'minute')).toBe('3 min ago');
        expect(formatRelativeTime(0, 'minute')).toBe('now');
        expect(formatRelativeTime(2, 'day', { style: 'long' })).toBe('in 2 days');
    });
});
