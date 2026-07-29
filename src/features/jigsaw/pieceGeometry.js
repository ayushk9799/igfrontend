const getEdgePath = (x1, y1, x2, y2, nx, ny) => {
    if (nx === 0 && ny === 0) {
        return `L ${x2} ${y2}`;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const edgeLength = Math.sqrt(dx * dx + dy * dy);
    const point = (position, perpendicular) => {
        const px = x1 + position * dx + perpendicular * edgeLength * nx;
        const py = y1 + position * dy + perpendicular * edgeLength * ny;
        return `${px.toFixed(1)},${py.toFixed(1)}`;
    };

    const pA = point(0.38, 0);
    const pBControl1 = point(0.38, 0.05);
    const pBControl2 = point(0.32, 0.10);
    const pB = point(0.32, 0.20);
    const headControl1 = point(0.32, 0.30);
    const headControl2 = point(0.40, 0.32);
    const headMiddle = point(0.50, 0.32);
    const headControl3 = point(0.60, 0.32);
    const headControl4 = point(0.68, 0.30);
    const head = point(0.68, 0.20);
    const pCControl1 = point(0.68, 0.10);
    const pCControl2 = point(0.62, 0.05);
    const pC = point(0.62, 0);

    return `L ${pA} C ${pBControl1} ${pBControl2} ${pB} ` +
        `C ${headControl1} ${headControl2} ${headMiddle} ` +
        `C ${headControl3} ${headControl4} ${head} ` +
        `C ${pCControl1} ${pCControl2} ${pC} L ${x2},${y2}`;
};

export const getPiecePath = (row, col, gridDim, pieceSize, tabSize) => {
    const topLeft = { x: tabSize, y: tabSize };
    const topRight = { x: tabSize + pieceSize, y: tabSize };
    const bottomRight = { x: tabSize + pieceSize, y: tabSize + pieceSize };
    const bottomLeft = { x: tabSize, y: tabSize + pieceSize };

    const topDirection = row === 0 ? 0 : ((row - 1 + col) % 2 === 0 ? 1 : -1);
    const rightDirection = col === gridDim - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);
    const bottomDirection = row === gridDim - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);
    const leftDirection = col === 0 ? 0 : ((row + col - 1) % 2 === 0 ? 1 : -1);

    return `M ${topLeft.x} ${topLeft.y} ` +
        `${getEdgePath(topLeft.x, topLeft.y, topRight.x, topRight.y, 0, topDirection)} ` +
        `${getEdgePath(topRight.x, topRight.y, bottomRight.x, bottomRight.y, rightDirection, 0)} ` +
        `${getEdgePath(bottomRight.x, bottomRight.y, bottomLeft.x, bottomLeft.y, 0, bottomDirection)} ` +
        `${getEdgePath(bottomLeft.x, bottomLeft.y, topLeft.x, topLeft.y, leftDirection, 0)} Z`;
};

export const getPieceEdgePaths = (row, col, gridDim, pieceSize, tabSize) => {
    const topLeft = { x: tabSize, y: tabSize };
    const topRight = { x: tabSize + pieceSize, y: tabSize };
    const bottomRight = { x: tabSize + pieceSize, y: tabSize + pieceSize };
    const bottomLeft = { x: tabSize, y: tabSize + pieceSize };

    const topDirection = row === 0 ? 0 : ((row - 1 + col) % 2 === 0 ? 1 : -1);
    const rightDirection = col === gridDim - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);
    const bottomDirection = row === gridDim - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);
    const leftDirection = col === 0 ? 0 : ((row + col - 1) % 2 === 0 ? 1 : -1);

    return {
        top: `M ${topLeft.x} ${topLeft.y} ${getEdgePath(topLeft.x, topLeft.y, topRight.x, topRight.y, 0, topDirection)}`,
        right: `M ${topRight.x} ${topRight.y} ${getEdgePath(topRight.x, topRight.y, bottomRight.x, bottomRight.y, rightDirection, 0)}`,
        bottom: `M ${bottomRight.x} ${bottomRight.y} ${getEdgePath(bottomRight.x, bottomRight.y, bottomLeft.x, bottomLeft.y, 0, bottomDirection)}`,
        left: `M ${bottomLeft.x} ${bottomLeft.y} ${getEdgePath(bottomLeft.x, bottomLeft.y, topLeft.x, topLeft.y, leftDirection, 0)}`,
    };
};

export const buildPieceGeometry = (gridDim, pieceSize, tabSize) => {
    const total = gridDim * gridDim;
    return Array.from({ length: total }, (_, index) => {
        const row = Math.floor(index / gridDim);
        const col = index % gridDim;
        return {
            row,
            col,
            path: getPiecePath(row, col, gridDim, pieceSize, tabSize),
            edgePaths: getPieceEdgePaths(row, col, gridDim, pieceSize, tabSize),
        };
    });
};

export const getPieceEdgeProtrusions = (row, col, gridDim) => {
    const topDirection = row === 0 ? 0 : ((row - 1 + col) % 2 === 0 ? 1 : -1);
    const bottomDirection = row === gridDim - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);
    const leftDirection = col === 0 ? 0 : ((row + col - 1) % 2 === 0 ? 1 : -1);
    const rightDirection = col === gridDim - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);

    return {
        top: topDirection === 0 ? 0 : (topDirection === -1 ? 1 : -1),
        bottom: bottomDirection === 0 ? 0 : (bottomDirection === 1 ? 1 : -1),
        left: leftDirection === 0 ? 0 : (leftDirection === -1 ? 1 : -1),
        right: rightDirection === 0 ? 0 : (rightDirection === 1 ? 1 : -1),
    };
};

export const checkSlotOverlap = (pieces, slotIndex, gridDim) => {
    const value = pieces[slotIndex];
    if (value === null || value === undefined || value < 0) return false;

    const row = Math.floor(slotIndex / gridDim);
    const col = slotIndex % gridDim;
    const pieceEdges = getPieceEdgeProtrusions(
        Math.floor(value / gridDim),
        value % gridDim,
        gridDim
    );

    const collidesWith = (neighborIndex, ownEdge, neighborEdge) => {
        const neighborValue = pieces[neighborIndex];
        if (neighborValue === null || neighborValue === undefined || neighborValue < 0) {
            return false;
        }
        const neighborEdges = getPieceEdgeProtrusions(
            Math.floor(neighborValue / gridDim),
            neighborValue % gridDim,
            gridDim
        );
        return pieceEdges[ownEdge] + neighborEdges[neighborEdge] > 0;
    };

    if (col < gridDim - 1 && collidesWith(slotIndex + 1, 'right', 'left')) return true;
    if (col > 0 && collidesWith(slotIndex - 1, 'left', 'right')) return true;
    if (row < gridDim - 1 && collidesWith(slotIndex + gridDim, 'bottom', 'top')) return true;
    if (row > 0 && collidesWith(slotIndex - gridDim, 'top', 'bottom')) return true;

    return false;
};
