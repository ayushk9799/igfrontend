const clampLeft = (left, width, trackWidth, edgePadding) => (
    Math.max(-edgePadding, Math.min(left, Math.max(-edgePadding, trackWidth + edgePadding - width)))
);

// Keep one or two rating labels apart while preserving their exact scale anchors.
export const layoutRatingMarkers = (markers, trackWidth, gap = 8, edgePadding = 0) => {
    const placements = markers.map(marker => {
        const anchor = marker.percent / 100 * trackWidth;
        return { ...marker, anchor, left: clampLeft(anchor - marker.width / 2, marker.width, trackWidth, edgePadding) };
    });
    if (placements.length < 2) return placements;

    const [left, right] = [...placements].sort((a, b) => a.anchor - b.anchor);
    if (left.left + left.width + gap > right.left) {
        const combinedWidth = left.width + gap + right.width;
        const midpoint = (left.anchor + right.anchor) / 2;
        left.left = clampLeft(midpoint - combinedWidth / 2, combinedWidth, trackWidth, edgePadding);
        right.left = left.left + left.width + gap;
    }
    return placements;
};
