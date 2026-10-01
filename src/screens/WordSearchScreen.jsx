import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Bell, ChevronLeft, MoreVertical, RotateCcw, Swords, Timer, User, X } from 'lucide-react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { API_BASE } from '../constants/Api';
import { fontFamily } from '../constants/fonts';
import { useSocketContext } from '../context/SocketContext';
import usePresence from '../hooks/usePresence';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import { apiFetch } from '../utils/apiFetch';
import { getUser, storage } from '../utils/authStorage';

const triggerHaptic = (type = 'selection') => {
    try {
        ReactNativeHapticFeedback.trigger(type, {
            enableVibrateFallback: false,
            ignoreAndroidSystemSettings: false,
        });
    } catch (_) {}
};

const DIFFICULTY_OPTIONS = [
    { id: 'easy', title: 'Easy', gridSize: '8 × 8' },
    { id: 'medium', title: 'Medium', gridSize: '10 × 10' },
    { id: 'hard', title: 'Hard', gridSize: '12 × 12' },
];

const TURN_DURATION_SECONDS = 45;
const SELECTION_HAPTIC_INTERVAL_MS = 45;

const idOf = value => String(value?._id || value || '');

const lineCoordinates = (start, end) => {
    if (!start || !end) return [];
    const rowDistance = end.row - start.row;
    const colDistance = end.col - start.col;
    const straight = rowDistance === 0 || colDistance === 0;
    const diagonal = Math.abs(rowDistance) === Math.abs(colDistance);
    if (!straight && !diagonal) return [];
    const length = Math.max(Math.abs(rowDistance), Math.abs(colDistance)) + 1;
    return Array.from({ length }, (_, index) => ({
        row: start.row + (Math.sign(rowDistance) * index),
        col: start.col + (Math.sign(colDistance) * index),
    }));
};

const selectionFromPosition = (start, x, y, cellSize, gridSize) => {
    'worklet';
    const startX = 6 + (start.col + 0.5) * cellSize;
    const startY = 6 + (start.row + 0.5) * cellSize;
    const pointerX = Math.max(6, Math.min(6 + gridSize * cellSize, x));
    const pointerY = Math.max(6, Math.min(6 + gridSize * cellSize, y));
    const directionAngle = Math.round(Math.atan2(pointerY - startY, pointerX - startX) / (Math.PI / 4)) * (Math.PI / 4);
    const rowStep = Math.round(Math.sin(directionAngle));
    const colStep = Math.round(Math.cos(directionAngle));
    const rowLimit = rowStep > 0
        ? gridSize - 1 - start.row
        : rowStep < 0 ? start.row : Number.POSITIVE_INFINITY;
    const colLimit = colStep > 0
        ? gridSize - 1 - start.col
        : colStep < 0 ? start.col : Number.POSITIVE_INFINITY;
    const stepLength = Math.hypot(rowStep, colStep);
    const maxSteps = Math.min(rowLimit, colLimit);
    const projectedDistance = ((pointerX - startX) * colStep + (pointerY - startY) * rowStep) / stepLength;
    const distance = Math.max(0, Math.min(maxSteps * cellSize * stepLength, projectedDistance));
    const steps = Math.min(maxSteps, Math.round(distance / (cellSize * stepLength)));

    return {
        endRow: start.row + rowStep * steps,
        endCol: start.col + colStep * steps,
        rowStep,
        colStep,
        distance,
    };
};

const cellFromPosition = (x, y, cellSize, gridSize) => {
    'worklet';
    return {
        row: Math.max(0, Math.min(gridSize - 1, Math.floor((y - 6) / cellSize))),
        col: Math.max(0, Math.min(gridSize - 1, Math.floor((x - 6) / cellSize))),
    };
};

const matchesUnfoundWord = (start, end, grid, availableWords) => {
    'worklet';
    const rowStep = Math.sign(end.row - start.row);
    const colStep = Math.sign(end.col - start.col);
    const length = Math.max(Math.abs(end.row - start.row), Math.abs(end.col - start.col)) + 1;
    if (length < 3) return false;

    let letters = '';
    let reversed = '';
    for (let index = 0; index < length; index += 1) {
        const letter = grid[start.row + rowStep * index][start.col + colStep * index];
        letters += letter;
        reversed = letter + reversed;
    }
    return availableWords.includes(letters) || availableWords.includes(reversed);
};

const EMPTY_DRAG = {
    active: false,
    released: false,
    startRow: 0,
    startCol: 0,
    endRow: 0,
    endCol: 0,
    rowStep: 0,
    colStep: 1,
    distance: 0,
    matched: false,
    lastHapticAt: 0,
};

const getWordLineStyle = (start, end, cellSize) => {
    if (
        !start
        || !end
        || !cellSize
        || ![start.row, start.col, end.row, end.col].every(Number.isFinite)
    ) return null;
    const boardPadding = 6;
    const startX = boardPadding + ((start.col + 0.5) * cellSize);
    const startY = boardPadding + ((start.row + 0.5) * cellSize);
    const endX = boardPadding + ((end.col + 0.5) * cellSize);
    const endY = boardPadding + ((end.row + 0.5) * cellSize);
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const thickness = cellSize * 0.76;
    const length = Math.hypot(deltaX, deltaY) + thickness;
    const centerX = (startX + endX) / 2;
    const centerY = (startY + endY) / 2;
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    return {
        width: length,
        height: thickness,
        left: centerX - (length / 2),
        top: centerY - (thickness / 2),
        borderRadius: thickness / 2,
        transform: [{ rotate: `${angle}deg` }],
    };
};

const isPlayableGamePayload = (value) => (
    Boolean(value?._id)
    && Number.isInteger(value?.gridSize)
    && value.gridSize >= 3
    && value.gridSize <= 20
    && Array.isArray(value?.grid)
    && value.grid.length === value.gridSize
    && value.grid.every(row => typeof row === 'string' && row.length === value.gridSize)
    && Array.isArray(value?.words)
);

// Letters stay static while the selection preview moves on the UI thread.
const WordSearchCell = React.memo(({ letter, cellSize }) => (
    <View style={[styles.cell, { width: cellSize, height: cellSize }]}>
        <Text style={[
            styles.letter,
            { fontSize: Math.max(12, cellSize * 0.48) },
        ]}>{letter}</Text>
    </View>
));

