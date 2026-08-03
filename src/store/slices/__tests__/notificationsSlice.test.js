import { selectGamesNeedAttention } from '../notificationsSlice';

const makeState = ({
    userId = 'user-1',
    pendingPuzzles = [],
    pendingPuzzle = null,
    pendingTicTacToe = null,
    pendingWordle = null,
} = {}) => ({
    user: { id: userId },
    games: {
        pendingPuzzles,
        pendingPuzzle,
        pendingTicTacToe,
        pendingWordle,
    },
});

describe('selectGamesNeedAttention', () => {
    it('returns true for a puzzle the current user needs to play', () => {
        const state = makeState({
            pendingPuzzles: [{
                _id: 'puzzle-1',
                creatorId: 'partner-1',
                partnerId: { _id: 'user-1' },
                status: 'pending',
            }],
        });

        expect(selectGamesNeedAttention(state)).toBe(true);
    });

    it('does not flag a puzzle sent by the current user', () => {
        const state = makeState({
            pendingPuzzles: [{
                _id: 'puzzle-1',
                creatorId: 'user-1',
                partnerId: 'partner-1',
                status: 'pending',
            }],
        });

        expect(selectGamesNeedAttention(state)).toBe(false);
    });

    it('checks every active puzzle instead of only the displayed puzzle', () => {
        const sentPuzzle = {
            _id: 'puzzle-sent',
            creatorId: 'user-1',
            partnerId: 'partner-1',
            status: 'pending',
        };
        const receivedPuzzle = {
            _id: 'puzzle-received',
            creatorId: 'partner-1',
            partnerId: 'user-1',
            status: 'in_progress',
        };
        const state = makeState({
            pendingPuzzle: sentPuzzle,
            pendingPuzzles: [sentPuzzle, receivedPuzzle],
        });

        expect(selectGamesNeedAttention(state)).toBe(true);
    });

    it('returns true when Tic-Tac-Toe is waiting for the current turn', () => {
        const state = makeState({
            pendingTicTacToe: { _id: 'tic-1', currentTurn: 'partner' },
        });

        expect(selectGamesNeedAttention(state)).toBe(true);
    });

    it('returns true when Wordle is waiting for a guess', () => {
        const state = makeState({
            pendingWordle: { _id: 'wordle-1', status: 'in_progress' },
        });

        expect(selectGamesNeedAttention(state)).toBe(true);
    });

    it('returns false when no game needs action', () => {
        expect(selectGamesNeedAttention(makeState())).toBe(false);
    });
});
