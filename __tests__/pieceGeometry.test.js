import {
    buildPieceGeometry,
    checkSlotOverlap,
    getPieceEdgeProtrusions,
} from '../src/features/jigsaw/pieceGeometry';

describe('jigsaw piece geometry', () => {
    it('builds deterministic geometry for every piece', () => {
        const first = buildPieceGeometry(5, 64, 22);
        const second = buildPieceGeometry(5, 64, 22);

        expect(first).toHaveLength(25);
        expect(first).toEqual(second);
        expect(first[0].path).toMatch(/^M 22 22 /);
        expect(first[24].row).toBe(4);
        expect(first[24].col).toBe(4);
    });

    it('creates complementary edges for correctly adjacent pieces', () => {
        const gridDim = 5;

        for (let row = 0; row < gridDim; row += 1) {
            for (let col = 0; col < gridDim; col += 1) {
                const current = getPieceEdgeProtrusions(row, col, gridDim);
                if (col < gridDim - 1) {
                    const right = getPieceEdgeProtrusions(row, col + 1, gridDim);
                    expect(current.right + right.left).toBe(0);
                }
                if (row < gridDim - 1) {
                    const bottom = getPieceEdgeProtrusions(row + 1, col, gridDim);
                    expect(current.bottom + bottom.top).toBe(0);
                }
            }
        }
    });

    it('keeps every tab inside the expanded canvas while allowing protrusions beyond the square slot', () => {
        const gridDim = 5;
        const pieceSize = 64;
        const tabSize = 22;
        const canvasSize = pieceSize + 2 * tabSize;
        const geometry = buildPieceGeometry(gridDim, pieceSize, tabSize);
        let foundProtrusion = false;

        geometry.forEach(({ path }) => {
            const coordinates = path
                .match(/-?\d+(?:\.\d+)?/g)
                .map(Number);

            coordinates.forEach((coordinate) => {
                expect(coordinate).toBeGreaterThanOrEqual(0);
                expect(coordinate).toBeLessThanOrEqual(canvasSize);
            });

            foundProtrusion = foundProtrusion || coordinates.some(coordinate => (
                coordinate < tabSize || coordinate > tabSize + pieceSize
            ));
        });

        expect(foundProtrusion).toBe(true);
    });

    it('detects a tab-on-tab collision without rejecting a matching edge', () => {
        const matching = Array.from({ length: 25 }, (_, index) => -index - 1);
        matching[0] = 0;
        matching[1] = 1;
        expect(checkSlotOverlap(matching, 0, 5)).toBe(false);

        const colliding = [...matching];
        colliding[1] = 2;
        expect(checkSlotOverlap(colliding, 0, 5)).toBe(true);
    });
});
