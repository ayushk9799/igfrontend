/* eslint-env jest */
jest.mock('react-native-svg', () => ({}));

const { buildDeckledPath } = require('../LetterPaper');

const pointsOf = (path) => path.slice(1, -1).split('L').map((pair) => pair.split(',').map(Number));

describe('buildDeckledPath', () => {
    it('keeps the same edge for the same size', () => {
        expect(buildDeckledPath(320, 300)).toBe(buildDeckledPath(320, 300));
    });

    it('stays inside the paper bounds', () => {
        const points = pointsOf(buildDeckledPath(320, 300));
        expect(points.length).toBeGreaterThan(100);
        points.forEach(([x, y]) => {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(320);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(300);
        });
    });
});
