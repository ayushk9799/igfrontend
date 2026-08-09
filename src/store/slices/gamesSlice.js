// Games Slice - Manages puzzle and duel game states
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    // Puzzle
    pendingPuzzles: [],
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

    // Word Search
    pendingWordSearch: null,  // Active duel where it is my turn
    activeWordSearch: null,   // Any active word-search game
    selectedWordSearch: null,
};

const gamesSlice = createSlice({
    name: 'games',
    initialState,
    reducers: {
        // Puzzle actions
        setPendingPuzzles: (state, action) => {
            state.pendingPuzzles = action.payload || [];
        },
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

        setPendingWordSearch: (state, action) => {
            state.pendingWordSearch = action.payload;
        },
        setActiveWordSearch: (state, action) => {
            state.activeWordSearch = action.payload;
        },
        setSelectedWordSearch: (state, action) => {
            state.selectedWordSearch = action.payload;
        },

        // Clear all games
        clearGames: () => initialState,
    },
});

export const {
    setPendingPuzzles,
    setPendingPuzzle,
    setSelectedPuzzle,
    setPendingTicTacToe,
    setActiveTicTacToe,
    setSelectedTicTacToe,
    setPendingWordle,
    setActiveWordle,
    setSelectedWordle,
    setPendingWordSearch,
    setActiveWordSearch,
    setSelectedWordSearch,
    clearGames,
} = gamesSlice.actions;

// Selectors
export const selectGames = (state) => state.games;
export const selectPendingPuzzles = (state) => state.games.pendingPuzzles;
export const selectPendingPuzzle = (state) => state.games.pendingPuzzle;
export const selectPendingTicTacToe = (state) => state.games.pendingTicTacToe;
export const selectActiveTicTacToe = (state) => state.games.activeTicTacToe;
export const selectPendingWordle = (state) => state.games.pendingWordle;
export const selectActiveWordle = (state) => state.games.activeWordle;
export const selectPendingWordSearch = (state) => state.games.pendingWordSearch;
export const selectActiveWordSearch = (state) => state.games.activeWordSearch;

export default gamesSlice.reducer;
