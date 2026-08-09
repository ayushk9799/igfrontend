import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { Bell, ChevronLeft, Settings2, Timer, X } from 'lucide-react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE } from '../constants/Api';
import { fontFamily } from '../constants/fonts';
import { useSocketContext } from '../context/SocketContext';
import usePresence from '../hooks/usePresence';
import { getUser } from '../utils/authStorage';

const DIFFICULTY_OPTIONS = [
    { id: 'easy', title: 'Easy', detail: '8 × 8 · 6 words' },
    { id: 'medium', title: 'Medium', detail: '10 × 10 · 8 words' },
    { id: 'hard', title: 'Hard', detail: '12 × 12 · 12 words' },
];

const TURN_DURATION_SECONDS = 45;

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

const snapToWordDirection = (start, current, gridSize) => {
    if (!start || !current) return start;
    const rowDistance = current.row - start.row;
    const colDistance = current.col - start.col;
    if (rowDistance === 0 && colDistance === 0) return start;

    // Quantize the finger angle to one of the eight legal word directions.
    const directionAngle = Math.round(Math.atan2(rowDistance, colDistance) / (Math.PI / 4)) * (Math.PI / 4);
    const rowStep = Math.round(Math.sin(directionAngle));
    const colStep = Math.round(Math.cos(directionAngle));
    let distance = Math.max(Math.abs(rowDistance), Math.abs(colDistance));

    const rowLimit = rowStep > 0
        ? gridSize - 1 - start.row
        : rowStep < 0 ? start.row : Number.POSITIVE_INFINITY;
    const colLimit = colStep > 0
        ? gridSize - 1 - start.col
        : colStep < 0 ? start.col : Number.POSITIVE_INFINITY;
    distance = Math.min(distance, rowLimit, colLimit);

    return {
        row: start.row + (rowStep * distance),
        col: start.col + (colStep * distance),
    };
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
    const [difficulty, setDifficulty] = useState('medium');
    const [difficultyMenuVisible, setDifficultyMenuVisible] = useState(false);
    const [nudgeSent, setNudgeSent] = useState(false);
    const [presenceKnown, setPresenceKnown] = useState(!partnerId);
    const [dragSelection, setDragSelection] = useState(null);
    const dragStartRef = useRef(null);
    const dragEndRef = useRef(null);
    const autoStartRef = useRef(false);
    const confettiRef = useRef(null);
    const celebratedGameIdsRef = useRef(new Set());
    const [loading, setLoading] = useState(!initialGame);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [secondsRemaining, setSecondsRemaining] = useState(TURN_DURATION_SECONDS);
    const [roundStarted, setRoundStarted] = useState(true);
    const [rematchCountdownLabel, setRematchCountdownLabel] = useState(null);
    const expiryRefreshRef = useRef('');

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
    const gameMode = canPlayTogether ? 'duel' : 'single';

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

            dragStartRef.current = null;
            dragEndRef.current = null;
            setDragSelection(null);
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

            dragStartRef.current = null;
            dragEndRef.current = null;
            setDragSelection(null);
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

    const createGame = useCallback(async () => {
        if (partnerId && !presenceKnown) {
            setMessage('Checking whether your partner is online…');
            return;
        }
        setSubmitting(true);
        setMessage('Building your puzzle…');
        try {
            const response = await fetch(`${API_BASE}/api/word-search/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ creatorId: userId, partnerId, mode: gameMode, difficulty }),
            });
            const json = await response.json();
            if (!response.ok || !json.success) {
                if (['PARTNER_ONLINE', 'PARTNER_OFFLINE'].includes(json.code)) {
                    setPresenceKnown(false);
                    refreshPresence();
                }
                throw new Error(json.message || 'Could not start game');
            }
            if (!applyGamePayload(json.data)) throw new Error('The server returned an incomplete game.');
            dragStartRef.current = null;
            dragEndRef.current = null;
            setDragSelection(null);
            setMessage(json.isExisting ? 'Resuming your active game.' : (gameMode === 'duel' ? `Game started with ${partnerName}!` : 'Solo puzzle ready!'));
        } catch (error) {
            setMessage(error.message || 'Could not start game.');
        } finally {
            setSubmitting(false);
        }
    }, [applyGamePayload, difficulty, gameMode, partnerId, partnerName, presenceKnown, refreshPresence, userId]);

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
            dragStartRef.current = null;
            dragEndRef.current = null;
            setDragSelection(null);
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
            if (json.rematch && applyGamePayload(json.rematch)) {
                setMessage('Rematch starting…');
            } else {
                setMessage(`${json.foundWord} found! Keep going.`);
            }
        } catch (error) {
            setMessage(error.message || 'That is not a hidden word.');
            if (error.code === 'NOT_YOUR_TURN' || error.message?.includes('changed')) fetchGame(gameId).catch(() => {});
        } finally {
            dragStartRef.current = null;
            dragEndRef.current = null;
            setDragSelection(null);
            setSubmitting(false);
        }
    }, [applyGamePayload, fetchGame, gameId, userId]);

    const leaveBoard = useCallback(() => {
        Alert.alert(
            'Start a new puzzle?',
            game?.mode === 'duel' ? 'This ends the current game for both players.' : 'Your current progress will be cleared.',
            [
                { text: 'Keep playing', style: 'cancel' },
                {
                    text: 'End game',
                    style: 'destructive',
                    onPress: async () => {
                        if (submitting) return;
                        let abandoned = false;
                        autoStartRef.current = true;
                        setSubmitting(true);
                        setMessage('Building a new puzzle…');
                        try {
                            const abandonResponse = await fetch(`${API_BASE}/api/word-search/${gameId}/abandon`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId }),
                            });
                            const abandonJson = await abandonResponse.json();
                            if (!abandonResponse.ok || !abandonJson.success) {
                                throw new Error(abandonJson.message || 'Could not end the current game');
                            }
                            abandoned = true;

                            const createResponse = await fetch(`${API_BASE}/api/word-search/create`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    creatorId: userId,
                                    partnerId,
                                    mode: game?.mode || gameMode,
                                    difficulty,
                                }),
                            });
                            const createJson = await createResponse.json();
                            if (!createResponse.ok || !createJson.success) {
                                throw new Error(createJson.message || 'Could not create a new puzzle');
                            }
                            if (!applyGamePayload(createJson.data)) {
                                throw new Error('The server returned an incomplete game.');
                            }
                            dragStartRef.current = null;
                            dragEndRef.current = null;
                            setDragSelection(null);
                            expiryRefreshRef.current = '';
                            setMessage(game?.mode === 'duel'
                                ? `New challenge started with ${partnerName}!`
                                : 'New puzzle ready!');
                        } catch (error) {
                            setMessage(error.message || 'Could not start a new puzzle.');
                            if (abandoned) setGame(null);
                        } finally {
                            setSubmitting(false);
                        }
                    },
                },
            ],
        );
    }, [applyGamePayload, difficulty, game, gameId, gameMode, partnerId, partnerName, submitting, userId]);

    const boardSize = Math.min(width - 24, 430);
    const cellSize = game ? Math.floor((boardSize - 12) / game.gridSize) : 0;
    const coordinateFromTouch = useCallback((event) => {
        if (!game || !cellSize) return null;
        const localX = event.nativeEvent.locationX - 6;
        const localY = event.nativeEvent.locationY - 6;
        const col = Math.max(0, Math.min(game.gridSize - 1, Math.floor(localX / cellSize)));
        const row = Math.max(0, Math.min(game.gridSize - 1, Math.floor(localY / cellSize)));
        return { row, col };
    }, [cellSize, game]);

    const beginWordDrag = useCallback((event) => {
        if (submitting || game?.status !== 'active') return;
        if (turnIsOver) {
            setMessage('Time’s up — switching turns…');
            return;
        }
        if (!myTurn) {
            setMessage(`It’s ${partnerName}’s turn.`);
            return;
        }
        const start = coordinateFromTouch(event);
        if (!start) return;
        dragStartRef.current = start;
        dragEndRef.current = start;
        setDragSelection({ start, end: start });
        setMessage('Keep dragging to the last letter…');
    }, [coordinateFromTouch, game?.status, myTurn, partnerName, submitting, turnIsOver]);

    const updateWordDrag = useCallback((event) => {
        const start = dragStartRef.current;
        if (!start || !game) return;
        const current = coordinateFromTouch(event);
        if (!current) return;
        const end = snapToWordDirection(start, current, game.gridSize);
        const previousEnd = dragEndRef.current;
        if (previousEnd?.row === end.row && previousEnd?.col === end.col) return;
        dragEndRef.current = end;
        setDragSelection({ start, end });
    }, [coordinateFromTouch, game]);

    const finishWordDrag = useCallback(() => {
        const start = dragStartRef.current;
        const end = dragEndRef.current;
        dragStartRef.current = null;
        dragEndRef.current = null;
        if (!start || !end) return;
        if (lineCoordinates(start, end).length < 3) {
            setDragSelection(null);
            setMessage('Touch a letter, drag across the whole word, then release.');
            return;
        }
        submitSelection(start, end);
    }, [submitSelection]);

    const cancelWordDrag = useCallback(() => {
        dragStartRef.current = null;
        dragEndRef.current = null;
        setDragSelection(null);
    }, []);

    const dragPath = useMemo(() => (
        lineCoordinates(dragSelection?.start, dragSelection?.end)
    ), [dragSelection]);
    const dragCellKeys = useMemo(() => new Set(
        dragPath.map(({ row, col }) => `${row}:${col}`),
    ), [dragPath]);
    const dragMatchedWord = useMemo(() => {
        if (!game || dragPath.length < 3) return null;
        const selectedLetters = dragPath
            .map(({ row, col }) => game.grid[row]?.[col] || '')
            .join('');
        const reversedLetters = selectedLetters.split('').reverse().join('');
        return game.words.find(item => (
            !item.foundBy
            && (item.word === selectedLetters || item.word === reversedLetters)
        ))?.word || null;
    }, [dragPath, game]);
    const dragLineStyle = useMemo(() => (
        getWordLineStyle(dragSelection?.start, dragSelection?.end, cellSize)
    ), [cellSize, dragSelection]);
    const foundWordLines = useMemo(() => (game?.words || [])
        .filter(word => word.foundBy && word.start && word.end)
        .map(word => ({
            key: word.word,
            isMine: idOf(word.foundBy) === userId,
            style: getWordLineStyle(word.start, word.end, cellSize),
        }))
        .filter(line => line.style), [cellSize, game?.words, userId]);
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
                <TouchableOpacity style={styles.backButton} onPress={navigation?.goBack} accessibilityLabel="Back" hitSlop={6}>
                    <ChevronLeft size={22} color="#33234A" />
                </TouchableOpacity>
                <View style={styles.headerCopy}>
                    <Text style={styles.headerTitle}>Word Search</Text>
                    <Text style={styles.headerSubtitle}>Find the hidden love words</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.headerSettingsButton}
                        onPress={() => setDifficultyMenuVisible(true)}
                        accessibilityLabel="Game difficulty"
                        hitSlop={6}
                    >
                        <Settings2 size={18} color="#684C88" />
                    </TouchableOpacity>
                    {game?.status === 'active' && (
                        <TouchableOpacity style={styles.newButton} onPress={leaveBoard} hitSlop={6}>
                            <Text style={styles.newButtonText}>New</Text>
                        </TouchableOpacity>
                    )}
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

                    <View
                        style={[
                            styles.board,
                            { width: cellSize * game.gridSize + 12 },
                            !canInteractWithBoard && styles.boardLocked,
                        ]}
                        onStartShouldSetResponderCapture={() => canInteractWithBoard && !submitting}
                        onMoveShouldSetResponderCapture={() => canInteractWithBoard && !submitting}
                        onStartShouldSetResponder={() => canInteractWithBoard && !submitting}
                        onMoveShouldSetResponder={() => canInteractWithBoard && !submitting}
                        onResponderGrant={beginWordDrag}
                        onResponderMove={updateWordDrag}
                        onResponderRelease={finishWordDrag}
                        onResponderTerminate={cancelWordDrag}
                        onResponderTerminationRequest={() => false}
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
                        {dragLineStyle && (
                            <View
                                pointerEvents="none"
                                style={[
                                    styles.wordLine,
                                    dragLineStyle,
                                    dragMatchedWord ? styles.detectedWordLine : styles.dragWordLine,
                                ]}
                            />
                        )}
                        {game.grid.map((rowLetters, row) => (
                            <View key={`row-${row}`} style={styles.boardRow} pointerEvents="none">
                                {rowLetters.split('').map((letter, col) => {
                                    const cellKey = `${row}:${col}`;
                                    const selected = dragCellKeys.has(cellKey);
                                    return (
                                        <View
                                            key={`${row}-${col}`}
                                            style={[
                                                styles.cell,
                                                { width: cellSize, height: cellSize },
                                            ]}
                                        >
                                            <Text style={[
                                                styles.letter,
                                                { fontSize: Math.max(12, cellSize * 0.48) },
                                                selected && styles.selectedLetter,
                                            ]}>{letter}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </View>

                    <Text style={styles.instruction}>
                        {dragMatchedWord
                            ? `${dragMatchedWord} found — release!`
                            : message || (dragSelection
                                ? 'Keep dragging to the final letter'
                                : game.mode === 'duel' && !myTurn
                                    ? `Watch the board — your turn is next in ${formattedTimer}`
                                    : 'Touch, drag across a word, then release')}
                    </Text>

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

            <Modal
                visible={difficultyMenuVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setDifficultyMenuVisible(false)}
            >
                <TouchableOpacity
                    style={styles.settingsBackdrop}
                    activeOpacity={1}
                    onPress={() => setDifficultyMenuVisible(false)}
                >
                    <View
                        style={[styles.settingsSheet, { paddingBottom: insets.bottom + 18 }]}
                        onStartShouldSetResponder={() => true}
                    >
                        <View style={styles.settingsHeader}>
                            <View>
                                <Text style={styles.settingsEyebrow}>GAME SETTINGS</Text>
                                <Text style={styles.settingsTitle}>
                                    {game ? 'Next board difficulty' : 'Choose difficulty'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={styles.settingsClose}
                                onPress={() => setDifficultyMenuVisible(false)}
                            >
                                <X size={20} color="#4A385B" />
                            </TouchableOpacity>
                        </View>
                        {DIFFICULTY_OPTIONS.map(option => {
                            const selected = difficulty === option.id;
                            return (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.settingsOption, selected && styles.settingsOptionSelected]}
                                    onPress={() => {
                                        setDifficulty(option.id);
                                        setDifficultyMenuVisible(false);
                                    }}
                                >
                                    <View>
                                        <Text style={[styles.settingsOptionTitle, selected && styles.settingsOptionTitleSelected]}>
                                            {option.title}
                                        </Text>
                                        <Text style={styles.settingsOptionDetail}>{option.detail}</Text>
                                    </View>
                                    <View style={[styles.settingsRadio, selected && styles.settingsRadioSelected]} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1 },
    flexCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
    loadingText: { fontFamily: fontFamily.medium, color: '#6E6178' },
    header: { paddingHorizontal: 12, paddingBottom: 5, flexDirection: 'row', alignItems: 'center' },
    backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.82)', alignItems: 'center', justifyContent: 'center' },
    headerCopy: { flex: 1, alignItems: 'center' },
    headerTitle: { fontFamily: fontFamily.extraBold, fontSize: 19, lineHeight: 21, color: '#302244' },
    headerSubtitle: { fontFamily: fontFamily.medium, fontSize: 9.5, lineHeight: 12, color: '#887C91' },
    newButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    newButtonText: { fontFamily: fontFamily.bold, color: '#7653C9', fontSize: 12 },
    headerActions: { minWidth: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    headerSettingsButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.82)', alignItems: 'center', justifyContent: 'center' },
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
    settingsBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(43,29,53,0.28)' },
    settingsSheet: { paddingHorizontal: 18, paddingTop: 18, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFF9FE' },
    settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    settingsEyebrow: { fontFamily: fontFamily.extraBold, fontSize: 9.5, letterSpacing: 1, color: '#96859F' },
    settingsTitle: { fontFamily: fontFamily.extraBold, fontSize: 21, color: '#38284B', marginTop: 2 },
    settingsClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1E8F5', alignItems: 'center', justifyContent: 'center' },
    settingsOption: { minHeight: 66, marginBottom: 9, paddingHorizontal: 15, borderRadius: 17, borderWidth: 1.5, borderColor: '#EEE5F1', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settingsOptionSelected: { borderColor: '#64BEAD', backgroundColor: '#F1FCF9' },
    settingsOptionTitle: { fontFamily: fontFamily.extraBold, fontSize: 15, color: '#4A3A53' },
    settingsOptionTitleSelected: { color: '#288D7B' },
    settingsOptionDetail: { fontFamily: fontFamily.medium, fontSize: 10.5, color: '#94899A', marginTop: 3 },
    settingsRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D0C4D5' },
    settingsRadioSelected: { borderWidth: 6, borderColor: '#55B4A3' },
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
    selectedLetter: { color: '#2F2540' },
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

export default WordSearchScreen;
