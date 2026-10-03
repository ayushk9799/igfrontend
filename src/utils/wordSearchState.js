export const wordSearchId = value => String((typeof value === 'object' ? value?._id || value?.id : value) || '');

const validCoordinate = (point, size) => (
    Number.isInteger(point?.row) && Number.isInteger(point?.col)
    && point.row >= 0 && point.row < size && point.col >= 0 && point.col < size
);

// Unfound answer coordinates stay on the server. Check visible letters here;
// the server still confirms the exact placement, turn, and score.
export const checkWordSearchSelection = (game, start, end) => {
    if (!validCoordinate(start, game.gridSize) || !validCoordinate(end, game.gridSize)) return { code: 'INVALID_SELECTION' };
    const rows = end.row - start.row;
    const cols = end.col - start.col;
    const length = Math.max(Math.abs(rows), Math.abs(cols)) + 1;
    if (length < 3 || (rows && cols && Math.abs(rows) !== Math.abs(cols))) return { code: 'INVALID_SELECTION' };
    const letters = Array.from({ length }, (_, index) => (
        game.grid[start.row + Math.sign(rows) * index][start.col + Math.sign(cols) * index]
    )).join('');
    const reversed = letters.split('').reverse().join('');
    const entry = game.words.find(word => word.word === letters || word.word === reversed);
    if (!entry) return { code: 'WORD_NOT_FOUND' };
    if (entry.foundBy) return { code: 'WORD_ALREADY_FOUND' };
    return { word: entry.word };
};

// Validate before either React or a gesture worklet reads a word or coordinate.
export const isPlayableWordSearchGame = value => {
    if (!wordSearchId(value?._id)
        || !['single', 'duel'].includes(value?.mode)
        || !['active', 'completed', 'abandoned'].includes(value?.status)
        || !wordSearchId(value?.creatorId)
        || (value.mode === 'duel' && !wordSearchId(value.partnerId))
        || !Number.isInteger(value?.gridSize) || value.gridSize < 3 || value.gridSize > 20
        || !Array.isArray(value.grid) || value.grid.length !== value.gridSize
        || !value.grid.every(row => typeof row === 'string' && /^[A-Z]+$/.test(row) && row.length === value.gridSize)
        || !Array.isArray(value.words) || !value.words.length) return false;

    const uniqueWords = new Set();
    const players = [wordSearchId(value.creatorId), wordSearchId(value.partnerId)].filter(Boolean);
    if ([value.currentTurn, value.winner].some(id => id != null && !players.includes(wordSearchId(id)))) return false;
    for (const entry of value.words) {
        if (typeof entry?.word !== 'string' || !/^[A-Z]{3,20}$/.test(entry.word)
            || entry.word.length > value.gridSize || uniqueWords.has(entry.word)) return false;
        uniqueWords.add(entry.word);
        if (entry.foundBy != null && !players.includes(wordSearchId(entry.foundBy))) return false;
        if (entry.start != null || entry.end != null || entry.foundBy) {
            if (!validCoordinate(entry.start, value.gridSize) || !validCoordinate(entry.end, value.gridSize)) return false;
            const rows = Math.abs(entry.end.row - entry.start.row);
            const cols = Math.abs(entry.end.col - entry.start.col);
            if ((rows && cols && rows !== cols) || Math.max(rows, cols) + 1 !== entry.word.length) return false;
        }
    }
    if (value.protocolVersion != null && ![1, 2].includes(value.protocolVersion)) return false;
    return ['creatorScore', 'partnerScore'].every(key => value[key] == null || (Number.isInteger(value[key]) && value[key] >= 0))
        && ['startsAt', 'turnStartedAt', 'turnExpiresAt', 'turnPausedAt', 'updatedAt', 'createdAt'].every(key => value[key] == null || Number.isFinite(Date.parse(value[key])))
        && ['turnRemainingMs', 'startRemainingMs'].every(key => value[key] == null || (Number.isFinite(value[key]) && value[key] >= 0))
        && (value.offlinePlayerIds == null || (Array.isArray(value.offlinePlayerIds)
            && value.offlinePlayerIds.every(id => players.includes(wordSearchId(id)))))
        && (value.turnDurationSeconds == null || (Number.isFinite(value.turnDurationSeconds) && value.turnDurationSeconds > 0));
};

export const normalizeWordSearchGame = value => isPlayableWordSearchGame(value) ? {
    ...value,
    protocolVersion: value.protocolVersion === 2 ? 2 : 1,
    totalWords: value.words.length,
    foundCount: value.words.filter(entry => entry.foundBy).length,
} : null;

export const shouldApplyWordSearchGame = (current, incoming, {
    allowSwitch = false,
    resumeExisting = false,
    expectedGameId,
    requestRevision,
    currentRevision,
} = {}) => {
    const currentId = wordSearchId(current?._id);
    if (expectedGameId !== undefined && expectedGameId !== currentId) return false;
    const revisionChanged = requestRevision !== undefined && requestRevision !== currentRevision;
    if (currentId !== wordSearchId(incoming._id)) {
        if (!allowSwitch || (revisionChanged && !expectedGameId)) return false;
        // A join response for the same old board may arrive during recovery.
        // It must not prevent switching to that board's newer rematch.
        return resumeExisting || !(Date.parse(incoming.createdAt) < Date.parse(current?.createdAt));
    }
    if (!current) return allowSwitch;

    const currentUpdatedAt = Date.parse(current.updatedAt);
    const incomingUpdatedAt = Date.parse(incoming.updatedAt);
    if (Number.isFinite(currentUpdatedAt) && Number.isFinite(incomingUpdatedAt)) {
        if (incomingUpdatedAt < currentUpdatedAt) return false;
    } else if (revisionChanged) return false;

    if (current.status !== 'active' && incoming.status === 'active') return false;
    if (incoming.foundCount < current.foundCount) return false;
    if (current.mode === 'duel' && incoming.status === 'active'
        && Date.parse(incoming.turnExpiresAt) < Date.parse(current.turnExpiresAt)) return false;
    return true;
};
