// Notifications Slice - Derives duel notifications from gamesSlice state
// No new state needed — just selectors that read from the games slice

import { createSelector } from '@reduxjs/toolkit';
import { selectPendingPuzzle, selectPendingTicTacToe, selectPendingWordle } from './gamesSlice';

/**
 * Selector that derives a list of duel notification objects from the games state.
 * Each notification has: id, type, title, message, color, game (raw data).
 */
export const selectDuelNotifications = createSelector(
    [selectPendingPuzzle, selectPendingTicTacToe, selectPendingWordle],
    (pendingPuzzle, pendingTicTacToe, pendingWordle) => {
        const notifications = [];

        if (pendingPuzzle) {
            notifications.push({
                id: 'puzzle',
                type: 'puzzle',
                title: 'Jigsaw Puzzle',
                message: 'A puzzle is waiting for you!',
                color: '#D4714A', // orange
                game: pendingPuzzle,
            });
        }

        if (pendingTicTacToe) {
            notifications.push({
                id: 'tictactoe',
                type: 'tictactoe',
                title: 'Tic Tac Toe',
                message: "It's your turn!",
                color: '#3A9B8C', // teal
                game: pendingTicTacToe,
            });
        }

        if (pendingWordle) {
            notifications.push({
                id: 'wordle',
                type: 'wordle',
                title: 'Wordle',
                message: 'Guess the word!',
                color: '#6AAA64', // green
                game: pendingWordle,
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