const WordSearchBoard = React.memo(({
    game,
    cellSize,
    userId,
    canInteractWithBoard,
    submitting,
    myTurn,
    message,
    turnCountdown,
    onSubmitSelection,
    onMessage,
}) => {
    const grid = game.grid;
    const gridSize = game.gridSize;
    const drag = useSharedValue(EMPTY_DRAG);
    const availableWords = useMemo(() => game.words
        .filter(word => !word.foundBy)
        .map(word => word.word), [game.words]);

    const clearDrag = useCallback(() => {
        drag.value = EMPTY_DRAG;
    }, [drag]);

    const finishWordDrag = useCallback((startRow, startCol, endRow, endCol) => {
        const start = { row: startRow, col: startCol };
        const end = { row: endRow, col: endCol };
        if (lineCoordinates(start, end).length < 3) {
            clearDrag();
            onMessage('Touch a letter, drag across the whole word, then release.');
            return;
        }
        Promise.resolve(onSubmitSelection(start, end)).finally(clearDrag);
    }, [clearDrag, onMessage, onSubmitSelection]);

    const gesture = useMemo(() => Gesture.Pan()
        .enabled(canInteractWithBoard && !submitting)
        .minDistance(0)
        .maxPointers(1)
        .onBegin((event) => {
            const start = cellFromPosition(event.x, event.y, cellSize, gridSize);
            drag.value = {
                active: true,
                released: false,
                startRow: start.row,
                startCol: start.col,
                endRow: start.row,
                endCol: start.col,
                rowStep: 0,
                colStep: 1,
                distance: 0,
                matched: false,
                lastHapticAt: Date.now(),
            };
            scheduleOnRN(triggerHaptic, 'selection');
        })
        .onUpdate((event) => {
            const currentDrag = drag.value;
            if (!currentDrag.active || currentDrag.released) return;
            const start = { row: currentDrag.startRow, col: currentDrag.startCol };
            const selection = selectionFromPosition(start, event.x, event.y, cellSize, gridSize);
            const end = { row: selection.endRow, col: selection.endCol };
            const changed = end.row !== currentDrag.endRow || end.col !== currentDrag.endCol;
            const now = Date.now();
            const shouldTick = changed && now - currentDrag.lastHapticAt >= SELECTION_HAPTIC_INTERVAL_MS;
            drag.value = {
                ...currentDrag,
                endRow: end.row,
                endCol: end.col,
                rowStep: selection.rowStep,
                colStep: selection.colStep,
                distance: selection.distance,
                matched: changed
                    ? matchesUnfoundWord(start, end, grid, availableWords)
                    : currentDrag.matched,
                lastHapticAt: shouldTick ? now : currentDrag.lastHapticAt,
            };
            if (shouldTick) scheduleOnRN(triggerHaptic, 'selection');
        })
        .onEnd((event) => {
            const currentDrag = drag.value;
            if (!currentDrag.active) return;
            const start = { row: currentDrag.startRow, col: currentDrag.startCol };
            const selection = selectionFromPosition(start, event.x, event.y, cellSize, gridSize);
            const end = { row: selection.endRow, col: selection.endCol };
            drag.value = {
                ...currentDrag,
                endRow: end.row,
                endCol: end.col,
                rowStep: selection.rowStep,
                colStep: selection.colStep,
                distance: Math.hypot(end.row - start.row, end.col - start.col) * cellSize,
                matched: matchesUnfoundWord(start, end, grid, availableWords),
                released: true,
            };
            scheduleOnRN(finishWordDrag, start.row, start.col, end.row, end.col);
        })
        .onFinalize((_event, success) => {
            if (!success) drag.value = EMPTY_DRAG;
        }), [availableWords, canInteractWithBoard, cellSize, drag, finishWordDrag, grid, gridSize, submitting]);

    useEffect(() => {
        if (!canInteractWithBoard && !submitting) clearDrag();
    }, [canInteractWithBoard, clearDrag, submitting]);

    const animatedDragLineStyle = useAnimatedStyle(() => {
        const currentDrag = drag.value;
        const thickness = cellSize * 0.76;
        const startX = 6 + (currentDrag.startCol + 0.5) * cellSize;
        const startY = 6 + (currentDrag.startRow + 0.5) * cellSize;
        const rowStep = currentDrag.rowStep;
        const colStep = currentDrag.colStep;
        const stepLength = Math.hypot(rowStep, colStep);
        const distance = currentDrag.distance;
        const endX = startX + colStep * distance / stepLength;
        const endY = startY + rowStep * distance / stepLength;
        const length = distance + thickness;

        return {
            opacity: currentDrag.active ? 1 : 0,
            width: length,
            left: (startX + endX - length) / 2,
            top: (startY + endY - thickness) / 2,
            backgroundColor: currentDrag.matched ? 'rgba(92, 211, 190, 0.40)' : 'rgba(247, 196, 69, 0.46)',
            borderColor: currentDrag.matched ? '#42BBA5' : '#E7A91D',
            shadowColor: currentDrag.matched ? '#319E8B' : '#D89A0A',
            transform: [{ rotate: `${Math.atan2(rowStep, colStep) * 180 / Math.PI}deg` }],
        };
    }, [cellSize]);
    const foundWordLines = useMemo(() => game.words
        .filter(word => word.foundBy && word.start && word.end)
        .map(word => ({
            key: word.word,
            isMine: idOf(word.foundBy) === userId,
            style: getWordLineStyle(word.start, word.end, cellSize),
        }))
        .filter(line => line.style), [cellSize, game.words, userId]);

    return (
        <>
            <GestureDetector gesture={gesture}>
                <View
                    style={[
                        styles.board,
                        { width: cellSize * gridSize + 12 },
                        !canInteractWithBoard && styles.boardLocked,
                    ]}
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel="Word search letter grid"
                    accessibilityHint="Touch the first letter, drag to the last letter, and release"
                >
                    {foundWordLines.map(line => (
                        <View
                            key={line.key}
                            pointerEvents="none"
                            style={[
                                styles.wordLine,
                                line.style,
                                line.isMine ? styles.myWordLine : styles.partnerWordLine,
                            ]}
                        />
                    ))}
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.wordLine,
                            styles.dragWordLine,
                            { height: cellSize * 0.76, borderRadius: cellSize * 0.38 },
                            animatedDragLineStyle,
                        ]}
                    />
                    {grid.map((rowLetters, row) => (
                        <View key={`row-${row}`} style={styles.boardRow} pointerEvents="none">
                            {rowLetters.split('').map((letter, col) => (
                                <WordSearchCell
                                    key={`${row}-${col}`}
                                    letter={letter}
                                    cellSize={cellSize}
                                />
                            ))}
                        </View>
                    ))}
                </View>
            </GestureDetector>
            <Text style={styles.instruction}>
                {message || (game.mode === 'duel' && !myTurn
                    ? `Watch the board — your turn is next in ${turnCountdown}`
                    : 'Touch, drag across a word, then release')}
            </Text>
        </>
    );
});

