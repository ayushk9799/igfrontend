const normalizePuzzleId = (puzzleId) => (
    puzzleId === null || puzzleId === undefined ? null : String(puzzleId)
);

const normalizeMoveCount = (moveCount) => {
    const parsed = Number(moveCount);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const createSpectatorMoveAudioState = (puzzleId, moveCount) => {
    const normalizedMoveCount = normalizeMoveCount(moveCount);

    return {
        puzzleId: normalizePuzzleId(puzzleId),
        lastMoveCount: normalizedMoveCount,
        hasBaseline: normalizedMoveCount !== null,
    };
};

/**
 * Records the latest board state shown to a spectator.
 *
 * A jump of several moves still produces one sound because the UI only shows
 * the newest board state. Duplicate socket/poll updates and stale responses are
 * silent, while the first snapshot establishes a silent baseline.
 */
export const registerSpectatorMoveUpdate = (state, puzzleId, moveCount) => {
    const normalizedPuzzleId = normalizePuzzleId(puzzleId);
    const normalizedMoveCount = normalizeMoveCount(moveCount);

    if (normalizedMoveCount === null) {
        return { state, shouldPlaySound: false };
    }

    if (state?.puzzleId !== normalizedPuzzleId) {
        return {
            state: createSpectatorMoveAudioState(normalizedPuzzleId, normalizedMoveCount),
            shouldPlaySound: false,
        };
    }

    if (!state?.hasBaseline || state.lastMoveCount === null) {
        return {
            state: createSpectatorMoveAudioState(normalizedPuzzleId, normalizedMoveCount),
            shouldPlaySound: false,
        };
    }

    if (normalizedMoveCount <= state.lastMoveCount) {
        return { state, shouldPlaySound: false };
    }

    return {
        state: {
            ...state,
            lastMoveCount: normalizedMoveCount,
        },
        shouldPlaySound: true,
    };
};
