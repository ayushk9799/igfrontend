// Notifications Slice - Derives duel notifications from gamesSlice state
// No new state needed — just selectors that read from the games slice

import { createSelector } from '@reduxjs/toolkit';
import {
    selectPendingPuzzle,
    selectPendingPuzzles,
    selectPendingTicTacToe,
    selectPendingWordle,
    selectPendingWordSearch,
} from './gamesSlice';

const selectCurrentUserId = (state) => state.user?.id || state.user?._id || null;

const getEntityId = (entity) => entity?._id || entity?.id || entity || null;

const isPuzzleActionableForUser = (puzzle, userId) => {
    if (!puzzle || !userId) return false;

    const partnerId = getEntityId(puzzle.partnerId);
    const isRecipient = partnerId && String(partnerId) === String(userId);
    const isActive = ['pending', 'in_progress'].includes(puzzle.status);

    return isRecipient && isActive;
};

/**
 * Selector that derives a list of duel notification objects from the games state.
 * Each notification has: id, type, title, message, color, game (raw data).
 */
export const selectDuelNotifications = createSelector(
    [selectPendingPuzzle, selectPendingTicTacToe, selectPendingWordle, selectPendingWordSearch],
    (pendingPuzzle, pendingTicTacToe, pendingWordle, pendingWordSearch) => {
        const notifications = [];

        if (pendingPuzzle) {
            notifications.push({
                id: 'puzzle',
                type: 'puzzle',
                title: "Jigsaw Puzzle",
                message: "A puzzle is waiting for you!",
                color: '#D4714A', // orange
                game: pendingPuzzle,
            });
        }

        if (pendingTicTacToe) {
            notifications.push({
                id: 'tictactoe',
                type: 'tictactoe',
                title: "Tic Tac Toe",
                message: "It's your turn!",
                color: '#3A9B8C', // teal
                game: pendingTicTacToe,
            });
        }

        if (pendingWordle) {
            notifications.push({
                id: 'wordle',
                type: 'wordle',
                title: "Wordle",
                message: "Guess the word!",
                color: '#6AAA64', // green
                game: pendingWordle,
            });
        }

        if (pendingWordSearch) {
            notifications.push({
                id: 'wordsearch',
                type: 'wordsearch',
                title: 'Word Search',
                message: "It's your turn to find a word!",
                color: '#865EDC',
                game: pendingWordSearch,
            });
        }

        return notifications;
    }
);

/**
 * Selector that returns the total count of pending duel notifications.
 */
export const selectDuelBadgeCount = createSelector(
    [selectDuelNotifications],
    (notifications) => notifications.length
);

/**
 * Which game cards, and therefore whether the Games bottom tab, should show
 * an action-needed dot.
 *
 * A sent puzzle or a game where it is the partner's turn is deliberately not
 * considered actionable. The indicator remains visible until the underlying
 * turn/challenge is completed rather than clearing merely because the tab was
 * opened.
 */
export const selectGameAttentionByType = createSelector(
    [
        selectPendingPuzzles,
        selectPendingPuzzle,
        selectPendingTicTacToe,
        selectPendingWordle,
        selectPendingWordSearch,
        selectCurrentUserId,
    ],
    (pendingPuzzles, pendingPuzzle, pendingTicTacToe, pendingWordle, pendingWordSearch, userId) => {
        const puzzles = pendingPuzzles?.length ? pendingPuzzles : [pendingPuzzle];
        const hasPuzzleToPlay = puzzles.some((puzzle) => (
            isPuzzleActionableForUser(puzzle, userId)
        ));

        return {
            puzzle: hasPuzzleToPlay,
            tictactoe: !!pendingTicTacToe,
            wordle: !!pendingWordle,
            wordsearch: !!pendingWordSearch,
        };
    }
);

export const selectGamesNeedAttention = createSelector(
    [selectGameAttentionByType],
    (attentionByType) => Object.values(attentionByType).some(Boolean)
);
