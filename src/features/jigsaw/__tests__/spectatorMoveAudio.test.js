import {
    createSpectatorMoveAudioState,
    registerSpectatorMoveUpdate,
} from '../spectatorMoveAudio';

describe('spectator move audio tracking', () => {
    it('loads an existing move count as a silent baseline', () => {
        const state = createSpectatorMoveAudioState('puzzle-1', 4);

        expect(state).toEqual({
            puzzleId: 'puzzle-1',
            lastMoveCount: 4,
            hasBaseline: true,
        });
    });

    it('plays once for a newly displayed move and ignores duplicate delivery', () => {
        const initial = createSpectatorMoveAudioState('puzzle-1', 4);
        const next = registerSpectatorMoveUpdate(initial, 'puzzle-1', 5);
        const duplicate = registerSpectatorMoveUpdate(next.state, 'puzzle-1', 5);

        expect(next.shouldPlaySound).toBe(true);
        expect(duplicate.shouldPlaySound).toBe(false);
    });

    it('plays only once when several unseen moves arrive as one board update', () => {
        const initial = createSpectatorMoveAudioState('puzzle-1', 2);
        const latest = registerSpectatorMoveUpdate(initial, 'puzzle-1', 6);

        expect(latest.shouldPlaySound).toBe(true);
        expect(latest.state.lastMoveCount).toBe(6);
    });

    it('does not replay stale moves or carry sound state between puzzles', () => {
        const initial = createSpectatorMoveAudioState('puzzle-1', 6);
        const stale = registerSpectatorMoveUpdate(initial, 'puzzle-1', 5);
        const newPuzzle = registerSpectatorMoveUpdate(stale.state, 'puzzle-2', 3);

        expect(stale.shouldPlaySound).toBe(false);
        expect(newPuzzle.shouldPlaySound).toBe(false);
        expect(newPuzzle.state.lastMoveCount).toBe(3);
    });

    it('uses the first fetched snapshot as a silent baseline', () => {
        const initial = createSpectatorMoveAudioState('puzzle-1');
        const firstSnapshot = registerSpectatorMoveUpdate(initial, 'puzzle-1', 3);
        const liveMove = registerSpectatorMoveUpdate(firstSnapshot.state, 'puzzle-1', 4);

        expect(firstSnapshot.shouldPlaySound).toBe(false);
        expect(liveMove.shouldPlaySound).toBe(true);
    });
});
