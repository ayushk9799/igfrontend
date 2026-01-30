// Games Slice - Manages puzzle, TicTacToe, Wordle states
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    // Puzzle
    pendingPuzzle: null,
    selectedPuzzle: null,

    // TicTacToe
    pendingTicTacToe: null,   // Game where it's my turn
    activeTicTacToe: null,    // Any active game (for showing partner's turn)
    selectedTicTacToe: null,  // Currently viewing game

    // Wordle
    pendingWordle: null,      // Game where I need to guess
    activeWordle: null,       // Active game as creator (waiting for partner)
    selectedWordle: null,     // Currently viewing game
};

const gamesSlice = createSlice({
    name: 'games',
    initialState,
    reducers: {
        // Puzzle actions
        setPendingPuzzle: (state, action) => {
            state.pendingPuzzle = action.payload;
        },
        setSelectedPuzzle: (state, action) => {
            state.selectedPuzzle = action.payload;
        },

        // TicTacToe actions
        setPendingTicTacToe: (state, action) => {
            state.pendingTicTacToe = action.payload;
        },
        setActiveTicTacToe: (state, action) => {
            state.activeTicTacToe = action.payload;
        },
        setSelectedTicTacToe: (state, action) => {
            state.selectedTicTacToe = action.payload;
        },

        // Wordle actions
        setPendingWordle: (state, action) => {
            state.pendingWordle = action.payload;
        },
        setActiveWordle: (state, action) => {
            state.activeWordle = action.payload;
        },
        setSelectedWordle: (state, action) => {
            state.selectedWordle = action.payload;
        },

        // Clear all games
        clearGames: () => initialState,
    },
});

export const {
    setPendingPuzzle,
    setSelectedPuzzle,
    setPendingTicTacToe,
    setActiveTicTacToe,
    setSelectedTicTacToe,
    setPendingWordle,
    setActiveWordle,
    setSelectedWordle,
    clearGames,
} = gamesSlice.actions;

// Selectors
export const selectGames = (state) => state.games;
export const selectPendingPuzzle = (state) => state.games.pendingPuzzle;
export const selectPendingTicTacToe = (state) => state.games.pendingTicTacToe;
export const selectActiveTicTacToe = (state) => state.games.activeTicTacToe;
export const selectPendingWordle = (state) => state.games.pendingWordle;
export const selectActiveWordle = (state) => state.games.activeWordle;

export default gamesSlice.reducer;
