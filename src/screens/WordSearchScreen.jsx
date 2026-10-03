import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AccessibilityInfo,
    AppState,
    Image,
    Platform,
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
import { Bell, Check, ChevronLeft, MoreVertical, RotateCcw, Swords, Timer, User, X } from 'lucide-react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { fontFamily } from '../constants/fonts';
import { useSocketContext } from '../context/SocketContext';
import usePresence from '../hooks/usePresence';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import { WORD_SEARCH_API, wordSearchFetch } from '../utils/wordSearchApi';
import { getUser, storage } from '../utils/authStorage';
import { createSafeAudioPlayer } from '../utils/safeAudioPlayer';
import { checkWordSearchSelection, isPlayableWordSearchGame, normalizeWordSearchGame, shouldApplyWordSearchGame, wordSearchId } from '../utils/wordSearchState';

const triggerHaptic = (type = 'selection') => {
    try {
        ReactNativeHapticFeedback.trigger(type, {
            enableVibrateFallback: type === 'notificationError',
            ignoreAndroidSystemSettings: false,
        });
    } catch (_) {}
};

// The default iOS selection pulse is too faint during a continuous drag.
const triggerBoardHaptic = () => triggerHaptic(Platform.OS === 'ios' ? 'impactMedium' : 'selection');

const DIFFICULTY_OPTIONS = [
    { id: 'easy', title: 'Easy', gridSize: '8 × 8' },
    { id: 'medium', title: 'Medium', gridSize: '10 × 10' },
    { id: 'hard', title: 'Hard', gridSize: '12 × 12' },
];

const TURN_DURATION_SECONDS = 45;
const SELECTION_HAPTIC_INTERVAL_MS = 45;
const PRESENCE_WAIT_MS = 3000;
const REQUEST_TIMEOUT_MS = 10000;
const ERROR_NOTICE_MS = 3500;
const NEW_GAME_NOTICE_MS = 4000;

const idOf = wordSearchId;

const requestWordSearch = async (url, options = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await wordSearchFetch(url, { ...options, signal: controller.signal });
        const json = await response.json();
        return { response, json };
    } catch (error) {
        if (error.name === 'AbortError') throw new Error(translateUiText('Could not connect to server'));
        throw error;
    } finally {
        clearTimeout(timeout);
    }
};

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

const isPlayableGamePayload = isPlayableWordSearchGame;

// Letters stay static while the selection preview moves on the UI thread.
const WordSearchCell = React.memo(({ letter, cellSize, row, col, screenReaderEnabled, selected, disabled, onPress }) => {
    const Container = screenReaderEnabled ? TouchableOpacity : View;
    return (
        <Container
            style={[styles.cell, { width: cellSize, height: cellSize }, selected && styles.accessibleSelectedCell]}
            {...(screenReaderEnabled ? {
                onPress,
                disabled,
                accessibilityRole: 'button',
                accessibilityLabel: translateUiTemplate('{{0}}, row {{1}}, column {{2}}', [letter, row + 1, col + 1]),
                accessibilityState: { selected, disabled },
            } : {})}
        >
            <Text style={[
                styles.letter,
                { fontSize: Math.max(12, cellSize * 0.48) },
            ]}>{letter}</Text>
        </Container>
    );
});

const WordSearchBoard = React.memo(({
    game,
    cellSize,
    userId,
    canInteractWithBoard,
    submitting,
    onSubmitSelection,
    onMessage,
}) => {
    const grid = game.grid;
    const gridSize = game.gridSize;
    const drag = useSharedValue(EMPTY_DRAG);
    const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
    const [accessibleStart, setAccessibleStart] = useState(null);
    const interactionAllowedRef = useRef(false);
    interactionAllowedRef.current = canInteractWithBoard && !submitting;
    const boardLocked = game.status === 'active' && !canInteractWithBoard;

    useEffect(() => {
        let active = true;
        AccessibilityInfo.isScreenReaderEnabled().then(enabled => {
            if (active) setScreenReaderEnabled(enabled);
        }).catch(() => {});
        const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReaderEnabled);
        return () => {
            active = false;
            subscription.remove();
        };
    }, []);
    const availableWords = useMemo(() => game.words
        .filter(word => !word.foundBy)
        .map(word => word.word), [game.words]);

    const clearDrag = useCallback(() => {
        drag.value = EMPTY_DRAG;
    }, [drag]);

    const finishWordDrag = useCallback((startRow, startCol, endRow, endCol) => {
        if (!interactionAllowedRef.current) {
            clearDrag();
            return;
        }
        const start = { row: startRow, col: startCol };
        const end = { row: endRow, col: endCol };
        if (lineCoordinates(start, end).length < 3) {
            clearDrag();
            triggerHaptic('notificationError');
            onMessage(translateUiText('Touch a letter, drag across the whole word, then release.'));
            return;
        }
        Promise.resolve(onSubmitSelection(start, end)).finally(clearDrag);
    }, [clearDrag, onMessage, onSubmitSelection]);

    const activateCell = useCallback((row, col) => {
        if (!canInteractWithBoard || submitting) return;
        if (!accessibleStart) {
            setAccessibleStart({ row, col });
            const hint = translateUiText('Now choose the last letter.');
            AccessibilityInfo.announceForAccessibility(hint);
            return;
        }
        const start = accessibleStart;
        setAccessibleStart(null);
        if (lineCoordinates(start, { row, col }).length < 3) {
            triggerHaptic('notificationError');
            const hint = translateUiTemplate('Choose a straight or diagonal line of at least {{0}} letters.', [3]);
            onMessage(hint);
            AccessibilityInfo.announceForAccessibility(hint);
            return;
        }
        finishWordDrag(start.row, start.col, row, col);
    }, [accessibleStart, canInteractWithBoard, finishWordDrag, onMessage, submitting]);

    const gesture = useMemo(() => Gesture.Pan()
        .enabled(canInteractWithBoard && !submitting && !screenReaderEnabled)
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
            scheduleOnRN(triggerBoardHaptic);
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
            if (shouldTick) scheduleOnRN(triggerBoardHaptic);
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
        }), [availableWords, canInteractWithBoard, cellSize, drag, finishWordDrag, grid, gridSize, screenReaderEnabled, submitting]);

    useEffect(() => {
        if (!canInteractWithBoard) clearDrag();
        if (!canInteractWithBoard || submitting) setAccessibleStart(null);
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
                        boardLocked && styles.boardLocked,
                    ]}
                    testID="word-search-letter-grid"
                    pointerEvents={canInteractWithBoard && !submitting ? 'auto' : 'none'}
                    accessible={!screenReaderEnabled}
                    accessibilityRole="image"
                    accessibilityState={{ disabled: !canInteractWithBoard, busy: submitting }}
                    accessibilityLabel={translateUiText('Word search letter grid')}
                    accessibilityHint={canInteractWithBoard ? translateUiText('Touch the first letter, drag to the last letter, and release. Or activate a letter, then the last letter.') : undefined}
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
                        <View key={`row-${row}`} style={styles.boardRow} pointerEvents={screenReaderEnabled ? 'auto' : 'none'}>
                            {rowLetters.split('').map((letter, col) => (
                                <WordSearchCell
                                    key={`${row}-${col}`}
                                    letter={letter}
                                    cellSize={cellSize}
                                    row={row}
                                    col={col}
                                    screenReaderEnabled={screenReaderEnabled}
                                    selected={accessibleStart?.row === row && accessibleStart?.col === col}
                                    disabled={!canInteractWithBoard || submitting}
                                    onPress={screenReaderEnabled ? () => activateCell(row, col) : undefined}
                                />
                            ))}
                        </View>
                    ))}
                </View>
            </GestureDetector>
        </>
    );
});

