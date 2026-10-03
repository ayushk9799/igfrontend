/* eslint-env jest */

import { layoutRatingMarkers } from '../sliderSummaryLayout';

test.each([184, 232, 320])('rating markers stay apart and retain exact anchors on a %ipx track', width => {
    for (let userRating = 1; userRating <= 10; userRating++) {
        for (let partnerRating = 1; partnerRating <= 10; partnerRating++) {
            const userPercent = (userRating - 1) / 9 * 100;
            const partnerPercent = (partnerRating - 1) / 9 * 100;
            const markers = userRating === partnerRating
                ? [{ key: 'shared', percent: userPercent, width: 72 }]
                : [
                    { key: 'user', percent: userPercent, width: 36 },
                    { key: 'partner', percent: partnerPercent, width: 36 },
                ];
            const placements = layoutRatingMarkers(markers, width, 8, 36);

            placements.forEach((marker, index) => {
                expect(marker.left).toBeGreaterThanOrEqual(-36);
                expect(marker.left + marker.width).toBeLessThanOrEqual(width + 36 + 0.0001);
                expect(marker.anchor).toBeCloseTo(markers[index].percent / 100 * width);
                if (marker.key === 'shared') {
                    expect(marker.left + marker.width / 2).toBeCloseTo(marker.anchor);
                }
            });

            if (placements.length === 2) {
                const [left, right] = [...placements].sort((a, b) => a.anchor - b.anchor);
                expect(left.left + left.width + 8).toBeLessThanOrEqual(right.left + 0.0001);
            }
        }
    }
});