const WordSearchScreen = ({ navigation, route }) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { socket } = useSocketContext();
    const { partnerOnline, isConnected, refreshPresence, sendNudge } = usePresence();
    const currentUser = getUser();
    const userId = idOf(currentUser?.id || currentUser?._id);
    const partnerId = idOf(route?.params?.partnerId || currentUser?.partnerId);
    const partnerName = route?.params?.partnerName || currentUser?.partnerUsername || 'Partner';
    const initialGameCandidate = route?.params?.gameData || null;
    const initialGame = isPlayableGamePayload(initialGameCandidate) ? initialGameCandidate : null;

    const [game, setGame] = useState(initialGame);
    const [difficulty, setDifficulty] = useState(() => {
        return storage.getString('wordsearch_difficulty') || 'medium';
    });
    const [userSelectedMode, setUserSelectedMode] = useState(() => {
        return storage.getString('wordsearch_mode') || null;
    });
    const settingsBottomSheetRef = useRef(null);
    const endChallengeSheetRef = useRef(null);
    const openEndChallengeAfterSettingsRef = useRef(false);

    const openSettings = useCallback(() => {
        settingsBottomSheetRef.current?.present();
    }, []);

    const closeSettings = useCallback(() => {
        settingsBottomSheetRef.current?.dismiss();
    }, []);

    const handleSettingsDismiss = useCallback(() => {
        if (!openEndChallengeAfterSettingsRef.current) return;
        openEndChallengeAfterSettingsRef.current = false;
        endChallengeSheetRef.current?.present();
    }, []);

    const renderBackdrop = useCallback(backdropProps => (
        <BottomSheetBackdrop
            {...backdropProps}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.35}
            pressBehavior="close"
        />
    ), []);
    const [nudgeSent, setNudgeSent] = useState(false);
    const [presenceKnown, setPresenceKnown] = useState(!partnerId);
    const autoStartRef = useRef(false);
    const confettiRef = useRef(null);
    const celebratedGameIdsRef = useRef(new Set());
    const [loading, setLoading] = useState(!initialGame);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [secondsRemaining, setSecondsRemaining] = useState(TURN_DURATION_SECONDS);
    const [roundStarted, setRoundStarted] = useState(true);
    const [rematchCountdownLabel, setRematchCountdownLabel] = useState(null);
    const [pendingNewPuzzle, setPendingNewPuzzle] = useState(null);
    const expiryRefreshRef = useRef('');
    const startingNewPuzzleRef = useRef(false);

    const gameId = idOf(game?._id);
    const creatorId = idOf(game?.creatorId);
    const isCreator = creatorId === userId;
    const myScore = isCreator ? game?.creatorScore || 0 : game?.partnerScore || 0;
    const theirScore = isCreator ? game?.partnerScore || 0 : game?.creatorScore || 0;
    const myTurn = game?.mode === 'single' || idOf(game?.currentTurn) === userId;
    const turnDurationSeconds = game?.turnDurationSeconds || TURN_DURATION_SECONDS;
    const turnIsOver = game?.mode === 'duel' && secondsRemaining <= 0;
    const canInteractWithBoard = game?.status === 'active'
        && roundStarted
        && (game.mode === 'single' || (myTurn && !turnIsOver));
    const canPlayTogether = Boolean(partnerId && partnerOnline);
    const gameMode = userSelectedMode || (canPlayTogether ? 'duel' : 'single');
    const nextPuzzleMode = (!partnerId || !partnerOnline || gameMode === 'single') ? 'single' : 'duel';
    const showOfflineNote = gameMode === 'duel' && !partnerOnline;

    const applyGamePayload = useCallback((payload) => {
        if (!isPlayableGamePayload(payload)) {
            setGame(null);
            setMessage('The game data was incomplete. Please try again.');
            return false;
        }
        const payloadGameId = idOf(payload._id);
        if (payload.status === 'completed' && !celebratedGameIdsRef.current.has(payloadGameId)) {
            celebratedGameIdsRef.current.add(payloadGameId);
            requestAnimationFrame(() => confettiRef.current?.start());
        }
        setGame(payload);
        return true;
    }, []);

    // Notification navigation can update route data without remounting this
    // screen. Mirror a genuinely new route payload into the live board.
    useEffect(() => {
        if (isPlayableGamePayload(initialGameCandidate)) {
            applyGamePayload(initialGameCandidate);
        }
    }, [applyGamePayload, initialGameCandidate]);

    useEffect(() => {
        refreshPresence();
    }, [refreshPresence]);

    useEffect(() => {
        if (!socket || !partnerId) return undefined;
        const markPresenceKnown = () => setPresenceKnown(true);
        socket.on('presence:status', markPresenceKnown);
        socket.on('presence:online', markPresenceKnown);
        socket.on('presence:offline', markPresenceKnown);
        socket.emit('presence:getStatus');
        return () => {
            socket.off('presence:status', markPresenceKnown);
            socket.off('presence:online', markPresenceKnown);
            socket.off('presence:offline', markPresenceKnown);
        };
    }, [partnerId, socket]);

    useEffect(() => {
        if (partnerOnline) setNudgeSent(false);
    }, [partnerOnline]);

    const fetchGame = useCallback(async (id) => {
        if (!id || !userId) return;
        const response = await fetch(`${API_BASE}/api/word-search/${id}?userId=${userId}`);
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.message || 'Could not load game');
        applyGamePayload(json.data);
    }, [applyGamePayload, userId]);

    useEffect(() => {
        if (game?.mode !== 'duel' || game?.status !== 'active' || !game?.turnExpiresAt) {
            setSecondsRemaining(turnDurationSeconds);
            return undefined;
        }

        const updateCountdown = () => {
            const startsAtMs = game.startsAt ? new Date(game.startsAt).getTime() : 0;
            if (startsAtMs > Date.now()) {
                setSecondsRemaining(turnDurationSeconds);
                return;
            }
            const millisecondsLeft = new Date(game.turnExpiresAt).getTime() - Date.now();
            setSecondsRemaining(Math.max(0, Math.ceil(millisecondsLeft / 1000)));
        };
        updateCountdown();
        const interval = setInterval(updateCountdown, 250);
        return () => clearInterval(interval);
    }, [game?.mode, game?.startsAt, game?.status, game?.turnExpiresAt, turnDurationSeconds]);

    useEffect(() => {
        const startsAtMs = game?.startsAt ? new Date(game.startsAt).getTime() : Number.NaN;
        if (game?.mode !== 'duel' || game?.status !== 'active' || !Number.isFinite(startsAtMs) || startsAtMs <= Date.now()) {
            setRoundStarted(true);
            setRematchCountdownLabel(null);
            return undefined;
        }

        let goTimeout;
        setRoundStarted(false);
        const updateRematchCountdown = () => {
            const millisecondsLeft = startsAtMs - Date.now();
            if (millisecondsLeft > 0) {
                const count = Math.max(1, Math.min(3, Math.ceil(millisecondsLeft / 1000)));
                setRematchCountdownLabel(String(count));
                return;
            }

            clearInterval(interval);
            setRoundStarted(true);
            setRematchCountdownLabel('GO!');
            goTimeout = setTimeout(() => setRematchCountdownLabel(null), 650);
        };
        const interval = setInterval(updateRematchCountdown, 100);
        updateRematchCountdown();
        return () => {
            clearInterval(interval);
            if (goTimeout) clearTimeout(goTimeout);
        };
    }, [game?.mode, game?.startsAt, game?.status]);

    useEffect(() => {
        if (game?.mode !== 'duel' || game?.status !== 'active' || !game?.turnExpiresAt || !gameId) {
            return undefined;
        }
        const expiryKey = `${gameId}:${game.turnExpiresAt}`;
        const delay = Math.max(0, new Date(game.turnExpiresAt).getTime() - Date.now()) + 300;
        const timeout = setTimeout(() => {
            if (expiryRefreshRef.current === expiryKey) return;
            expiryRefreshRef.current = expiryKey;
            fetchGame(gameId).catch(() => {});
        }, delay);
        return () => clearTimeout(timeout);
    }, [fetchGame, game?.mode, game?.status, game?.turnExpiresAt, gameId]);

    useEffect(() => {
        if (initialGame || !userId) {
            setLoading(false);
            return undefined;
        }

        let active = true;
        fetch(`${API_BASE}/api/word-search/active/${userId}`)
            .then(response => response.json())
            .then(json => {
                if (active && json.success && json.data) applyGamePayload(json.data);
            })
            .catch(() => {})
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [applyGamePayload, initialGame, userId]);

    useEffect(() => {
        if (!socket) return undefined;
        const handleUpdate = (payload = {}) => {
            if (idOf(payload.gameId) === gameId && payload.game) {
                applyGamePayload(payload.game);
                if (payload.reason === 'turn_timeout') {
                    const nextTurnIsMine = idOf(payload.game.currentTurn) === userId;
                    setMessage(nextTurnIsMine ? 'Your turn — go!' : `${partnerName}’s turn now.`);
                } else if (payload.foundWord) {
                    setMessage(`${payload.foundWord} found! Keep going.`);
                }
            }
        };
        const handleInvite = (payload = {}) => {
            if (!isPlayableGamePayload(payload.game)) return;
            const invitedCreatorId = idOf(payload.game.creatorId);
            const invitedPartnerId = idOf(payload.game.partnerId);
            if (![invitedCreatorId, invitedPartnerId].includes(userId)) return;

            expiryRefreshRef.current = '';
            applyGamePayload(payload.game);
            setMessage(invitedCreatorId === userId
                ? 'New challenge ready!'
                : `${partnerName} started a new challenge!`);
        };
        const handleRematchStarted = (payload = {}) => {
            if (!isPlayableGamePayload(payload.game)) return;
            const rematchCreatorId = idOf(payload.game.creatorId);
            const rematchPartnerId = idOf(payload.game.partnerId);
            if (![rematchCreatorId, rematchPartnerId].includes(userId)) return;

            expiryRefreshRef.current = '';
            applyGamePayload(payload.game);
            setMessage('Rematch starting…');
        };
        const handleJoined = (payload = {}) => {
            if (payload.success && idOf(payload.game?._id) === gameId) applyGamePayload(payload.game);
        };

        if (gameId) socket.emit('wordsearch:join', { gameId });
        socket.on('wordsearch:invited', handleInvite);
        socket.on('wordsearch:rematchStarted', handleRematchStarted);
        socket.on('wordsearch:updated', handleUpdate);
        socket.on('wordsearch:joined', handleJoined);
        return () => {
            if (gameId) socket.emit('wordsearch:leave', { gameId });
            socket.off('wordsearch:invited', handleInvite);
            socket.off('wordsearch:rematchStarted', handleRematchStarted);
            socket.off('wordsearch:updated', handleUpdate);
            socket.off('wordsearch:joined', handleJoined);
        };
    }, [applyGamePayload, socket, gameId, partnerName, userId]);

    const requestPuzzle = useCallback(async ({ mode, targetDifficulty, forceNew = false }) => {
        const modesToTry = mode === 'duel' ? ['duel', 'single'] : ['single'];
        for (const requestedMode of modesToTry) {
            const response = await apiFetch(`${API_BASE}/api/word-search/create`, {
                method: 'POST',
                body: JSON.stringify({
                    creatorId: userId,
                    partnerId,
                    mode: requestedMode,
                    difficulty: targetDifficulty,
                    forceNew,
                }),
            });
            const json = await response.json();
            if (response.ok && json.success) return json;
            if (requestedMode === 'duel' && json.code === 'PARTNER_OFFLINE') {
                setPresenceKnown(true);
                refreshPresence();
                continue;
            }
            throw new Error(json.message || translateUiText('Could not start game'));
        }
        throw new Error(translateUiText('Could not start game'));
    }, [partnerId, refreshPresence, userId]);

    const createGame = useCallback(async () => {
        if (partnerId && !presenceKnown) {
            setMessage('Checking whether your partner is online…');
            return;
        }
        setSubmitting(true);
        setMessage('Building your puzzle…');
        try {
            const json = await requestPuzzle({ mode: nextPuzzleMode, targetDifficulty: difficulty });
            if (!applyGamePayload(json.data)) throw new Error('The server returned an incomplete game.');
            setMessage(json.isExisting ? 'Resuming your active game.' : (json.data.mode === 'duel' ? `Game started with ${partnerName}!` : 'Solo puzzle ready!'));
        } catch (error) {
            setMessage(error.message || 'Could not start game.');
        } finally {
            setSubmitting(false);
        }
    }, [applyGamePayload, difficulty, nextPuzzleMode, partnerId, partnerName, presenceKnown, requestPuzzle]);

    const handleNudgePartner = useCallback(() => {
        if (!isConnected) {
            setMessage('Connect to the internet to nudge your partner.');
            return;
        }
        sendNudge('wordsearch');
        setNudgeSent(true);
        setMessage(`Nudge sent to ${partnerName}!`);
    }, [isConnected, partnerName, sendNudge]);

    useEffect(() => {
        if (
            loading
            || game
            || submitting
            || (partnerId && !presenceKnown)
            || autoStartRef.current
        ) return;

        autoStartRef.current = true;
        createGame();
    }, [createGame, game, loading, partnerId, presenceKnown, submitting]);

    const submitSelection = useCallback(async (start, end) => {
        const path = lineCoordinates(start, end);
        if (path.length < 3) {
            setMessage('Choose a straight or diagonal line of at least 3 letters.');
            return;
        }

        setSubmitting(true);
        setMessage('Checking…');
        try {
            const response = await fetch(`${API_BASE}/api/word-search/${gameId}/find`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, start, end }),
            });
            const json = await response.json();
            if (!response.ok || !json.success) {
                if (json.data) applyGamePayload(json.data);
                const selectionError = new Error(json.message || 'That is not a hidden word');
                selectionError.code = json.code;
                throw selectionError;
            }
            if (!applyGamePayload(json.data)) throw new Error('The server returned an incomplete game.');
            triggerHaptic('notificationSuccess');
            if (json.rematch && applyGamePayload(json.rematch)) {
                setMessage('Rematch starting…');
            } else {
                setMessage(`${json.foundWord} found! Keep going.`);
            }
        } catch (error) {
            setMessage(error.message || 'That is not a hidden word.');
            if (error.code === 'NOT_YOUR_TURN' || error.message?.includes('changed')) fetchGame(gameId).catch(() => {});
        } finally {
            setSubmitting(false);
        }
    }, [applyGamePayload, fetchGame, gameId, userId]);

    const executeNewPuzzle = useCallback(async (targetDifficulty, targetMode) => {
        if (startingNewPuzzleRef.current) return;
        startingNewPuzzleRef.current = true;
        const mode = (!partnerId || !partnerOnline || targetMode === 'single') ? 'single' : 'duel';
        autoStartRef.current = true;
        setSubmitting(true);
        setMessage(translateUiText('Building a new puzzle…'));
        let abandonedCurrentGame = false;

        try {
            if (gameId && game?.status === 'active') {
                const abandonResponse = await apiFetch(`${API_BASE}/api/word-search/${gameId}/abandon`, {
                    method: 'POST',
                    body: JSON.stringify({ userId }),
                });
                const abandonJson = await abandonResponse.json();
                if (!abandonResponse.ok || !abandonJson.success || !['abandoned', 'completed'].includes(abandonJson.data?.status)) {
                    throw new Error(abandonJson.message || translateUiText('Could not end the current game'));
                }
                abandonedCurrentGame = true;
            }

            const createJson = await requestPuzzle({
                mode,
                targetDifficulty,
                forceNew: true,
            });
            if (!applyGamePayload(createJson.data)) {
                throw new Error(translateUiText('The server returned an incomplete game.'));
            }
            expiryRefreshRef.current = '';
            setMessage(createJson.data.mode === 'duel'
                ? translateUiTemplate('New challenge started with {{0}}!', [partnerName])
                : translateUiText('New puzzle ready!'));
            triggerHaptic('notificationSuccess');
        } catch (error) {
            if (abandonedCurrentGame) setGame(null);
            setMessage(error.message || translateUiText('Could not start a new puzzle.'));
        } finally {
            startingNewPuzzleRef.current = false;
            setSubmitting(false);
        }
    }, [applyGamePayload, game?.status, gameId, partnerId, partnerName, partnerOnline, requestPuzzle, userId]);

    const startNewPuzzle = useCallback((targetDifficulty = difficulty, targetMode = nextPuzzleMode) => {
        if (submitting || startingNewPuzzleRef.current) {
            closeSettings();
            return;
        }
        if (partnerId && !presenceKnown) {
            closeSettings();
            setMessage(translateUiText('Checking whether your partner is online…'));
            return;
        }
        if (game?.status === 'active' && game?.mode === 'duel') {
            setPendingNewPuzzle({ targetDifficulty, targetMode });
            openEndChallengeAfterSettingsRef.current = true;
            closeSettings();
        } else {
            closeSettings();
            executeNewPuzzle(targetDifficulty, targetMode);
        }
    }, [closeSettings, difficulty, executeNewPuzzle, game?.mode, game?.status, nextPuzzleMode, partnerId, presenceKnown, submitting]);

    const cancelNewPuzzle = useCallback(() => {
        openEndChallengeAfterSettingsRef.current = false;
        setPendingNewPuzzle(null);
        endChallengeSheetRef.current?.dismiss();
    }, []);
    const confirmNewPuzzle = useCallback(() => {
        if (!pendingNewPuzzle || submitting || startingNewPuzzleRef.current) return;
        const { targetDifficulty, targetMode } = pendingNewPuzzle;
        setPendingNewPuzzle(null);
        endChallengeSheetRef.current?.dismiss();
        executeNewPuzzle(targetDifficulty, targetMode);
    }, [executeNewPuzzle, pendingNewPuzzle, submitting]);


    const boardSize = Math.min(width - 24, 430);
    const cellSize = game ? Math.floor((boardSize - 12) / game.gridSize) : 0;
    const completedTitle = game?.isDraw
        ? 'It’s a draw!'
        : idOf(game?.winner) === userId
            ? 'You won! 🎉'
            : game?.mode === 'single'
                ? 'Puzzle complete! 🎉'
                : `${partnerName} won!`;
    const timerUrgent = secondsRemaining <= 10;
    const timerProgress = Math.max(0, Math.min(100, (secondsRemaining / turnDurationSeconds) * 100));
    const formattedTimer = `0:${String(secondsRemaining).padStart(2, '0')}`;

    if (loading) {
        return (
            <LinearGradient colors={['#F5E8FF', '#FFF9FC']} style={styles.flexCenter}>
                <ActivityIndicator size="large" color="#7B56D8" />
                <Text style={styles.loadingText}>Looking for an active game…</Text>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#F2E7FF', '#FFF8FC', '#E8F7F4']} style={styles.screen}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={[styles.header, { paddingTop: insets.top + 3 }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={navigation?.goBack}
                        accessibilityLabel={translateUiText('Back')}
                        hitSlop={6}
                    >
                        <ChevronLeft size={24} color="#33234A" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{translateUiText('Word Search')}</Text>
                </View>
                <View style={styles.headerRight}>
                    {partnerId ? (
                        <TouchableOpacity
                            style={[
                                styles.headerPresenceChip,
                                partnerOnline ? styles.headerPresenceChipOnline : styles.headerPresenceChipOffline,
                            ]}
                            onPress={!partnerOnline ? handleNudgePartner : undefined}
                            disabled={partnerOnline || nudgeSent}
                            activeOpacity={partnerOnline ? 1 : 0.7}
                            hitSlop={4}
                            accessibilityLabel={partnerOnline
                                ? translateUiTemplate('{{0}} is online', [partnerName])
                                : translateUiTemplate(nudgeSent ? '{{0}} is offline, nudge sent' : '{{0}} is offline, tap to nudge', [partnerName])}
                        >
                            <View style={[
                                styles.headerPresenceDot,
                                partnerOnline ? styles.partnerStatusOnline : styles.partnerStatusOffline,
                            ]} />
                            <Text style={[
                                styles.headerPresenceText,
                                partnerOnline ? styles.headerPresenceTextOnline : styles.headerPresenceTextOffline,
                            ]}>
                                {partnerOnline ? translateUiText('Online') : (nudgeSent ? translateUiText('Nudged') : translateUiText('Offline'))}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        style={styles.headerMenuButton}
                        onPress={openSettings}
                        accessibilityLabel={translateUiText('Game options')}
                        hitSlop={8}
                    >
                        <MoreVertical size={22} color="#33234A" />
                    </TouchableOpacity>
                </View>
            </View>

            {!game ? (
                <View style={styles.preparingGame}>
                    {partnerId && (
                        <View style={styles.compactStatusChip}>
                            <View style={[
                                styles.livePresenceDot,
                                canPlayTogether ? styles.partnerStatusOnline : styles.partnerStatusOffline,
                            ]} />
                            <Text style={styles.compactStatusText}>
                                {!presenceKnown
                                    ? `Checking ${partnerName}…`
                                    : canPlayTogether ? `${partnerName} online` : `${partnerName} offline`}
                            </Text>
                        </View>
                    )}
                    {submitting || (partnerId && !presenceKnown) || !autoStartRef.current ? (
                        <ActivityIndicator size="large" color="#7B56D8" />
                    ) : (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => {
                                autoStartRef.current = true;
                                createGame();
                            }}
                        >
                            <Text style={styles.retryButtonText}>Try again</Text>
                        </TouchableOpacity>
                    )}
                    <Text style={styles.preparingText}>
                        {submitting
                            ? (canPlayTogether ? `Starting with ${partnerName}…` : 'Starting game…')
                            : message || 'Preparing game…'}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={[styles.gameContent, { paddingBottom: insets.bottom + 28 }]}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.scoreCard}>
                        <View style={styles.scoreSide}>
                            <Text style={styles.scoreName}>YOU</Text>
                            <Text style={styles.scoreNumber}>{myScore}</Text>
                            <Text style={styles.scoreUnit}>words</Text>
                        </View>
                        <View style={styles.scoreCenter}>
                            <Text style={styles.wordsLeft}>{Math.max(0, game.totalWords - game.foundCount)}</Text>
                            <Text style={styles.wordsLeftLabel}>LEFT</Text>
                        </View>
                        <View style={styles.scoreSide}>
                            <Text style={styles.scoreName}>{game.mode === 'single' ? 'TOTAL' : partnerName.toUpperCase()}</Text>
                            <Text style={styles.scoreNumber}>{game.mode === 'single' ? game.totalWords : theirScore}</Text>
                            <Text style={styles.scoreUnit}>words</Text>
                        </View>
                    </View>

                    {game.mode === 'duel' && game.status === 'active' ? (
                        <View style={[
                            styles.turnCard,
                            myTurn ? styles.myTurnCard : styles.partnerTurnCard,
                            timerUrgent && styles.urgentTurnCard,
                        ]}>
                            <View style={styles.turnCopy}>
                                <Text style={styles.turnEyebrow}>
                                    {myTurn ? 'YOUR 45-SECOND TURN' : `${partnerName.toUpperCase()}’S TURN`}
                                </Text>
                                <Text style={styles.turnHeadline}>
                                    {myTurn ? 'Find as many as you can' : `${partnerName} is searching`}
                                </Text>
                            </View>
                            <View style={[styles.timerBadge, timerUrgent && styles.timerBadgeUrgent]}>
                                <Timer size={15} color={timerUrgent ? '#D94D62' : (myTurn ? '#218F7D' : '#7550BF')} />
                                <Text
                                    style={[styles.timerText, timerUrgent && styles.timerTextUrgent]}
                                    accessibilityLabel={`${secondsRemaining} seconds remaining`}
                                    accessibilityLiveRegion="polite"
                                >
                                    {formattedTimer}
                                </Text>
                            </View>
                            <View style={styles.timerTrack}>
                                <View style={[
                                    styles.timerFill,
                                    { width: `${timerProgress}%` },
                                    !myTurn && styles.partnerTimerFill,
                                    timerUrgent && styles.timerFillUrgent,
                                ]} />
                            </View>
                        </View>
                    ) : (
                        <View style={[styles.turnPill, styles.myTurnPill]}>
                            <View style={[styles.turnDot, styles.myTurnDot]} />
                            <Text style={styles.turnText}>{game.status === 'completed' ? completedTitle : 'Keep searching'}</Text>
                        </View>
                    )}

                    {partnerId && game.status === 'active' && (
                        <View style={styles.livePresenceRow}>
                            <View style={styles.livePresenceLabel}>
                                <View style={[
                                    styles.livePresenceDot,
                                    partnerOnline ? styles.partnerStatusOnline : styles.partnerStatusOffline,
                                ]} />
                                <Text style={styles.livePresenceText}>
                                    {partnerOnline ? `${partnerName} online` : `${partnerName} offline`}
                                </Text>
                            </View>
                            {!partnerOnline && (
                                <TouchableOpacity
                                    style={styles.inlineNudgeButton}
                                    onPress={handleNudgePartner}
                                    disabled={nudgeSent}
                                >
                                    <Bell size={13} color={nudgeSent ? '#69A99B' : '#7653C9'} />
                                    <Text style={[
                                        styles.inlineNudgeText,
                                        nudgeSent && styles.inlineNudgeTextSent,
                                    ]}>
                                        {nudgeSent ? 'Sent' : 'Nudge'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <WordSearchBoard
                        key={gameId}
                        game={game}
                        cellSize={cellSize}
                        userId={userId}
                        canInteractWithBoard={canInteractWithBoard}
                        submitting={submitting}
                        myTurn={myTurn}
                        message={message}
                        turnCountdown={myTurn ? null : formattedTimer}
                        onSubmitSelection={submitSelection}
                        onMessage={setMessage}
                    />

                    <View style={styles.wordPanel}>
                        <View style={styles.wordPanelHeader}>
                            <Text style={styles.wordPanelTitle}>WORDS</Text>
                            <Text style={styles.wordProgress}>{game.foundCount}/{game.totalWords} found</Text>
                        </View>
                        <View style={styles.wordList}>
                            {game.words.map(item => (
                                <View key={item.word} style={[styles.wordChip, item.foundBy && styles.wordChipFound]}>
                                    <Text style={[styles.wordText, item.foundBy && styles.wordTextFound]}>{item.word}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {game.status === 'completed' && (
                        <View style={styles.completeCard}>
                            <Text style={styles.completeTitle}>{completedTitle}</Text>
                            <Text style={styles.completeSubtitle}>
                                {game.mode === 'duel' ? `Final score ${myScore}–${theirScore}` : `You found all ${game.totalWords} words.`}
                            </Text>
                            {game.mode === 'single' ? (
                                <TouchableOpacity
                                    style={styles.playAgainButton}
                                    onPress={() => {
                                        autoStartRef.current = false;
                                        setGame(null);
                                        setMessage('');
                                    }}
                                >
                                    <Text style={styles.playAgainText}>Play again</Text>
                                </TouchableOpacity>
                            ) : (
                                <Text style={styles.autoRematchText}>Rematch starting automatically…</Text>
                            )}
                        </View>
                    )}
                </ScrollView>
            )}

            {rematchCountdownLabel && (
                <View style={styles.rematchOverlay} pointerEvents="auto">
                    <Text style={styles.rematchEyebrow}>REMATCH</Text>
                    <Text style={[
                        styles.rematchCountdown,
                        rematchCountdownLabel === 'GO!' && styles.rematchGo,
                    ]}>
                        {rematchCountdownLabel}
                    </Text>
                    <Text style={styles.rematchSubtitle}>
                        {rematchCountdownLabel === 'GO!' ? 'Find as many as you can!' : 'Get ready'}
                    </Text>
                </View>
            )}

            <View style={styles.confettiLayer} pointerEvents="none">
                <ConfettiCannon
                    ref={confettiRef}
                    count={120}
                    origin={{ x: width / 2, y: -20 }}
                    explosionSpeed={380}
                    fallSpeed={2800}
                    fadeOut
                    autoStart={false}
                />
            </View>

            <BottomSheetModal
                ref={settingsBottomSheetRef}
                enableDynamicSizing
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                backgroundStyle={styles.settingsSheetBackground}
                handleIndicatorStyle={styles.settingsHandleIndicator}
                onDismiss={handleSettingsDismiss}
            >
                <BottomSheetView style={[styles.settingsSheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
                    <View style={styles.settingsHeader}>
                        <Text style={styles.settingsTitle}>{translateUiText('Game Options')}</Text>
                        <TouchableOpacity
                            style={styles.settingsClose}
                            onPress={closeSettings}
                            hitSlop={8}
                            accessibilityLabel={translateUiText('Close')}
                        >
                            <X size={18} color="#4A385B" />
                        </TouchableOpacity>
                    </View>

                    {partnerId && (
                        <View style={styles.settingsSection}>
                            <Text style={styles.settingsSectionTitle}>{translateUiText('GAME MODE')}</Text>
                            <View style={styles.modeCardsRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.modeCard,
                                        gameMode === 'single' && styles.modeCardSelected,
                                    ]}
                                    onPress={() => {
                                        setUserSelectedMode('single');
                                        storage.set('wordsearch_mode', 'single');
                                        triggerHaptic('selection');
                                    }}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: gameMode === 'single' }}
                                >
                                    <View style={[styles.modeCardIcon, gameMode === 'single' && styles.modeCardIconSelected]}>
                                        <User size={15} color={gameMode === 'single' ? '#7048C6' : '#7D6F86'} />
                                    </View>
                                    <Text style={[styles.modeCardTitle, gameMode === 'single' && styles.modeCardTitleSelected]}>
                                        {translateUiText('Solo')}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.modeCard,
                                        gameMode === 'duel' && styles.modeCardSelected,
                                    ]}
                                    onPress={() => {
                                        setUserSelectedMode('duel');
                                        storage.set('wordsearch_mode', 'duel');
                                        triggerHaptic('selection');
                                    }}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: gameMode === 'duel' }}
                                >
                                    <View style={[styles.modeCardIcon, gameMode === 'duel' && styles.modeCardIconSelected]}>
                                        <Swords size={15} color={gameMode === 'duel' ? '#7048C6' : '#7D6F86'} />
                                    </View>
                                    <Text style={[styles.modeCardTitle, gameMode === 'duel' && styles.modeCardTitleSelected]}>
                                        {translateUiText('Duel')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View
                                accessibilityElementsHidden={!showOfflineNote}
                                importantForAccessibility={showOfflineNote ? 'auto' : 'no-hide-descendants'}
                            >
                                <Text style={[styles.offlineNote, !showOfflineNote && styles.offlineNoteHidden]}>
                                    {translateUiText('Partner is offline, so the next puzzle will be solo.')}
                                </Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.settingsSection}>
                        <Text style={styles.settingsSectionTitle}>{translateUiText('GRID SIZE & DIFFICULTY')}</Text>
                        <View style={styles.difficultyCardsRow}>
                            {DIFFICULTY_OPTIONS.map(option => {
                                const selected = difficulty === option.id;
                                return (
                                    <TouchableOpacity
                                        key={option.id}
                                        style={[
                                            styles.difficultyCard,
                                            selected && styles.difficultyCardSelected,
                                        ]}
                                        onPress={() => {
                                            setDifficulty(option.id);
                                            storage.set('wordsearch_difficulty', option.id);
                                            triggerHaptic('selection');
                                        }}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected }}
                                    >
                                        <Text style={[styles.difficultyCardTitle, selected && styles.difficultyCardTitleSelected]}>
                                            {translateUiText(option.title)}
                                        </Text>
                                        <Text style={[styles.difficultyGridSize, selected && styles.difficultyGridSizeSelected]}>
                                            {option.gridSize}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.actionContainer}>
                        <TouchableOpacity
                            style={styles.startNewButton}
                            onPress={() => startNewPuzzle(difficulty, nextPuzzleMode)}
                            activeOpacity={0.82}
                        >
                            <RotateCcw size={16} color="#FFFFFF" strokeWidth={2.4} />
                            <Text style={styles.startNewButtonText}>
                                {game?.status === 'active' ? translateUiText('Start Fresh Puzzle') : translateUiText('Create Puzzle')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </BottomSheetView>
            </BottomSheetModal>

            <BottomSheetModal
                ref={endChallengeSheetRef}
                enableDynamicSizing
                enablePanDownToClose
                backdropComponent={renderBackdrop}
                backgroundStyle={styles.endChallengeSheetBackground}
                handleIndicatorStyle={styles.settingsHandleIndicator}
                onDismiss={() => setPendingNewPuzzle(null)}
            >
                <BottomSheetView
                    style={[styles.endChallengeSheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
                    testID="end-challenge-sheet"
                >
                    <LinearGradient
                        colors={['#F1E8FF', '#FFF0F7', '#FFF9FD']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.endChallengeHeader}
                    >
                        <View style={styles.endChallengeTopRow}>
                            <View style={styles.endChallengeIcon}>
                                <Swords size={25} color="#7547C3" strokeWidth={2.2} />
                            </View>
                            <TouchableOpacity
                                style={styles.endChallengeClose}
                                onPress={cancelNewPuzzle}
                                accessibilityRole="button"
                                accessibilityLabel={translateUiText('Keep playing')}
                                hitSlop={8}
                            >
                                <X size={18} color="#735B7D" />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.endChallengeEyebrow}>{translateUiText('Duel Challenge')}</Text>
                        <Text style={styles.endChallengeTitle} accessibilityRole="header">
                            {translateUiText('End current challenge?')}
                        </Text>
                    </LinearGradient>

                    <View style={styles.endChallengeContent}>
                        <View style={styles.endChallengeNotice}>
                            <View style={styles.endChallengeNoticeMark} />
                            <Text style={styles.endChallengeMessage}>
                                {translateUiTemplate(
                                    'This will forfeit the current duel with {{0}} and start a fresh board.',
                                    [partnerName],
                                )}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.endChallengeKeepButton}
                            onPress={cancelNewPuzzle}
                            activeOpacity={0.82}
                            accessibilityRole="button"
                        >
                            <Text style={styles.endChallengeKeepText}>{translateUiText('Keep playing')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.endChallengeStartButton}
                            onPress={confirmNewPuzzle}
                            activeOpacity={0.82}
                            accessibilityRole="button"
                            disabled={submitting}
                        >
                            <LinearGradient
                                colors={['#E87798', '#D8587E']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.endChallengeStartGradient}
                            >
                                <RotateCcw size={16} color="#FFFFFF" strokeWidth={2.4} />
                                <Text style={styles.endChallengeStartText}>{translateUiText('Start new')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </BottomSheetView>
            </BottomSheetModal>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1 },
    endChallengeSheetBackground: {
        backgroundColor: '#FFF9FD',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    endChallengeSheet: {
        paddingTop: 4,
        overflow: 'hidden',
    },
    endChallengeHeader: {
        paddingHorizontal: 23,
        paddingTop: 22,
        paddingBottom: 23,
    },
    endChallengeTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    endChallengeIcon: {
        width: 56,
        height: 56,
        borderRadius: 19,
        backgroundColor: '#E5D7FC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#D6C1F5',
    },
    endChallengeClose: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    endChallengeEyebrow: {
        fontFamily: fontFamily.extraBold,
        fontSize: 10,
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        color: '#946FB4',
    },
    endChallengeTitle: {
        marginTop: 6,
        fontFamily: fontFamily.extraBold,
        fontSize: 24,
        lineHeight: 29,
        color: '#352448',
    },
    endChallengeContent: {
        paddingHorizontal: 22,
        paddingTop: 20,
        paddingBottom: 22,
    },
    endChallengeNotice: {
        flexDirection: 'row',
        gap: 11,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#F3DEE5',
        backgroundColor: '#FFF3F6',
        marginBottom: 18,
    },
    endChallengeNoticeMark: {
        width: 4,
        borderRadius: 2,
        backgroundColor: '#DF7895',
    },
    endChallengeMessage: {
        flex: 1,
        fontFamily: fontFamily.medium,
        fontSize: 13,
        lineHeight: 19,
        color: '#705C70',
    },
    endChallengeKeepButton: {
        minHeight: 49,
        borderRadius: 16,
        backgroundColor: '#F0E8FB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    endChallengeKeepText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 14,
        color: '#6D49B7',
    },
    endChallengeStartButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    endChallengeStartGradient: {
        minHeight: 51,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    endChallengeStartText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 14,
        color: '#FFFFFF',
    },
    flexCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
    loadingText: { fontFamily: fontFamily.medium, color: '#6E6178' },
    header: { paddingHorizontal: 12, paddingBottom: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontFamily: fontFamily.extraBold, fontSize: 19, color: '#302244' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerPresenceChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4.5, borderRadius: 12 },
    headerPresenceChipOnline: { backgroundColor: 'rgba(69, 190, 130, 0.14)' },
    headerPresenceChipOffline: { backgroundColor: 'rgba(156, 142, 166, 0.14)' },
    headerPresenceDot: { width: 7, height: 7, borderRadius: 3.5 },
    headerPresenceText: { fontFamily: fontFamily.bold, fontSize: 11, letterSpacing: 0.2 },
    headerPresenceTextOnline: { color: '#1E8E5A' },
    headerPresenceTextOffline: { color: '#76677C' },
    headerMenuButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    preparingGame: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 74, paddingHorizontal: 20 },
    compactStatusChip: { minHeight: 31, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.84)', flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 30 },
    compactStatusText: { fontFamily: fontFamily.bold, fontSize: 11, color: '#75687D' },
    preparingText: { marginTop: 13, fontFamily: fontFamily.medium, fontSize: 12, color: '#817487', textAlign: 'center' },
    retryButton: { minHeight: 44, paddingHorizontal: 22, borderRadius: 15, backgroundColor: '#8058D4', alignItems: 'center', justifyContent: 'center' },
    retryButtonText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: '#FFFFFF' },
    quickStartContent: { paddingHorizontal: 18, paddingTop: 18, alignItems: 'center' },
    partnerCard: { width: '100%', maxWidth: 430, minHeight: 116, padding: 18, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.96)', flexDirection: 'row', alignItems: 'center', shadowColor: '#7A5A88', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.11, shadowRadius: 16, elevation: 0 },
    partnerAvatar: { width: 62, height: 62, borderRadius: 21, backgroundColor: '#875FDB', alignItems: 'center', justifyContent: 'center' },
    partnerStatusDot: { position: 'absolute', right: -2, bottom: -2, width: 17, height: 17, borderRadius: 9, borderWidth: 3, borderColor: '#FFFFFF' },
    partnerStatusOnline: { backgroundColor: '#45BE82' },
    partnerStatusOffline: { backgroundColor: '#AAA0AC' },
    partnerCopy: { flex: 1, paddingLeft: 15 },
    partnerEyebrow: { fontFamily: fontFamily.extraBold, fontSize: 9.5, letterSpacing: 1, color: '#8A7893', marginBottom: 4 },
    partnerTitle: { fontFamily: fontFamily.extraBold, fontSize: 19, color: '#38284B' },
    partnerSubtitle: { fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 17, color: '#8B7E92', marginTop: 4 },
    currentSettingsRow: { width: '100%', maxWidth: 430, marginTop: 14, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    currentSettingsText: { fontFamily: fontFamily.bold, fontSize: 11.5, color: '#75677E' },
    changeSettingsText: { fontFamily: fontFamily.extraBold, fontSize: 11.5, color: '#7653C9' },
    quickStartButton: { width: '100%', maxWidth: 430, marginTop: 18, borderRadius: 19, overflow: 'hidden' },
    quickStartButtonDisabled: { opacity: 0.62 },
    quickStartGradient: { minHeight: 58, paddingHorizontal: 20, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
    quickStartText: { fontFamily: fontFamily.extraBold, color: '#FFFFFF', fontSize: 16 },
    nudgeButton: { width: '100%', maxWidth: 430, minHeight: 52, marginTop: 11, borderRadius: 17, borderWidth: 1.5, borderColor: '#CDB9F2', backgroundColor: 'rgba(255,255,255,0.76)', flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
    nudgeButtonSent: { borderColor: '#B8DDD5', backgroundColor: '#EFFAF7' },
    nudgeButtonText: { fontFamily: fontFamily.extraBold, fontSize: 13.5, color: '#704EBA' },
    nudgeButtonTextSent: { color: '#4D9B8B' },
    quickStartMessage: { minHeight: 22, marginTop: 14, fontFamily: fontFamily.medium, fontSize: 12, color: '#7653C9', textAlign: 'center' },
    settingsSheetBackground: {
        backgroundColor: '#FFF9FE',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    settingsHandleIndicator: {
        backgroundColor: '#D7C8E2',
        width: 38,
        height: 4,
        borderRadius: 2,
    },
    settingsSheet: {
        paddingHorizontal: 20,
        paddingTop: 4,
    },
    settingsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    settingsTitle: {
        flex: 1,
        fontFamily: fontFamily.extraBold,
        fontSize: 21,
        color: '#342347',
    },
    settingsClose: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F3EAF7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsSection: {
        marginBottom: 16,
    },
    settingsSectionTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 9.5,
        letterSpacing: 0.9,
        color: '#8F7B9D',
        marginBottom: 8,
    },
    modeCardsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    modeCard: {
        flex: 1,
        minHeight: 52,
        paddingHorizontal: 9,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#EEE5F2',
    },
    modeCardSelected: {
        borderColor: '#7F54DB',
        backgroundColor: '#F8F2FE',
    },
    modeCardIcon: {
        width: 27,
        height: 27,
        borderRadius: 8,
        backgroundColor: '#F3ECF8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modeCardIconSelected: {
        backgroundColor: '#EBE0FA',
    },
    modeCardTitle: {
        flex: 1,
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
        color: '#463554',
    },
    modeCardTitleSelected: {
        color: '#6438BA',
    },
    offlineNote: {
        fontFamily: fontFamily.medium,
        fontSize: 11,
        color: '#806993',
        marginTop: 7,
    },
    offlineNoteHidden: {
        opacity: 0,
    },
    difficultyCardsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    difficultyCard: {
        flex: 1,
        minHeight: 61,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#EEE5F2',
        alignItems: 'center',
    },
    difficultyCardSelected: {
        borderColor: '#7F54DB',
        backgroundColor: '#F8F2FE',
    },
    difficultyCardTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 12.5,
        color: '#463554',
    },
    difficultyCardTitleSelected: {
        color: '#6438BA',
    },
    difficultyGridSize: {
        fontFamily: fontFamily.bold,
        fontSize: 11,
        color: '#766286',
        marginTop: 2,
    },
    difficultyGridSizeSelected: {
        color: '#7A4ED4',
    },
    actionContainer: {
        marginTop: 2,
        width: '100%',
        alignItems: 'center',
    },
    startNewButton: {
        width: '100%',
        minHeight: 50,
        borderRadius: 18,
        backgroundColor: '#8058D4',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    startNewButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 15,
        color: '#FFFFFF',
    },
    gameContent: { alignItems: 'center', paddingTop: 1 },
    scoreCard: { width: '92%', maxWidth: 430, height: 60, borderRadius: 17, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,0.86)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    scoreSide: { width: '32%', alignItems: 'center' },
    scoreName: { fontFamily: fontFamily.extraBold, fontSize: 9, color: '#887B91', letterSpacing: 0.6 },
    scoreNumber: { fontFamily: fontFamily.extraBold, fontSize: 21, lineHeight: 23, color: '#3D2B52' },
    scoreUnit: { fontFamily: fontFamily.medium, fontSize: 8, color: '#A397AA' },
    scoreCenter: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1E9FF', alignItems: 'center', justifyContent: 'center' },
    wordsLeft: { fontFamily: fontFamily.extraBold, fontSize: 15, color: '#7952CF', lineHeight: 17 },
    wordsLeftLabel: { fontFamily: fontFamily.extraBold, fontSize: 7, color: '#9A83C9', letterSpacing: 0.8 },
    turnCard: { width: '92%', maxWidth: 430, height: 58, marginTop: 7, paddingHorizontal: 13, paddingTop: 7, paddingBottom: 9, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
    myTurnCard: { backgroundColor: '#E8F8F4', borderColor: '#BDE9DF' },
    partnerTurnCard: { backgroundColor: '#F2EBFC', borderColor: '#DDCCF4' },
    urgentTurnCard: { backgroundColor: '#FFF0F2', borderColor: '#F4BCC5' },
    turnCopy: { flex: 1, paddingRight: 8 },
    turnEyebrow: { fontFamily: fontFamily.extraBold, fontSize: 8, letterSpacing: 0.7, color: '#7D7184' },
    turnHeadline: { marginTop: 1, fontFamily: fontFamily.extraBold, fontSize: 12.5, color: '#3D3048' },
    timerBadge: { minWidth: 68, height: 33, paddingHorizontal: 8, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.84)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    timerBadgeUrgent: { backgroundColor: '#FFFFFF' },
    timerText: { fontFamily: fontFamily.extraBold, fontSize: 15, color: '#3D3048', fontVariant: ['tabular-nums'] },
    timerTextUrgent: { color: '#D94D62' },
    timerTrack: { position: 'absolute', left: 13, right: 13, bottom: 5, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(86,65,100,0.10)', overflow: 'hidden' },
    timerFill: { height: '100%', borderRadius: 2, backgroundColor: '#42BBA5' },
    partnerTimerFill: { backgroundColor: '#9066D3' },
    timerFillUrgent: { backgroundColor: '#E45B70' },
    turnPill: { marginTop: 10, paddingHorizontal: 13, minHeight: 31, borderRadius: 16, flexDirection: 'row', gap: 7, alignItems: 'center' },
    myTurnPill: { backgroundColor: '#E2F7F2' },
    partnerTurnPill: { backgroundColor: '#F0E7FD' },
    turnDot: { width: 7, height: 7, borderRadius: 4 },
    myTurnDot: { backgroundColor: '#31A994' },
    partnerTurnDot: { backgroundColor: '#8B62D9' },
    turnText: { fontFamily: fontFamily.bold, fontSize: 11.5, color: '#554A5D' },
    livePresenceRow: { width: '92%', maxWidth: 430, minHeight: 27, marginTop: 4, paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    livePresenceLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    livePresenceDot: { width: 8, height: 8, borderRadius: 4 },
    livePresenceText: { fontFamily: fontFamily.bold, fontSize: 10.5, color: '#817486' },
    inlineNudgeButton: { minHeight: 28, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0E7FC' },
    inlineNudgeText: { fontFamily: fontFamily.extraBold, fontSize: 10.5, color: '#704EBA' },
    inlineNudgeTextSent: { color: '#5A9C8E' },
    board: { marginTop: 8, padding: 6, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.93)', shadowColor: '#7A5A88', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.13, shadowRadius: 13, elevation: 0 },
    boardLocked: { opacity: 0.72 },
    boardRow: { flexDirection: 'row', zIndex: 2 },
    cell: { alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
    wordLine: { position: 'absolute', zIndex: 1, borderWidth: 1.5 },
    dragWordLine: {
        backgroundColor: 'rgba(247, 196, 69, 0.46)',
        borderColor: '#E7A91D',
        shadowColor: '#D89A0A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    detectedWordLine: {
        backgroundColor: 'rgba(92, 211, 190, 0.40)',
        borderColor: '#42BBA5',
        shadowColor: '#319E8B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.18,
        shadowRadius: 3,
    },
    myWordLine: { backgroundColor: 'rgba(92, 211, 190, 0.40)', borderColor: '#42BBA5' },
    partnerWordLine: { backgroundColor: 'rgba(176, 137, 235, 0.36)', borderColor: '#9368D2' },
    letter: { fontFamily: fontFamily.extraBold, color: '#3B2D48' },
    instruction: { minHeight: 34, marginTop: 11, fontFamily: fontFamily.bold, fontSize: 11.5, color: '#756A7C', textAlign: 'center', paddingHorizontal: 22 },
    wordPanel: { width: '92%', maxWidth: 430, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.78)', padding: 14, marginTop: 2 },
    wordPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    wordPanelTitle: { fontFamily: fontFamily.extraBold, fontSize: 11, color: '#5A4D63', letterSpacing: 1 },
    wordProgress: { fontFamily: fontFamily.bold, fontSize: 10.5, color: '#8D7A98' },
    wordList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    wordChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F0E9F5' },
    wordChipFound: { backgroundColor: '#D9F2EC' },
    wordText: { fontFamily: fontFamily.bold, fontSize: 11, color: '#594B63', letterSpacing: 0.5 },
    wordTextFound: { color: '#7AA49B', textDecorationLine: 'line-through' },
    completeCard: { width: '92%', maxWidth: 430, marginTop: 14, borderRadius: 20, padding: 18, backgroundColor: '#49305E', alignItems: 'center' },
    completeTitle: { fontFamily: fontFamily.extraBold, fontSize: 23, color: '#FFFFFF' },
    completeSubtitle: { fontFamily: fontFamily.medium, fontSize: 12, color: '#E9DFF0', marginTop: 5 },
    autoRematchText: { marginTop: 13, fontFamily: fontFamily.extraBold, fontSize: 12, color: '#EADFF1' },
    playAgainButton: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 11, marginTop: 14 },
    playAgainText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: '#684887' },
    rematchOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: 'rgba(42, 27, 58, 0.86)', alignItems: 'center', justifyContent: 'center' },
    rematchEyebrow: { fontFamily: fontFamily.extraBold, fontSize: 16, letterSpacing: 4, color: '#D9C6F8' },
    rematchCountdown: { marginTop: 8, fontFamily: fontFamily.extraBold, fontSize: 112, lineHeight: 126, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
    rematchGo: { fontSize: 76, lineHeight: 100, color: '#73E4CE' },
    rematchSubtitle: { marginTop: 4, fontFamily: fontFamily.bold, fontSize: 15, color: '#F1E9F7' },
    confettiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 60 },
});

export { WordSearchBoard };
export default WordSearchScreen;