const WordSearchScreen = ({ navigation, route, onRequestPremium }) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { socket } = useSocketContext();
    const { partnerOnline, isConnected, refreshPresence, sendNudge } = usePresence();
    const currentUser = getUser();
    const userId = idOf(currentUser?.id || currentUser?._id);
    const partnerId = idOf(route?.params?.partnerId || currentUser?.partnerId);
    const partnerName = route?.params?.partnerName || currentUser?.partnerUsername || translateUiText('Partner');
    const initialGameCandidate = route?.params?.gameData || null;
    const initialGame = useMemo(() => normalizeWordSearchGame(initialGameCandidate), [initialGameCandidate]);

    const [game, setGame] = useState(initialGame);
    const gameRef = useRef(initialGame);
    const gameRevisionRef = useRef(0);
    const retiredGameIdsRef = useRef(new Set());
    const mountedRef = useRef(true);
    const reconciliationRef = useRef(null);
    const operationRef = useRef(false);
    const needsRecoveryRef = useRef(false);
    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);
    const audioPlayerRef = useRef(null);
    useEffect(() => {
        const player = createSafeAudioPlayer();
        audioPlayerRef.current = player;
        return () => {
            audioPlayerRef.current = null;
            try { player?.stopPlayer().catch(() => {}); } catch (_) {}
        };
    }, []);
    const playResultSound = useCallback(async () => {
        const player = audioPlayerRef.current;
        if (!player) return;
        try {
            await player.stopPlayer().catch(() => {});
            if (!mountedRef.current || audioPlayerRef.current !== player) return;
            const soundUri = Image.resolveAssetSource(require('../../assets/sounds/result.mp3'))?.uri;
            if (!soundUri) return;
            await player.startPlayer(soundUri);
            if (!mountedRef.current || audioPlayerRef.current !== player) {
                await player.stopPlayer().catch(() => {});
                return;
            }
            await player.setVolume(1);
        } catch (_) {}
    }, []);
    const [difficulty, setDifficulty] = useState(() => {
        const saved = storage.getString('wordsearch_difficulty');
        return DIFFICULTY_OPTIONS.some(option => option.id === saved) ? saved : 'easy';
    });
    const [userSelectedMode, setUserSelectedMode] = useState(() => {
        const saved = storage.getString('wordsearch_mode');
        return ['single', 'duel'].includes(saved) ? saved : null;
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
    const [presenceKnown, setPresenceKnown] = useState(!partnerId || partnerOnline);
    const autoStartRef = useRef(false);
    const confettiRef = useRef(null);
    const celebratedGameIdsRef = useRef(new Set());
    const [loading, setLoading] = useState(!initialGame);
    const [submitting, setSubmitting] = useState(false);
    const [startingGame, setStartingGame] = useState(false);
    const [message, setMessage] = useState('');
    const [errorNotice, setErrorNotice] = useState('');
    const [newGameNotice, setNewGameNotice] = useState(null);
    const errorNoticeTimeoutRef = useRef(null);
    const [secondsRemaining, setSecondsRemaining] = useState(TURN_DURATION_SECONDS);
    const [awaitingTurnRecovery, setAwaitingTurnRecovery] = useState(false);
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
    const legacyGame = Boolean(game && game.protocolVersion !== 2);
    const duelPaused = !legacyGame && game?.mode === 'duel' && game?.status === 'active'
        && Boolean(game.turnPausedAt || awaitingTurnRecovery || !isConnected || (presenceKnown && !partnerOnline));
    const offlineMessage = !isConnected || game?.offlinePlayerIds?.some(id => idOf(id) === userId)
        ? translateUiText('You are offline')
        : translateUiText('Partner is offline');
    const turnIsOver = game?.mode === 'duel' && secondsRemaining <= 0;
    const canInteractWithBoard = game?.status === 'active'
        && !duelPaused
        && roundStarted
        && (!game.startsAt || Date.parse(game.startsAt) <= Date.now())
        && (game.mode === 'single' || (myTurn && !turnIsOver));
    const canPlayTogether = Boolean(partnerId && partnerOnline);
    const gameMode = userSelectedMode || (canPlayTogether ? 'duel' : 'single');
    const nextPuzzleMode = (!partnerId || !partnerOnline || gameMode === 'single') ? 'single' : 'duel';
    const showOfflineNote = gameMode === 'duel' && !partnerOnline;
    const waitingForPresence = Boolean(partnerId && !presenceKnown && isConnected && userSelectedMode !== 'single');

    useEffect(() => {
        if (game?.protocolVersion === 2 && game?.mode === 'duel' && game?.status === 'active'
            && (!isConnected || (presenceKnown && !partnerOnline))) setAwaitingTurnRecovery(true);
    }, [game?.mode, game?.protocolVersion, game?.status, isConnected, partnerOnline, presenceKnown]);

    const dismissErrorNotice = useCallback(() => {
        clearTimeout(errorNoticeTimeoutRef.current);
        errorNoticeTimeoutRef.current = null;
        setErrorNotice('');
    }, []);

    const showError = useCallback((text) => {
        if (!mountedRef.current) return;
        setMessage(text);
        if (!gameRef.current) return;
        clearTimeout(errorNoticeTimeoutRef.current);
        setErrorNotice(text);
        AccessibilityInfo.announceForAccessibility(text);
        errorNoticeTimeoutRef.current = setTimeout(() => {
            errorNoticeTimeoutRef.current = null;
            if (mountedRef.current) setErrorNotice('');
        }, ERROR_NOTICE_MS);
    }, []);

    useEffect(() => {
        dismissErrorNotice();
        return () => clearTimeout(errorNoticeTimeoutRef.current);
    }, [dismissErrorNotice, gameId]);

    useEffect(() => {
        if (!newGameNotice) return undefined;
        if (newGameNotice.gameId !== gameId) {
            setNewGameNotice(null);
            return undefined;
        }
        const timeout = setTimeout(() => setNewGameNotice(null), NEW_GAME_NOTICE_MS);
        return () => clearTimeout(timeout);
    }, [gameId, newGameNotice]);

    const applyGamePayload = useCallback((payload, options = {}) => {
        if (!mountedRef.current) return false;
        const nextGame = normalizeWordSearchGame(payload);
        if (!nextGame) {
            showError(translateUiText('The game data was incomplete. Please try again.'));
            return false;
        }
        const payloadGameId = idOf(nextGame._id);
        const currentGameId = idOf(gameRef.current?._id);
        if (!options.resumeExisting && retiredGameIdsRef.current.has(payloadGameId) && currentGameId !== payloadGameId) return false;
        if (!shouldApplyWordSearchGame(gameRef.current, nextGame, {
            ...options,
            currentRevision: gameRevisionRef.current,
        })) return false;
        const clockRecovered = options.reconciled || currentGameId !== payloadGameId
            || gameRef.current?.turnPausedAt
            || Date.parse(nextGame.updatedAt) > Date.parse(gameRef.current?.updatedAt)
            || Date.parse(nextGame.turnExpiresAt) > Date.parse(gameRef.current?.turnExpiresAt);
        if (currentGameId && currentGameId !== payloadGameId) {
            retiredGameIdsRef.current.add(currentGameId);
            expiryRefreshRef.current = '';
            setMessage('');
        }
        retiredGameIdsRef.current.delete(payloadGameId);
        if (nextGame.status === 'completed' && !celebratedGameIdsRef.current.has(payloadGameId)) {
            celebratedGameIdsRef.current.add(payloadGameId);
            if (currentGameId === payloadGameId && gameRef.current?.status === 'active') playResultSound();
            requestAnimationFrame(() => confettiRef.current?.start());
        }
        gameRef.current = nextGame;
        gameRevisionRef.current += 1;
        setGame(nextGame);
        if (clockRecovered && !nextGame.turnPausedAt && isConnected && partnerOnline) setAwaitingTurnRecovery(false);
        return true;
    }, [isConnected, partnerOnline, playResultSound, showError]);

    // Notification navigation can update route data without remounting this
    // screen. Mirror a genuinely new route payload into the live board.
    useEffect(() => {
        if (isPlayableGamePayload(initialGameCandidate)) {
            applyGamePayload(initialGameCandidate, { allowSwitch: true, resumeExisting: true });
        }
    }, [applyGamePayload, initialGameCandidate]);

    useEffect(() => {
        refreshPresence();
    }, [refreshPresence]);

    useEffect(() => {
        setPresenceKnown(!partnerId);
    }, [partnerId]);

    useEffect(() => {
        if (partnerOnline) setPresenceKnown(true);
    }, [partnerOnline]);

    useEffect(() => {
        if (!partnerId || presenceKnown) return undefined;
        const timeout = setTimeout(() => setPresenceKnown(true), PRESENCE_WAIT_MS);
        return () => clearTimeout(timeout);
    }, [partnerId, presenceKnown]);

    useEffect(() => {
        if (!socket || !partnerId) return undefined;
        const markPresenceKnown = (payload = {}, eventName) => {
            if (eventName !== 'status' && idOf(payload.userId) !== partnerId) return;
            if (eventName === 'status' && payload.partnerId && idOf(payload.partnerId) !== partnerId) return;
            setPresenceKnown(true);
        };
        const status = payload => markPresenceKnown(payload, 'status');
        const online = payload => markPresenceKnown(payload, 'online');
        const offline = payload => markPresenceKnown(payload, 'offline');
        socket.on('presence:status', status);
        socket.on('presence:online', online);
        socket.on('presence:offline', offline);
        socket.emit('presence:getStatus');
        return () => {
            socket.off('presence:status', status);
            socket.off('presence:online', online);
            socket.off('presence:offline', offline);
        };
    }, [partnerId, socket]);

    useEffect(() => {
        if (partnerOnline) setNudgeSent(false);
    }, [partnerOnline]);

    const fetchGame = useCallback(async (id) => {
        if (!id || !userId || id !== idOf(gameRef.current?._id)) return false;
        const requestRevision = gameRevisionRef.current;
        const { response, json } = await requestWordSearch(`${WORD_SEARCH_API}/${id}?userId=${userId}`);
        if (!response.ok || !json.success) throw new Error(json.message || translateUiText('Could not refresh the turn.'));
        return applyGamePayload(json.data, { expectedGameId: id, requestRevision, reconciled: true });
    }, [applyGamePayload, userId]);

    const reconcileGame = useCallback(async () => {
        if (!userId || !mountedRef.current) return false;
        if (operationRef.current) {
            needsRecoveryRef.current = true;
            return false;
        }
        if (reconciliationRef.current) return reconciliationRef.current;
        const current = gameRef.current;
        const expectedGameId = idOf(current?._id);
        const requestRevision = gameRevisionRef.current;
        const request = (async () => {
            // A partner may have started a new duel while this device was away.
            const url = current?.mode === 'single'
                ? `${WORD_SEARCH_API}/${expectedGameId}?userId=${userId}`
                : `${WORD_SEARCH_API}/active/${userId}${current ? '?mode=duel' : ''}`;
            const { response, json } = await requestWordSearch(url);
            if (!response.ok || !json.success) throw new Error(json.message || translateUiText('Could not load the active game.'));
            if (operationRef.current) {
                needsRecoveryRef.current = true;
                return false;
            }
            if (json.data) return applyGamePayload(json.data, { allowSwitch: true, expectedGameId, requestRevision, reconciled: true });
            if (expectedGameId && idOf(gameRef.current?._id) === expectedGameId) return fetchGame(expectedGameId);
            return false;
        })();
        reconciliationRef.current = request;
        try {
            return await request;
        } finally {
            reconciliationRef.current = null;
        }
    }, [applyGamePayload, fetchGame, userId]);

    const finishOperation = useCallback(() => {
        operationRef.current = false;
        if (!mountedRef.current) return;
        setSubmitting(false);
        setStartingGame(false);
        if (needsRecoveryRef.current) {
            needsRecoveryRef.current = false;
            reconcileGame().catch(() => {});
        }
    }, [reconcileGame]);

    const previousPartnerOnlineRef = useRef(partnerOnline);
    useEffect(() => {
        const reconnected = partnerOnline && !previousPartnerOnlineRef.current;
        previousPartnerOnlineRef.current = partnerOnline;
        if (reconnected && gameRef.current?.mode === 'duel') reconcileGame().catch(() => {});
    }, [partnerOnline, reconcileGame]);

    useEffect(() => {
        if (game?.turnPausedAt && game?.mode === 'duel' && game?.status === 'active') {
            setSecondsRemaining(Math.ceil((game.turnRemainingMs ?? turnDurationSeconds * 1000) / 1000));
            return undefined;
        }
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
        if (duelPaused) return undefined;
        const interval = setInterval(updateCountdown, 250);
        return () => clearInterval(interval);
    }, [duelPaused, game?.mode, game?.startsAt, game?.status, game?.turnExpiresAt, game?.turnPausedAt, game?.turnRemainingMs, turnDurationSeconds]);

    useEffect(() => {
        if (duelPaused) {
            setRoundStarted(false);
            setRematchCountdownLabel(null);
            return undefined;
        }
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
                const count = Math.max(1, Math.ceil(millisecondsLeft / 1000));
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
    }, [duelPaused, game?.mode, game?.startsAt, game?.status]);

    useEffect(() => {
        if (duelPaused || game?.mode !== 'duel' || game?.status !== 'active' || !game?.turnExpiresAt || !gameId) {
            return undefined;
        }
        const expiryKey = `${gameId}:${game.turnExpiresAt}`;
        const delay = Math.max(0, new Date(game.turnExpiresAt).getTime() - Date.now()) + 300;
        let attempts = 0;
        let cancelled = false;
        let timeout;
        const refreshTurn = async () => {
            if (expiryRefreshRef.current === expiryKey) return;
            try {
                if (await fetchGame(gameId)) expiryRefreshRef.current = expiryKey;
            } catch (_) {
                attempts += 1;
                if (!cancelled && attempts < 3) timeout = setTimeout(refreshTurn, attempts * 1000);
            }
        };
        timeout = setTimeout(refreshTurn, delay);
        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [duelPaused, fetchGame, game?.mode, game?.status, game?.turnExpiresAt, gameId]);

    useEffect(() => {
        if (initialGame || !userId) {
            setLoading(false);
            return undefined;
        }

        let active = true;
        reconcileGame()
            .catch(() => {})
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [initialGame, reconcileGame, userId]);

    useEffect(() => {
        const recover = () => {
            const currentGameId = idOf(gameRef.current?._id);
            if (currentGameId) socket?.emit('wordsearch:join', { gameId: currentGameId });
            refreshPresence();
            reconcileGame().catch(() => {});
        };
        socket?.on('connect', recover);
        const unsubscribeFocus = navigation?.addListener?.('focus', recover);
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') recover();
        });
        return () => {
            socket?.off('connect', recover);
            unsubscribeFocus?.();
            subscription.remove();
        };
    }, [navigation, reconcileGame, refreshPresence, socket]);

    useEffect(() => {
        if (!socket) return undefined;
        const handleUpdate = (payload = {}) => {
            if (idOf(payload.gameId) === idOf(gameRef.current?._id) && payload.game) {
                if (!applyGamePayload(payload.game)) return;
                if (payload.reason === 'turn_timeout') {
                    const nextTurnIsMine = idOf(payload.game.currentTurn) === userId;
                    setMessage(nextTurnIsMine ? translateUiText('Your turn — go!') : translateUiTemplate('{{0}}’s turn now.', [partnerName]));
                } else if (payload.foundWord) {
                    setMessage(translateUiTemplate('{{0}} found! Keep going.', [payload.foundWord]));
                }
            }
        };
        const handleInvite = (payload = {}) => {
            if (!isPlayableGamePayload(payload.game)) return;
            const invitedCreatorId = idOf(payload.game.creatorId);
            const invitedPartnerId = idOf(payload.game.partnerId);
            if (![invitedCreatorId, invitedPartnerId].includes(userId)) return;

            const previousGameId = idOf(gameRef.current?._id);
            expiryRefreshRef.current = '';
            if (!applyGamePayload(payload.game, { allowSwitch: true })) return;
            if (payload.game.mode === 'duel' && invitedCreatorId !== userId
                && previousGameId !== idOf(payload.game._id)) {
                const notice = translateUiText('New game started');
                setNewGameNotice({ gameId: idOf(payload.game._id), text: notice });
                AccessibilityInfo.announceForAccessibility(notice);
            }
            setMessage(invitedCreatorId === userId
                ? translateUiText('New challenge ready!')
                : translateUiTemplate('{{0}} started a new challenge!', [partnerName]));
        };
        const handleRematchStarted = (payload = {}) => {
            const previous = gameRef.current;
            if (!previous || previous.protocolVersion === 2 || idOf(payload.previousGameId) !== idOf(previous._id)) return;
            if (!isPlayableGamePayload(payload.game) || payload.game.protocolVersion === 2) return;
            if (![idOf(payload.game.creatorId), idOf(payload.game.partnerId)].includes(userId)) return;
            if (applyGamePayload(payload.game, { allowSwitch: true })) setMessage(translateUiText('Rematch starting…'));
        };
        const handleJoined = (payload = {}) => {
            if (payload.success && idOf(payload.game?._id) === idOf(gameRef.current?._id)) applyGamePayload(payload.game);
        };

        socket.on('wordsearch:invited', handleInvite);
        socket.on('wordsearch:rematchStarted', handleRematchStarted);
        socket.on('wordsearch:updated', handleUpdate);
        socket.on('wordsearch:joined', handleJoined);
        return () => {
            socket.off('wordsearch:invited', handleInvite);
            socket.off('wordsearch:rematchStarted', handleRematchStarted);
            socket.off('wordsearch:updated', handleUpdate);
            socket.off('wordsearch:joined', handleJoined);
        };
    }, [applyGamePayload, socket, partnerName, userId]);

    useEffect(() => {
        if (!socket || !gameId) return undefined;
        socket.emit('wordsearch:join', { gameId });
        return () => socket.emit('wordsearch:leave', { gameId });
    }, [gameId, socket]);

    const requestPuzzle = useCallback(async ({ mode, targetDifficulty, forceNew = false, replaceGameId = null }) => {
        const modesToTry = mode === 'duel' ? ['duel', 'single'] : ['single'];
        for (const requestedMode of modesToTry) {
            const { response, json } = await requestWordSearch(`${WORD_SEARCH_API}/create`, {
                method: 'POST',
                body: JSON.stringify({
                    creatorId: userId,
                    partnerId,
                    mode: requestedMode,
                    difficulty: targetDifficulty,
                    forceNew,
                    ...(replaceGameId ? { replaceGameId } : {}),
                }),
            });
            if (response.ok && json.success) return json;
            if (requestedMode === 'duel' && json.code === 'PARTNER_OFFLINE') {
                setPresenceKnown(true);
                refreshPresence();
                continue;
            }
            if (requestedMode === 'single' && json.code === 'PARTNER_ONLINE' && !modesToTry.includes('duel')) {
                modesToTry.push('duel');
                continue;
            }
            const error = new Error(json.message || translateUiText('Could not start game'));
            error.code = json.code;
            throw error;
        }
        throw new Error(translateUiText('Could not start game'));
    }, [partnerId, refreshPresence, userId]);

    const createGame = useCallback(async ({ mode = nextPuzzleMode, targetDifficulty = difficulty } = {}) => {
        if (operationRef.current) return;
        if (waitingForPresence && mode !== 'single') {
            setMessage(translateUiText('Checking whether your partner is online…'));
            return;
        }
        const expectedGameId = idOf(gameRef.current?._id);
        operationRef.current = true;
        setSubmitting(true);
        setStartingGame(true);
        dismissErrorNotice();
        setMessage(translateUiText('Starting game…'));
        try {
            const json = await requestPuzzle({ mode, targetDifficulty });
            if (!isPlayableGamePayload(json.data)) throw new Error(translateUiText('The server returned an incomplete game.'));
            if (!applyGamePayload(json.data, { allowSwitch: true, expectedGameId, resumeExisting: true })) return;
            setMessage(json.isExisting ? translateUiText('Resuming your active game.') : (json.data.mode === 'duel'
                ? translateUiTemplate('Game started with {{0}}!', [partnerName]) : translateUiText('Solo puzzle ready!')));
        } catch (error) {
            if (!mountedRef.current || idOf(gameRef.current?._id) !== expectedGameId) return;
            if (error.code === 'WORD_SEARCH_FREE_LIMIT_REACHED') {
                setMessage(translateUiText('Premium is required to start another Word Search game.'));
                onRequestPremium?.();
                return;
            }
            showError(translateUiText(error.message || 'Could not start game.'));
        } finally {
            finishOperation();
        }
    }, [applyGamePayload, difficulty, dismissErrorNotice, finishOperation, nextPuzzleMode, onRequestPremium, partnerName, requestPuzzle, showError, waitingForPresence]);

    const handleNudgePartner = useCallback(() => {
        if (nudgeSent) return;
        if (!isConnected) {
            showError(translateUiText('Connect to the internet to nudge your partner.'));
            return;
        }
        sendNudge('wordsearch');
        setNudgeSent(true);
        setMessage(translateUiTemplate('Nudge sent to {{0}}!', [partnerName]));
    }, [isConnected, nudgeSent, partnerName, sendNudge, showError]);

    useEffect(() => {
        if (
            loading
            || game
            || submitting
            || waitingForPresence
            || !userId
            || autoStartRef.current
        ) return;

        autoStartRef.current = true;
        createGame();
    }, [createGame, game, loading, submitting, userId, waitingForPresence]);

    const submitSelection = useCallback(async (start, end) => {
        if (operationRef.current || idOf(gameRef.current?._id) !== gameId || !canInteractWithBoard) return;
        const liveGame = gameRef.current;
        if (liveGame?.status !== 'active' || (liveGame.mode === 'duel'
            && (idOf(liveGame.currentTurn) !== userId || liveGame.turnPausedAt
                || (liveGame.turnExpiresAt && Date.parse(liveGame.turnExpiresAt) <= Date.now())))) return;
        const localSelection = checkWordSearchSelection(liveGame, start, end);
        if (localSelection.code) {
            triggerHaptic('notificationError');
            showError(localSelection.code === 'INVALID_SELECTION'
                ? translateUiTemplate('Choose a straight or diagonal line of at least {{0}} letters.', [3])
                : translateUiText(localSelection.code === 'WORD_ALREADY_FOUND'
                    ? 'That word was already found.' : 'That is not a hidden word.'));
            return;
        }

        triggerHaptic('notificationSuccess');
        const requestRevision = gameRevisionRef.current;
        operationRef.current = true;
        setSubmitting(true);
        setMessage(translateUiText('Checking…'));
        try {
            const { response, json } = await requestWordSearch(`${WORD_SEARCH_API}/${gameId}/find`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, start, end }),
            });
            if (!response.ok || !json.success) {
                if (json.data) applyGamePayload(json.data, { expectedGameId: gameId, requestRevision });
                const selectionError = new Error(json.message || translateUiText('That is not a hidden word'));
                selectionError.code = json.code;
                throw selectionError;
            }
            if (idOf(gameRef.current?._id) !== gameId) return;
            if (!isPlayableGamePayload(json.data)) throw new Error(translateUiText('The server returned an incomplete game.'));
            const applied = applyGamePayload(json.data, { expectedGameId: gameId, requestRevision });
            if (applied && json.data.protocolVersion !== 2 && json.rematch && json.rematch.protocolVersion !== 2
                && applyGamePayload(json.rematch, { allowSwitch: true, expectedGameId: gameId })) {
                setMessage(translateUiText('Rematch starting…'));
            } else if (applied) {
                setMessage(translateUiTemplate('{{0}} found! Keep going.', [json.foundWord]));
            }
        } catch (error) {
            if (!mountedRef.current || idOf(gameRef.current?._id) !== gameId) return;
            if (['WORD_NOT_FOUND', 'INVALID_SELECTION', 'WORD_ALREADY_FOUND'].includes(error.code)) triggerHaptic('notificationError');
            showError(translateUiText(error.message || 'That is not a hidden word.'));
            if (error.code === 'NOT_YOUR_TURN' || error.code === 'GAME_PAUSED' || error.message?.includes('changed')) fetchGame(gameId).catch(() => {});
        } finally {
            finishOperation();
        }
    }, [applyGamePayload, canInteractWithBoard, fetchGame, finishOperation, gameId, showError, userId]);

    const executeNewPuzzle = useCallback(async (targetDifficulty, targetMode) => {
        if (startingNewPuzzleRef.current || operationRef.current) return;
        startingNewPuzzleRef.current = true;
        operationRef.current = true;
        const mode = (!partnerId || !partnerOnline || targetMode === 'single') ? 'single' : 'duel';
        autoStartRef.current = true;
        setSubmitting(true);
        setStartingGame(true);
        dismissErrorNotice();
        setMessage(translateUiText('Starting game…'));

        try {
            if (idOf(gameRef.current?._id) !== gameId || !mountedRef.current) return;

            const createJson = await requestPuzzle({
                mode,
                targetDifficulty,
                forceNew: true,
                replaceGameId: game?.status === 'active' ? gameId : null,
            });
            if (!isPlayableGamePayload(createJson.data)) {
                throw new Error(translateUiText('The server returned an incomplete game.'));
            }
            if (!applyGamePayload(createJson.data, { allowSwitch: true, expectedGameId: gameId })) return;
            expiryRefreshRef.current = '';
            setMessage(createJson.data.mode === 'duel'
                ? translateUiTemplate('New challenge started with {{0}}!', [partnerName])
                : translateUiText('New puzzle ready!'));
            triggerHaptic('notificationSuccess');
        } catch (error) {
            if (!mountedRef.current || idOf(gameRef.current?._id) !== gameId) return;
            if (error.code === 'WORD_SEARCH_FREE_LIMIT_REACHED') {
                setMessage(translateUiText('Premium is required to start another Word Search game.'));
                onRequestPremium?.();
                return;
            }
            fetchGame(gameId).catch(() => {});
            showError(translateUiText(error.message || 'Could not start a new puzzle.'));
        } finally {
            startingNewPuzzleRef.current = false;
            finishOperation();
        }
    }, [applyGamePayload, dismissErrorNotice, fetchGame, finishOperation, game?.status, gameId, onRequestPremium, partnerId, partnerName, partnerOnline, requestPuzzle, showError]);

    const startNewPuzzle = useCallback((targetDifficulty = difficulty, targetMode = nextPuzzleMode) => {
        if (submitting || startingNewPuzzleRef.current) {
            closeSettings();
            return;
        }
        if (waitingForPresence && targetMode !== 'single') {
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
    }, [closeSettings, difficulty, executeNewPuzzle, game?.mode, game?.status, nextPuzzleMode, submitting, waitingForPresence]);

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


    const boardSize = Math.min(width - 32, 430);
    const cellSize = game ? Math.floor((boardSize - 12) / game.gridSize) : 0;
    const contentWidth = game ? cellSize * game.gridSize + 12 : boardSize;
    const showOfflineNudge = Boolean(partnerId && isConnected
        && ((presenceKnown && !partnerOnline) || game?.offlinePlayerIds?.some(id => idOf(id) === partnerId)));
    const showTurnTimer = game?.mode === 'duel' && game?.status === 'active';
    const completedTitle = game?.isDraw
        ? translateUiText('It’s a draw.')
        : idOf(game?.winner) === userId
            ? `${translateUiText('You won.')} 🎉`
            : game?.mode === 'single'
                ? `${translateUiText('Puzzle complete.')} 🎉`
                : translateUiTemplate('You lost. {{0}} won.', [partnerName]);
    const timerUrgent = !duelPaused && secondsRemaining <= 10;
    const timerProgress = Math.max(0, Math.min(100, (secondsRemaining / turnDurationSeconds) * 100));
    const formattedTimer = `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, '0')}`;

    if (loading) {
        return (
            <LinearGradient colors={['#F5E8FF', '#FFF9FC']} style={styles.flexCenter}>
                <ActivityIndicator size="large" color="#7B56D8" />
                <Text style={styles.loadingText}>{translateUiText('Looking for an active game…')}</Text>
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
                <View style={[styles.preparingGame, { paddingBottom: insets.bottom }]}>
                    {partnerId && (
                        <View style={styles.compactStatusChip}>
                            <View style={[
                                styles.livePresenceDot,
                                canPlayTogether ? styles.partnerStatusOnline : styles.partnerStatusOffline,
                            ]} />
                            <Text style={styles.compactStatusText}>
                                {!presenceKnown
                                    ? translateUiTemplate('Checking {{0}}…', [partnerName])
                                    : translateUiTemplate(canPlayTogether ? '{{0}} online' : '{{0}} offline', [partnerName])}
                            </Text>
                        </View>
                    )}
                    {submitting || waitingForPresence || !autoStartRef.current ? (
                        <ActivityIndicator size="large" color="#7B56D8" />
                    ) : (
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={() => {
                                autoStartRef.current = true;
                                createGame();
                            }}
                        >
                            <Text style={styles.retryButtonText}>{translateUiText('Try again')}</Text>
                        </TouchableOpacity>
                    )}
                    <Text style={styles.preparingText}>
                        {submitting
                            ? (canPlayTogether ? translateUiTemplate('Starting with {{0}}…', [partnerName]) : translateUiText('Starting game…'))
                            : message || translateUiText('Preparing game…')}
                    </Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.gameViewport}
                    contentContainerStyle={[styles.gameContent, { paddingBottom: insets.bottom + 16 }]}
                    scrollEnabled={false}
                    showsVerticalScrollIndicator={false}
                >
                    {game.status === 'completed' && (
                        <View style={styles.completeCard} testID="word-search-result" accessibilityLiveRegion="polite">
                            <Text style={styles.completeTitle}>{completedTitle}</Text>
                            <Text style={styles.completeSubtitle}>
                                {game.mode === 'duel' ? translateUiTemplate('Final score {{0}}–{{1}}', [myScore, theirScore]) : translateUiTemplate('You found all {{0}} words.', [game.totalWords])}
                            </Text>
                            <TouchableOpacity
                                style={styles.playAgainButton}
                                testID="word-search-start-game"
                                accessibilityRole="button"
                                accessibilityState={{ disabled: submitting, busy: submitting }}
                                disabled={submitting}
                                onPress={() => createGame({
                                    mode: game.mode === 'single' || !partnerOnline ? 'single' : 'duel',
                                    targetDifficulty: game.difficulty || difficulty,
                                })}
                            >
                                {startingGame && <ActivityIndicator size="small" color="#684887" />}
                                <Text style={styles.playAgainText} accessibilityLiveRegion="polite">
                                    {translateUiText(startingGame ? 'Starting game…' : 'Start new game')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {game.status === 'active' && (
                        <View style={[styles.scoreCard, { width: contentWidth }]} testID="word-search-score-card">
                            <View style={styles.scoreSide}>
                                <View style={styles.scoreNameRow}>
                                    {showTurnTimer && myTurn && <View style={[styles.activePlayerDot, styles.myTurnDot]} />}
                                    <Text style={[styles.scoreName, showTurnTimer && myTurn && styles.myActiveScoreName]}>
                                        {translateUiText('You')}
                                    </Text>
                                </View>
                                <Text style={styles.scoreNumber}>{myScore}</Text>
                            </View>
                            {showTurnTimer ? (
                                <View style={styles.scoreCenter} testID="word-search-turn-timer">
                                    <View style={styles.timerBadge}>
                                        <Timer size={14} color={timerUrgent ? '#D94D62' : '#81728D'} />
                                        <Text
                                            style={[styles.timerText, timerUrgent && styles.timerTextUrgent]}
                                            accessibilityLabel={translateUiTemplate('{{0}} seconds remaining', [secondsRemaining])}
                                        >
                                            {formattedTimer}
                                        </Text>
                                    </View>
                                    <Text
                                        style={[styles.turnLabel, !myTurn && styles.partnerTurnLabel, timerUrgent && styles.timerTextUrgent, duelPaused && styles.pausedTurnLabel]}
                                        accessibilityLiveRegion="polite"
                                        numberOfLines={duelPaused ? 2 : 1}
                                    >
                                        {duelPaused ? offlineMessage : translateUiText(myTurn ? 'Your turn' : 'Partner’s turn')}
                                    </Text>
                                </View>
                            ) : game.mode === 'single' ? (
                                <Text style={styles.soloLabel}>{translateUiText('Solo')}</Text>
                            ) : null}
                            {game.mode === 'duel' && (
                                <View style={styles.scoreSide}>
                                    <View style={styles.scoreNameRow}>
                                        {showTurnTimer && !myTurn && <View style={[styles.activePlayerDot, styles.partnerTurnDot]} />}
                                        <Text
                                            style={[styles.scoreName, showTurnTimer && !myTurn && styles.partnerActiveScoreName]}
                                            numberOfLines={1}
                                            accessibilityLabel={partnerName}
                                        >
                                            {partnerName}
                                        </Text>
                                    </View>
                                    <Text style={styles.scoreNumber}>{theirScore}</Text>
                                </View>
                            )}
                            {showTurnTimer && (
                                <View style={styles.timerTrack}>
                                    <View style={[
                                        styles.timerFill,
                                        { width: `${timerProgress}%` },
                                        !myTurn && styles.partnerTimerFill,
                                        timerUrgent && styles.timerFillUrgent,
                                        duelPaused && styles.timerFillPaused,
                                    ]} />
                                </View>
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
                        onSubmitSelection={submitSelection}
                        onMessage={showError}
                    />

                    <View style={[styles.wordPanel, { width: contentWidth }]}>
                        <View style={styles.wordPanelHeader}>
                            <Text style={styles.wordPanelTitle}>{translateUiText('Words')}</Text>
                            <Text
                                style={styles.wordProgress}
                                accessibilityLabel={translateUiTemplate('{{0}}/{{1}} found', [game.foundCount, game.totalWords])}
                            >
                                {game.foundCount} / {game.totalWords}
                            </Text>
                        </View>
                        <View style={styles.wordList}>
                            {game.words.map(item => {
                                const found = Boolean(item.foundBy);
                                const foundByPartner = found && idOf(item.foundBy) !== userId;
                                return (
                                    <View
                                        key={item.word}
                                        style={[
                                            styles.wordChip,
                                            found && styles.wordChipFound,
                                            foundByPartner && styles.partnerWordChipFound,
                                        ]}
                                    >
                                        {found && <Check size={12} color={foundByPartner ? '#7954CC' : '#278F79'} />}
                                        <Text style={[
                                            styles.wordText,
                                            found && styles.wordTextFound,
                                            foundByPartner && styles.partnerWordTextFound,
                                        ]}>{item.word}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {showOfflineNudge && (
                        <View style={styles.wordListNudge} testID="word-search-offline-nudge">
                            <TouchableOpacity
                                style={[styles.nudgeButton, styles.wordListNudgeButton, { width: contentWidth }, nudgeSent && styles.nudgeButtonSent]}
                                onPress={handleNudgePartner}
                                disabled={nudgeSent}
                                accessibilityRole="button"
                                accessibilityState={{ disabled: nudgeSent }}
                            >
                                {nudgeSent ? <Check size={18} color="#4D9B8B" /> : <Bell size={18} color="#704EBA" />}
                                <Text style={[styles.nudgeButtonText, nudgeSent && styles.nudgeButtonTextSent]} accessibilityLiveRegion="polite">
                                    {translateUiText(nudgeSent ? 'Sent' : 'Nudge your partner')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                </ScrollView>
            )}


            {startingGame && game?.status !== 'completed' && game && (
                <View style={[styles.errorNotice, styles.startingGameNotice, { bottom: insets.bottom + 20 }]} testID="word-search-starting-notice">
                    <ActivityIndicator size="small" color="#684887" />
                    <Text style={styles.playAgainText} accessibilityLiveRegion="polite">{translateUiText('Starting game…')}</Text>
                </View>
            )}

            {!startingGame && !errorNotice && newGameNotice?.gameId === gameId && game && (
                <View style={[styles.errorNotice, styles.newGameNotice, { bottom: insets.bottom + 20 }]} testID="word-search-new-game-notice">
                    <Check size={18} color="#278F79" />
                    <Text style={[styles.errorNoticeText, styles.newGameNoticeText]} accessibilityLiveRegion="polite">
                        {newGameNotice.text}
                    </Text>
                    <TouchableOpacity
                        onPress={() => setNewGameNotice(null)}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText('Close')}
                        hitSlop={8}
                        style={styles.errorNoticeClose}
                    >
                        <X size={16} color="#278F79" />
                    </TouchableOpacity>
                </View>
            )}

            {errorNotice && game && (
                <View
                    style={[styles.errorNotice, { bottom: insets.bottom + 20 }]}
                    testID="word-search-error-notice"
                >
                    <Text style={styles.errorNoticeText} accessibilityRole="alert">{errorNotice}</Text>
                    <TouchableOpacity
                        onPress={dismissErrorNotice}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText('Close')}
                        hitSlop={8}
                        style={styles.errorNoticeClose}
                    >
                        <X size={16} color="#AD4C65" />
                    </TouchableOpacity>
                </View>
            )}

            {rematchCountdownLabel && (
                <View style={styles.rematchOverlay} pointerEvents="auto">
                    <Text style={styles.rematchEyebrow}>{translateUiText('REMATCH')}</Text>
                    <Text style={[
                        styles.rematchCountdown,
                        rematchCountdownLabel === 'GO!' && styles.rematchGo,
                    ]}>
                        {rematchCountdownLabel === 'GO!' ? translateUiText('GO!') : rematchCountdownLabel}
                    </Text>
                    <Text style={styles.rematchSubtitle}>
                        {translateUiText(rematchCountdownLabel === 'GO!' ? 'Find as many as you can!' : 'Get ready')}
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

                    {partnerId && (
                        <View style={styles.settingsPresenceRow}>
                            <View style={styles.livePresenceLabel}>
                                <View style={[
                                    styles.livePresenceDot,
                                    partnerOnline ? styles.partnerStatusOnline : styles.partnerStatusOffline,
                                ]} />
                                <Text style={styles.livePresenceText} numberOfLines={1}>
                                    {translateUiTemplate(partnerOnline ? '{{0}} online' : '{{0}} offline', [partnerName])}
                                </Text>
                            </View>
                            {!partnerOnline && (
                                <TouchableOpacity
                                    style={styles.inlineNudgeButton}
                                    onPress={handleNudgePartner}
                                    disabled={nudgeSent}
                                    accessibilityRole="button"
                                >
                                    <Bell size={13} color={nudgeSent ? '#69A99B' : '#7653C9'} />
                                    <Text style={[styles.inlineNudgeText, nudgeSent && styles.inlineNudgeTextSent]}>
                                        {translateUiText(nudgeSent ? 'Sent' : 'Nudge')}
                                    </Text>
                                </TouchableOpacity>
                            )}
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
                handleComponent={null}
                onDismiss={() => setPendingNewPuzzle(null)}
            >
                <BottomSheetView
                    style={[styles.endChallengeSheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}
                    testID="end-challenge-sheet"
                >
                    <View style={styles.endChallengeHeader} collapsable={false}>
                        <LinearGradient
                            colors={['#F1E8FF', '#FFF0F7', '#FFF9FD']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                            pointerEvents="none"
                        />
                        <View
                            style={[styles.settingsHandleIndicator, styles.endChallengeHandleIndicator]}
                            pointerEvents="none"
                            accessible={false}
                        />
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
                    </View>

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
        backgroundColor: '#FFF9FD',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
    },
    endChallengeHeader: {
        position: 'relative',
        alignSelf: 'stretch',
        backgroundColor: '#F1E8FF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        overflow: 'hidden',
        paddingHorizontal: 23,
        paddingTop: 12,
        paddingBottom: 23,
    },
    endChallengeHandleIndicator: {
        alignSelf: 'center',
        marginBottom: 20,
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
    header: { paddingHorizontal: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    backButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontFamily: fontFamily.extraBold, fontSize: 19, color: '#302244' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    headerMenuButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    preparingGame: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 20, paddingTop: 16 },
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
    wordListNudge: { alignItems: 'center', marginTop: 16 },
    wordListNudgeButton: { marginTop: 0 },
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
    gameViewport: { flex: 1 },
    gameContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 16 },
    scoreCard: { minHeight: 78, borderRadius: 19, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
    scoreSide: { flex: 1, minWidth: 0, alignItems: 'center' },
    scoreNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, maxWidth: '100%' },
    scoreName: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 12, color: '#81728D' },
    myActiveScoreName: { color: '#278F79' },
    partnerActiveScoreName: { color: '#7954CC' },
    activePlayerDot: { width: 6, height: 6, borderRadius: 3 },
    scoreNumber: { marginTop: 2, fontFamily: fontFamily.extraBold, fontSize: 26, lineHeight: 31, color: '#332448', fontVariant: ['tabular-nums'] },
    scoreCenter: { width: 96, alignItems: 'center', justifyContent: 'center' },
    soloLabel: { flex: 1, textAlign: 'center', fontFamily: fontFamily.bold, fontSize: 13, color: '#7954CC' },
    timerBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    timerText: { fontFamily: fontFamily.extraBold, fontWeight: '900', fontSize: 18, lineHeight: 22, color: '#332448', fontVariant: ['tabular-nums'] },
    timerTextUrgent: { color: '#D94D62' },
    turnLabel: { marginTop: 4, maxWidth: '100%', fontFamily: fontFamily.extraBold, fontWeight: '900', fontSize: 11, color: '#278F79' },
    partnerTurnLabel: { color: '#7954CC' },
    pausedTurnLabel: { color: '#81728D', textAlign: 'center' },
    timerTrack: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: '#EAF5F1', overflow: 'hidden' },
    timerFill: { height: '100%', backgroundColor: '#42BBA5' },
    partnerTimerFill: { backgroundColor: '#9066D3' },
    timerFillUrgent: { backgroundColor: '#E45B70' },
    timerFillPaused: { backgroundColor: '#B7A9C3' },
    myTurnDot: { backgroundColor: '#278F79' },
    partnerTurnDot: { backgroundColor: '#7954CC' },
    settingsPresenceRow: { minHeight: 32, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    livePresenceLabel: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
    livePresenceDot: { width: 8, height: 8, borderRadius: 4 },
    livePresenceText: { flexShrink: 1, fontFamily: fontFamily.bold, fontSize: 12, color: '#817486' },
    inlineNudgeButton: { minHeight: 36, paddingHorizontal: 10, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0E7FC' },
    inlineNudgeText: { fontFamily: fontFamily.extraBold, fontSize: 12, color: '#704EBA' },
    inlineNudgeTextSent: { color: '#5A9C8E' },
    board: { marginTop: 28, padding: 6, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.93)', shadowColor: '#7A5A88', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.13, shadowRadius: 13, elevation: 0 },
    boardLocked: { opacity: 0.55, backgroundColor: '#E8E5ED', shadowOpacity: 0 },
    boardRow: { flexDirection: 'row', zIndex: 2 },
    accessibleSelectedCell: { backgroundColor: 'rgba(247, 196, 69, 0.46)' },
    cell: { alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
    wordLine: { position: 'absolute', zIndex: 1 },
    dragWordLine: {
        borderWidth: 1,
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
    wordPanel: { marginTop: 28 },
    wordPanelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
    wordPanelTitle: { fontFamily: fontFamily.extraBold, fontSize: 13, color: '#5A4D63' },
    wordProgress: { fontFamily: fontFamily.medium, fontSize: 12, color: '#81728D', fontVariant: ['tabular-nums'] },
    wordList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    wordChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F1EAF8' },
    wordChipFound: { backgroundColor: '#DFF4ED' },
    partnerWordChipFound: { backgroundColor: '#EBE0FA' },
    wordText: { fontFamily: fontFamily.bold, fontSize: 11, color: '#594B63', letterSpacing: 0.35 },
    wordTextFound: { color: '#278F79', textDecorationLine: 'line-through' },
    partnerWordTextFound: { color: '#7954CC' },
    errorNotice: { position: 'absolute', alignSelf: 'center', width: '90%', maxWidth: 430, zIndex: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 15, paddingRight: 8, paddingVertical: 10, borderRadius: 15, borderWidth: 1, borderColor: '#F0BDC8', backgroundColor: '#FFF2F4' },
    errorNoticeText: { flex: 1, fontFamily: fontFamily.medium, fontSize: 12, lineHeight: 18, color: '#943C56' },
    errorNoticeClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    newGameNotice: { borderColor: '#BDE1D7', backgroundColor: '#EDF8F4' },
    newGameNoticeText: { fontFamily: fontFamily.bold, color: '#278F79' },
    startingGameNotice: { borderColor: '#D8C8EF', backgroundColor: '#F5EEFF', paddingRight: 15 },
    completeCard: { width: '92%', maxWidth: 430, marginBottom: 16, borderRadius: 20, padding: 18, backgroundColor: '#49305E', alignItems: 'center' },
    completeTitle: { fontFamily: fontFamily.extraBold, fontSize: 23, color: '#FFFFFF', textAlign: 'center' },
    completeSubtitle: { fontFamily: fontFamily.medium, fontSize: 12, color: '#E9DFF0', marginTop: 5 },
    playAgainButton: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 11, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    playAgainText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: '#684887' },
    rematchOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 50, backgroundColor: 'rgba(42, 27, 58, 0.86)', alignItems: 'center', justifyContent: 'center' },
    rematchEyebrow: { fontFamily: fontFamily.extraBold, fontSize: 16, letterSpacing: 4, color: '#D9C6F8' },
    rematchCountdown: { marginTop: 8, fontFamily: fontFamily.extraBold, fontWeight: '900', fontSize: 112, lineHeight: 126, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
    rematchGo: { fontSize: 76, lineHeight: 100, color: '#73E4CE' },
    rematchSubtitle: { marginTop: 4, fontFamily: fontFamily.extraBold, fontWeight: '900', fontSize: 15, color: '#F1E9F7' },
    confettiLayer: { ...StyleSheet.absoluteFillObject, zIndex: 60 },
});

export { WordSearchBoard };
export default WordSearchScreen;
