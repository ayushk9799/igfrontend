// TicTacToeScreen - Real-time partner Tic Tac Toe game
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    Alert,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Easing,
    Platform,
    Image,
    ScrollView,
    useWindowDimensions,
    AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { createSafeAudioPlayer } from '../utils/safeAudioPlayer';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors } from '../theme';
import { fontFamily } from '../constants/fonts';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import { useSocketContext } from '../context/SocketContext';
import { API_BASE } from '../constants/Api';
import { getUser } from '../utils/authStorage';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const FREE_TICTACTOE_GAME_LIMIT = 5;
const TICTACTOE_HYBRID_REMATCH_CAPABILITY = 'hybrid-rematch-v1';
const SparkleStar = ({ size = 20, color = '#EC4899', style }) => (
    <Animated.View style={style}>
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path
                d="M12 2 C12 7.5 16.5 12 22 12 C16.5 12 12 16.5 12 22 C12 16.5 7.5 12 2 12 C7.5 12 12 7.5 12 2 Z"
                fill={color}
            />
        </Svg>
    </Animated.View>
);

const WIN_PATTERNS = [
    [0, 1, 2], // top row
    [3, 4, 5], // middle row
    [6, 7, 8], // bottom row
    [0, 3, 6], // left column
    [1, 4, 7], // middle column
    [2, 5, 8], // right column
    [0, 4, 8], // diagonal
    [2, 4, 6], // anti-diagonal
];

const BOARD_BORDER_WIDTH = 4;

const getCellCenter = (index, cellSize) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = BOARD_BORDER_WIDTH + col * cellSize + cellSize / 2;
    const y = BOARD_BORDER_WIDTH + row * cellSize + cellSize / 2;
    return { x, y };
};

const AnimatedSymbol = ({ value }) => {
    const scaleAnim = useRef(new Animated.Value(0.3)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 60,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.timing(opacityAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start();
    }, [opacityAnim, scaleAnim]);

    return (
        <Animated.View style={[
            styles.animatedSymbol,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
        ]}>
            {value === 'X' ? (
                <Svg width={56} height={56} viewBox="0 0 60 60">
                    <Path
                        d="M16 16 L44 44 M44 16 L16 44"
                        stroke="#EC4899"
                        strokeWidth={7.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </Svg>
            ) : (
                <Svg width={56} height={56} viewBox="0 0 60 60">
                    <Circle
                        cx="30"
                        cy="30"
                        r="18"
                        stroke="#A855F7"
                        strokeWidth={7.5}
                        fill="none"
                        strokeLinecap="round"
                    />
                </Svg>
            )}
        </Animated.View>
    );
};

const TicTacToeScreen = ({
    navigation,
    route,
    onRequestPremium,
    hasPremiumAccess = false,
    onLinkPartner,
}) => {
    const { gameId: initialGameId, gameData: initialGameData } = route?.params || {};
    const { socket, partnerOnline } = useSocketContext();
    const user = getUser();
    const userId = user?.id || user?._id;
    const { width: screenWidth } = useWindowDimensions();
    const boardSize = Math.min(306, screenWidth - 32);
    const cellSize = (boardSize - BOARD_BORDER_WIDTH * 2) / 3;
    const boardLayoutStyle = React.useMemo(() => ({ width: boardSize, height: boardSize }), [boardSize]);
    const cellLayoutStyle = React.useMemo(() => ({ width: cellSize, height: cellSize }), [cellSize]);

    // Game state
    const [gameId, setGameId] = useState(initialGameId || null);
    const [board, setBoard] = useState(Array(9).fill(null));
    const boardRef = useRef(board);
    const [currentTurn, setCurrentTurn] = useState('creator');
    const [gameRound, setGameRound] = useState(initialGameData?.round || 0);
    const [status, setStatus] = useState('pending');
    const [revealGameOverText, setRevealGameOverText] = useState(false);
    const [creatorSymbol, setCreatorSymbol] = useState('X');
    const [partnerSymbol, setPartnerSymbol] = useState('O');
    const [isCreator, setIsCreator] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isGameActionPending, setIsGameActionPending] = useState(false);
    const [notifying, setNotifying] = useState(false);
    const [lastNotifyTime, setLastNotifyTime] = useState(0);
    const [statusMessage, setStatusMessage] = useState(null);
    const [freeLimitReached, setFreeLimitReached] = useState(false);
    const [limitCheckError, setLimitCheckError] = useState('');
    const [checkingPremium, setCheckingPremium] = useState(false);
    const [playAgainReady, setPlayAgainReady] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const statusTimerRef = useRef(null);
    const playAgainTimerRef = useRef(null);
    const countdownIntervalRef = useRef(null);
    const gameActionPendingRef = useRef(false);
    const gameStartingRef = useRef(false);
    const audioPlayerRef = useRef(null);
    const hasRequestedGameReviewRef = useRef(false);
    const mountedRef = useRef(true);
    const checkingPremiumRef = useRef(false);
    const liveCompletionFeedbackRef = useRef(false);
    const statusRef = useRef(status);
    const isCreatorRef = useRef(isCreator);
    const refreshLimitRef = useRef(null);
    const limitSheetGameRef = useRef(null);
    const navigationRef = useRef(navigation);
    const startGameAnimationRef = useRef(null);
    statusRef.current = status;
    isCreatorRef.current = isCreator;

    const requestGameReviewOnce = useCallback(() => {
        if (hasRequestedGameReviewRef.current) return;
        hasRequestedGameReviewRef.current = true;
        requestReviewForMoment(REVIEW_MOMENTS.GAME_COMPLETED);
    }, []);

    // Initialize audio player on mount
    useEffect(() => {
        audioPlayerRef.current = createSafeAudioPlayer();
        return () => {
            if (audioPlayerRef.current) {
                audioPlayerRef.current.stopPlayer().catch(() => {});
            }
        };
    }, []);

    useEffect(() => {
        navigationRef.current = navigation;
    }, [navigation]);

    useEffect(() => {
        boardRef.current = board;
    }, [board]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
            if (playAgainTimerRef.current) clearTimeout(playAgainTimerRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            gameStartingRef.current = false;
        };
    }, []);

    // Show inline status message that auto-clears after 3 seconds
    const showStatus = useCallback((message, type = 'error') => {
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        setStatusMessage({ text: translateUiText(message), type });
        statusTimerRef.current = setTimeout(() => setStatusMessage(null), 3000);
    }, []);

    // Game start animation state
    const [countdown, setCountdown] = useState(0);
    const [isGameStarting, setIsGameStarting] = useState(false);
    const [gameStartMessage, setGameStartMessage] = useState('');
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const linkPartnerShakeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => () => {
        shakeAnim.stopAnimation();
        scaleAnim.stopAnimation();
        fadeAnim.stopAnimation();
        linkPartnerShakeAnim.stopAnimation();
    }, [fadeAnim, scaleAnim, shakeAnim, linkPartnerShakeAnim]);

    const triggerLinkPartnerShake = useCallback(() => {
        ReactNativeHapticFeedback.trigger('notificationWarning', {
            enableVibrateFallback: false,
            ignoreAndroidSystemSettings: false,
        });
        linkPartnerShakeAnim.setValue(0);
        Animated.sequence([
            Animated.timing(linkPartnerShakeAnim, { toValue: 12, duration: 45, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(linkPartnerShakeAnim, { toValue: -12, duration: 45, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(linkPartnerShakeAnim, { toValue: 8, duration: 45, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(linkPartnerShakeAnim, { toValue: -8, duration: 45, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(linkPartnerShakeAnim, { toValue: 4, duration: 45, easing: Easing.linear, useNativeDriver: true }),
            Animated.timing(linkPartnerShakeAnim, { toValue: 0, duration: 45, easing: Easing.linear, useNativeDriver: true }),
        ]).start();
    }, [linkPartnerShakeAnim]);

    // Partner info
    const partnerId = route?.params?.partnerId;
    const partnerName = route?.params?.partnerName || 'Partner';

    // Determine my symbol and if it's my turn
    const mySymbol = isCreator ? creatorSymbol : partnerSymbol;
    const theirSymbol = isCreator ? partnerSymbol : creatorSymbol;
    const isMyTurn = (isCreator && currentTurn === 'creator') || (!isCreator && currentTurn === 'partner');

    // Socket event listeners
    useEffect(() => {
        if (!socket || !gameId) return;

        // Join game room
        socket.emit('tictactoe:join', { gameId });

        // Listen for moves
        const handleMoveReceived = (data) => {
            if (data.gameId && String(data.gameId) === String(gameId)) {
                if (!Array.isArray(data.board)) return;
                const hasNewMove = data.board.some(
                    (value, index) => value && value !== boardRef.current[index]
                );
                boardRef.current = data.board;
                setBoard(data.board);
                setCurrentTurn(data.currentTurn);
                if (
                    ['won_creator', 'won_partner', 'draw'].includes(data.status)
                    && !['won_creator', 'won_partner', 'draw'].includes(statusRef.current)
                ) {
                    liveCompletionFeedbackRef.current = true;
                }
                setStatus(data.status);
                if (Number.isInteger(data.round)) setGameRound(data.round);
                if (hasNewMove) {
                    ReactNativeHapticFeedback.trigger('selection', {
                        enableVibrateFallback: false,
                        ignoreAndroidSystemSettings: false,
                    });
                }
            }
        };

        // Listen for player joined
        const handlePlayerJoined = (data) => {
        };

        // Listen for game complete
        const handleGameComplete = (data) => {
            if (!data.gameId || String(data.gameId) !== String(gameId)) return;
            if (!['won_creator', 'won_partner', 'draw'].includes(statusRef.current)) {
                liveCompletionFeedbackRef.current = true;
            }
            setStatus(data.status);
            requestGameReviewOnce();
            refreshLimitRef.current?.();
        };

        // Listen for new game (Play Again from partner)
        const handleNewGame = (data) => {
            if (data.previousGameId && String(data.previousGameId) !== String(gameId)) return;
            if (!data.gameId) return;
            const participantIds = [data.creatorId?._id || data.creatorId, data.partnerId?._id || data.partnerId]
                .filter(Boolean)
                .map(String);
            if (participantIds.length > 0 && !participantIds.includes(String(userId))) return;
            // Reset to the new game state
            const nextBoard = data.board || Array(9).fill(null);
            setGameId(data.gameId);
            boardRef.current = nextBoard;
            setBoard(nextBoard);
            setCurrentTurn(data.currentTurn || 'creator');
            setStatus(data.status || 'active');
            setGameRound(data.round || 0);
            setCreatorSymbol(data.creatorSymbol || 'X');
            setPartnerSymbol(data.partnerSymbol || 'O');
            // Partner is NOT the creator of this new game
            setIsCreator(String(data.creatorId?._id || data.creatorId) === String(userId));
            hasRequestedGameReviewRef.current = false;
            setRevealGameOverText(false);
            setFreeLimitReached(false);
            setLimitCheckError('');
            setShowConfetti(false);
            liveCompletionFeedbackRef.current = false;
            gameActionPendingRef.current = false;
            setIsGameActionPending(false);
            // Join the new game room
            socket.emit('tictactoe:join', { gameId: data.gameId });
            // Trigger game start animation
            startGameAnimationRef.current?.('Game Started Again! 🎮');
        };

        socket.on('tictactoe:moveReceived', handleMoveReceived);
        socket.on('tictactoe:playerJoined', handlePlayerJoined);
        socket.on('tictactoe:gameComplete', handleGameComplete);
        socket.on('tictactoe:update', handleMoveReceived);
        socket.on('tictactoe:newGame', handleNewGame);

        return () => {
            socket.off('tictactoe:moveReceived', handleMoveReceived);
            socket.off('tictactoe:playerJoined', handlePlayerJoined);
            socket.off('tictactoe:gameComplete', handleGameComplete);
            socket.off('tictactoe:update', handleMoveReceived);
            socket.off('tictactoe:newGame', handleNewGame);
            socket.emit('tictactoe:leave', { gameId });
        };
    }, [socket, gameId, requestGameReviewOnce, userId]);

    // A visible-screen signal is intentionally separate from joining the game
    // room: navigation can keep an off-screen component mounted.
    useEffect(() => {
        if (!socket || !gameId) return;

        const emitActive = () => {
            if (AppState.currentState !== 'active') return;
            socket.emit('tictactoe:screenActive', {
                gameId,
                capability: TICTACTOE_HYBRID_REMATCH_CAPABILITY,
            });
        };
        const emitInactive = () => {
            socket.emit('tictactoe:screenInactive', { gameId });
        };
        const handleAppStateChange = nextState => {
            if (nextState === 'active') emitActive();
            else emitInactive();
        };

        emitActive();
        socket.on('connect', emitActive);
        const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            emitInactive();
            socket.off('connect', emitActive);
            appStateSubscription.remove();
        };
    }, [socket, gameId]);

    // Game start animation function
    const startGameAnimation = useCallback((message) => {
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }
        setGameStartMessage(translateUiText(message));
        gameStartingRef.current = true;
        setIsGameStarting(true);
        setCountdown(3);

        // Fade in the message
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();

        // Start shake animation loop
        const shake = () => {
            Animated.sequence([
                Animated.timing(shakeAnim, {
                    toValue: 10,
                    duration: 50,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnim, {
                    toValue: -10,
                    duration: 100,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnim, {
                    toValue: 10,
                    duration: 100,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
                Animated.timing(shakeAnim, {
                    toValue: 0,
                    duration: 50,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }),
            ]).start();
        };

        // Scale pulse animation
        const pulse = () => {
            Animated.sequence([
                Animated.timing(scaleAnim, {
                    toValue: 1.05,
                    duration: 150,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 150,
                    useNativeDriver: true,
                }),
            ]).start();
        };

        // Countdown with animations
        shake();
        pulse();

        countdownIntervalRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                    // Fade out and end animation
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }).start(() => {
                        gameStartingRef.current = false;
                        setIsGameStarting(false);
                        setGameStartMessage('');
                    });
                    return 0;
                }
                shake();
                pulse();
                return prev - 1;
            });
        }, 1000);
    }, [fadeAnim, shakeAnim, scaleAnim]);

    useEffect(() => {
        startGameAnimationRef.current = startGameAnimation;
    }, [startGameAnimation]);

    const loadGameFromData = useCallback((data) => {
        setGameId(data._id || data.gameId);
        const nextBoard = data.board || Array(9).fill(null);
        boardRef.current = nextBoard;
        setBoard(nextBoard);
        setCurrentTurn(data.currentTurn || 'creator');
        setStatus(data.status || 'pending');
        setGameRound(data.round || 0);
        setCreatorSymbol(data.creatorSymbol || 'X');
        setPartnerSymbol(data.partnerSymbol || 'O');
        setIsCreator(
            String(data.creatorId?._id || data.creatorId) === String(userId)
        );
        setRevealGameOverText(['won_creator', 'won_partner', 'draw'].includes(data.status));
        setLoading(false);
    }, [userId]);

    const fetchCompletedGames = useCallback(async () => {
        const response = await fetch(
            `${API_BASE}/api/tictactoe/history/${userId}?limit=${FREE_TICTACTOE_GAME_LIMIT}`
        );
        const data = await response.json();

        if (!response.ok || !data.success || !Array.isArray(data.data)) {
            throw new Error(data.message || 'Failed to check completed games');
        }

        return {
            games: data.data,
            completedGames: Number.isFinite(data.completedGames)
                ? data.completedGames
                : data.data.length,
        };
    }, [userId]);

    const refreshFreeLimitStatus = useCallback(async ({ showLimitSheet = false } = {}) => {
        setLimitCheckError('');
        const history = await fetchCompletedGames();
        const limitReached = history.completedGames >= FREE_TICTACTOE_GAME_LIMIT;
        if (mountedRef.current) {
            setFreeLimitReached(limitReached);
            const limitKey = String(gameId || 'tictactoe-limit');
            if (
                showLimitSheet
                && limitReached
                && limitSheetGameRef.current !== limitKey
            ) {
                limitSheetGameRef.current = limitKey;
                onRequestPremium?.();
            }
        }
        return history;
    }, [fetchCompletedGames, gameId, onRequestPremium]);

    useEffect(() => {
        refreshLimitRef.current = () => {
            refreshFreeLimitStatus({ showLimitSheet: true }).catch(() => {
                if (mountedRef.current) {
                    setLimitCheckError('Couldn’t verify your free-game limit.');
                }
            });
        };
    }, [refreshFreeLimitStatus]);

    const loadGameWithAccessCheck = useCallback(async (data) => {
        if (hasPremiumAccess || !userId) {
            setFreeLimitReached(false);
            setLimitCheckError('');
            loadGameFromData(data);
            return;
        }

        try {
            const history = await fetchCompletedGames();
            if (!mountedRef.current) return;

            if (
                ['pending', 'in_progress'].includes(data?.status)
                && history.completedGames >= FREE_TICTACTOE_GAME_LIMIT
                && history.games[0]
            ) {
                setFreeLimitReached(true);
                setLimitCheckError('');
                loadGameFromData(history.games[0]);
                return;
            }

            setFreeLimitReached(
                history.completedGames >= FREE_TICTACTOE_GAME_LIMIT
            );
            setLimitCheckError('');
            loadGameFromData(data);
        } catch (error) {
            if (!mountedRef.current) return;
            setLimitCheckError('Couldn’t verify your free-game limit.');
            loadGameFromData(data);
        }
    }, [fetchCompletedGames, hasPremiumAccess, loadGameFromData, userId]);

    const fetchActiveGame = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            setStatus('new');
            return;
        }
        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/active/${userId}`);
            const data = await response.json();

            if (data.success && data.data) {
                await loadGameWithAccessCheck(data.data);
            } else {
                if (!hasPremiumAccess) {
                    try {
                        const history = await fetchCompletedGames();
                        if (!mountedRef.current) return;

                        if (
                            history.completedGames >= FREE_TICTACTOE_GAME_LIMIT
                            && history.games[0]
                        ) {
                            setFreeLimitReached(true);
                            setLimitCheckError('');
                            loadGameFromData(history.games[0]);
                            return;
                        }
                    } catch (historyError) {
                        if (!mountedRef.current) return;
                        setLimitCheckError('Unable to check your free games. Tap below to retry.');
                        setFreeLimitReached(false);
                    }
                }

                setLoading(false);
                setGameId(null);
                setBoard(Array(9).fill(null));
                setIsCreator(true);
                setStatus('new'); // Special status for new game
            }
        } catch (error) {
            console.error('Error fetching active game:', error);
            setLoading(false);
            setGameId(null);
            setBoard(Array(9).fill(null));
            setStatus('new');
        }
    }, [
        fetchCompletedGames,
        hasPremiumAccess,
        loadGameFromData,
        loadGameWithAccessCheck,
        userId,
    ]);

    const fetchGame = useCallback(async (id) => {
        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/${id}`);
            const data = await response.json();
            if (data.success) {
                await loadGameWithAccessCheck(data.data);
            } else {
                showStatus('Failed to load game');
                navigationRef.current?.goBack?.();
            }
        } catch (error) {
            console.error('Fetch game error:', error);
            showStatus('Failed to load game');
            navigationRef.current?.goBack?.();
        }
    }, [loadGameWithAccessCheck, showStatus]);

    useEffect(() => {
        if (initialGameData) {
            loadGameWithAccessCheck(initialGameData);
        } else if (initialGameId) {
            fetchGame(initialGameId);
        } else {
            fetchActiveGame();
        }
    }, [fetchActiveGame, fetchGame, initialGameData, initialGameId, loadGameWithAccessCheck]);

    useEffect(() => {
        const gameOver = ['won_creator', 'won_partner', 'draw'].includes(status);
        setPlayAgainReady(false);
        if (playAgainTimerRef.current) clearTimeout(playAgainTimerRef.current);

        if (gameOver) {
            playAgainTimerRef.current = setTimeout(() => {
                if (mountedRef.current) setPlayAgainReady(true);
            }, 800);
        }

        return () => {
            if (playAgainTimerRef.current) clearTimeout(playAgainTimerRef.current);
        };
    }, [status]);

    useEffect(() => {
        if (hasPremiumAccess) {
            setFreeLimitReached(false);
            setLimitCheckError('');
        }
    }, [hasPremiumAccess]);

    // Create game with first move (called when tapping first cell)
    const createGameWithFirstMove = async (position) => {
        if (!userId || !partnerId) {
            triggerLinkPartnerShake();
            return;
        }

        // Optimistic update
        const newBoard = [...board];
        newBoard[position] = 'X'; // Creator is always X
        boardRef.current = newBoard;
        setBoard(newBoard);
        ReactNativeHapticFeedback.trigger('selection', {
            enableVibrateFallback: false,
            ignoreAndroidSystemSettings: false,
        });

        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creatorId: userId,
                    partnerId: partnerId,
                    creatorSymbol: 'X',
                    firstMove: position, // Include first move position
                }),
            });
            const data = await response.json();

            if (data.success) {
                setGameId(data.data.gameId);
                setBoard(data.data.board);
                setCurrentTurn(data.data.currentTurn);
                setStatus(data.data.status);
                setGameRound(data.data.round || 0);
                setCreatorSymbol(data.data.creatorSymbol);
                setPartnerSymbol(data.data.partnerSymbol);
                setIsCreator(data.data.isCreator !== undefined ? data.data.isCreator : true);

                // Join socket room
                if (socket) {
                    socket.emit('tictactoe:join', { gameId: data.data.gameId });
                    socket.emit('tictactoe:invite', { gameId: data.data.gameId });

                    // Broadcast the move
                    socket.emit('tictactoe:move', {
                        gameId: data.data.gameId,
                        position,
                        board: data.data.board,
                        currentTurn: data.data.currentTurn,
                        status: data.data.status,
                    });
                }

                // If it's an existing game (not what we expected), show alert
                if (data.isExisting) {
                    showStatus('An active game already exists. Loading it now.', 'info');
                }
            } else {
                // Revert optimistic update
                const emptyBoard = Array(9).fill(null);
                boardRef.current = emptyBoard;
                setBoard(emptyBoard);
                if (data.code === 'TICTACTOE_FREE_LIMIT_REACHED') {
                    setFreeLimitReached(true);
                    onRequestPremium?.();
                    setLoading(true);
                    fetchActiveGame();
                    return;
                }
                showStatus(data.message || 'Failed to create game');
            }
        } catch (error) {
            const emptyBoard = Array(9).fill(null);
            boardRef.current = emptyBoard;
            setBoard(emptyBoard);
            console.error('Create game error:', error);
            showStatus('Failed to create game');
        }
    };

    const restartCurrentGame = async () => {
        if (
            !mountedRef.current
            || !userId
            || !gameId
            || gameStartingRef.current
            || gameActionPendingRef.current
        ) return;

        gameActionPendingRef.current = true;
        setIsGameActionPending(true);

        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/${gameId}/restart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    rematchCapability: TICTACTOE_HYBRID_REMATCH_CAPABILITY,
                    round: gameRound,
                }),
            });
            const data = await response.json();
            if (!mountedRef.current) return;

            if (!response.ok || !data.success) {
                if (data.code === 'TICTACTOE_FREE_LIMIT_REACHED') {
                    setFreeLimitReached(true);
                    setLimitCheckError('');
                    onRequestPremium?.();
                    return;
                }
                if (response.status === 409) {
                    await fetchGame(gameId);
                    showStatus('Your partner already started the next game.', 'info');
                    return;
                }
                showStatus(data.message || 'Failed to restart game');
                return;
            }

            const restartedGame = data.data;
            boardRef.current = restartedGame.board;
            setBoard(restartedGame.board);
            setCurrentTurn(restartedGame.currentTurn);
            setStatus(restartedGame.status);
            setGameRound(restartedGame.round);
            setCreatorSymbol(restartedGame.creatorSymbol);
            setPartnerSymbol(restartedGame.partnerSymbol);
            setIsCreator(String(restartedGame.creatorId) === String(userId));
            setRevealGameOverText(false);
            setFreeLimitReached(false);
            setLimitCheckError('');
            setShowConfetti(false);
            liveCompletionFeedbackRef.current = false;
            hasRequestedGameReviewRef.current = false;

            if (socket) {
                socket.emit('tictactoe:newGame', {
                    gameId: restartedGame.gameId,
                    previousGameId: gameId,
                    creatorId: restartedGame.creatorId,
                    partnerId: restartedGame.partnerId,
                    board: restartedGame.board,
                    currentTurn: restartedGame.currentTurn,
                    status: restartedGame.status,
                    round: restartedGame.round,
                    creatorSymbol: restartedGame.creatorSymbol,
                    partnerSymbol: restartedGame.partnerSymbol,
                });
            }

            startGameAnimation('Game restarted! 🎮');
            showStatus('Game restarted', 'success');
        } catch (error) {
            console.error('Restart game error:', error);
            showStatus('Failed to restart game');
        } finally {
            gameActionPendingRef.current = false;
            setIsGameActionPending(false);
        }
    };

    const handlePlayAgain = async () => {
        if (
            !playAgainReady
            || checkingPremiumRef.current
            || gameActionPendingRef.current
        ) return;

        if (hasPremiumAccess || !onRequestPremium || !userId) {
            restartCurrentGame();
            return;
        }

        checkingPremiumRef.current = true;
        setCheckingPremium(true);

        try {
            const history = await refreshFreeLimitStatus();
            if (!mountedRef.current) return;

            if (history.completedGames >= FREE_TICTACTOE_GAME_LIMIT) {
                setFreeLimitReached(true);
                onRequestPremium();
                return;
            }

            restartCurrentGame();
        } catch (error) {
            if (mountedRef.current) {
                setLimitCheckError('Unable to check your free games. Please try again.');
            }
        } finally {
            checkingPremiumRef.current = false;
            if (mountedRef.current) setCheckingPremium(false);
        }
    };

    const retryFreeLimitCheck = async () => {
        if (checkingPremiumRef.current) return;
        checkingPremiumRef.current = true;
        setCheckingPremium(true);

        try {
            await refreshFreeLimitStatus();
        } catch (error) {
            if (mountedRef.current) {
                setLimitCheckError('Unable to check your free games. Please try again.');
            }
        } finally {
            checkingPremiumRef.current = false;
            if (mountedRef.current) setCheckingPremium(false);
        }
    };

    const handleRestartPress = () => {
        if (gameStartingRef.current || isGameActionPending) return;
        if (isGameOver) {
            handlePlayAgain();
            return;
        }

        Alert.alert(
            translateUiText("Restart this game?"),
            translateUiText("This will clear the current board for both you and your partner."),
            [
                { text: translateUiText("Cancel"), style: 'cancel' },
                {
                    text: translateUiText("Restart"),
                    style: 'destructive',
                    onPress: restartCurrentGame,
                },
            ]
        );
    };

    const makeMove = async (position) => {
        if (!partnerId) {
            triggerLinkPartnerShake();
            return;
        }

        // Block moves during game start animation
        if (!userId || isGameStarting || gameActionPendingRef.current) return;

        // If no game exists yet (status is 'new'), create game with first move
        if (!gameId && status === 'new') {
            gameActionPendingRef.current = true;
            setIsGameActionPending(true);
            try {
                await createGameWithFirstMove(position);
            } finally {
                gameActionPendingRef.current = false;
                setIsGameActionPending(false);
            }
            return;
        }

        if (!isMyTurn || board[position] !== null || isGameOver) return;

        // Optimistic update
        const newBoard = [...board];
        newBoard[position] = mySymbol;
        boardRef.current = newBoard;
        setBoard(newBoard);
        gameActionPendingRef.current = true;
        setIsGameActionPending(true);
        ReactNativeHapticFeedback.trigger('selection', {
            enableVibrateFallback: false,
            ignoreAndroidSystemSettings: false,
        });

        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/${gameId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    position,
                    round: gameRound,
                }),
            });
            const data = await response.json();
            if (data.success) {
                if (data.data.gameComplete) {
                    liveCompletionFeedbackRef.current = true;
                }
                setBoard(data.data.board);
                setCurrentTurn(data.data.currentTurn);
                setStatus(data.data.status);
                setGameRound(data.data.round);

                // Broadcast move via socket
                if (socket) {
                    socket.emit('tictactoe:move', {
                        gameId,
                        position,
                        board: data.data.board,
                        currentTurn: data.data.currentTurn,
                        status: data.data.status,
                        round: data.data.round,
                        winner: data.data.winner,
                        gameComplete: data.data.gameComplete,
                    });

                    if (data.data.gameComplete) {
                        requestGameReviewOnce();
                        socket.emit('tictactoe:complete', {
                            gameId,
                            status: data.data.status,
                            winnerId: data.data.winner,
                        });
                    }
                }

                if (data.data.gameComplete && !hasPremiumAccess) {
                    try {
                        await refreshFreeLimitStatus({ showLimitSheet: true });
                    } catch (historyError) {
                        if (mountedRef.current) {
                            setLimitCheckError('Couldn’t verify your free-game limit.');
                        }
                    }
                }
            } else {
                if (data.code === 'TICTACTOE_FREE_LIMIT_REACHED') {
                    setBoard(board);
                    boardRef.current = board;
                    setFreeLimitReached(true);
                    setLimitCheckError('');
                    onRequestPremium?.();
                    setLoading(true);
                    fetchActiveGame();
                    return;
                }
                if (response.status === 409) {
                    await fetchGame(gameId);
                    showStatus('The game was restarted. The board has been refreshed.', 'info');
                    return;
                }
                // Revert optimistic update
                setBoard((currentBoard) => currentBoard === newBoard ? board : currentBoard);
                showStatus(data.message || 'Invalid move');
            }
        } catch (error) {
            setBoard((currentBoard) => currentBoard === newBoard ? board : currentBoard);
            console.error('Move error:', error);
            showStatus('Could not make that move. Please try again.');
        } finally {
            gameActionPendingRef.current = false;
            setIsGameActionPending(false);
        }
    };

    const notifyPartner = async () => {
        if (!userId || !gameId) return;
        // Cooldown check (5 minutes)
        const now = Date.now();
        if (now - lastNotifyTime < 5 * 60 * 1000) {
            const remaining = Math.ceil((5 * 60 * 1000 - (now - lastNotifyTime)) / 60000);
            showStatus(translateUiTemplate("You can notify again in {{0}} minute(s)", [remaining]), 'info');
            return;
        }

        setNotifying(true);
        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/${gameId}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const data = await response.json();
            if (data.success) {
                setLastNotifyTime(now);
                showStatus(translateUiTemplate("{{0}} has been notified ✓", [partnerName]), 'success');
            } else {
                showStatus('Failed to send notification');
            }
        } catch (error) {
            showStatus('Failed to send notification');
        } finally {
            setNotifying(false);
        }
    };


    const isGameOver = ['won_creator', 'won_partner', 'draw'].includes(status);
    const isNewGame = status === 'new';
    const didIWin = (isCreator && status === 'won_creator') || (!isCreator && status === 'won_partner');
    const didTheyWin = (isCreator && status === 'won_partner') || (!isCreator && status === 'won_creator');

    const leftActive = isMyTurn && !isGameOver;
    const leftSymbolSize = leftActive ? 52 : 34;
    const leftSymbolOpacity = leftActive || isGameOver ? 1.0 : 0.55;

    const rightActive = !isMyTurn && !isGameOver;
    const rightSymbolSize = rightActive ? 52 : 34;
    const rightSymbolOpacity = rightActive || isGameOver ? 1.0 : 0.55;

    const getStatusText = () => {
        if (loading) return translateUiText("Loading...");
        if (isGameStarting) return `${gameStartMessage}\n${countdown > 0 ? countdown : translateUiText("GO!")}`;
        if (isNewGame) return translateUiText("Tap to start game!");
        if (status === 'draw') return translateUiText("It's a draw! 🤝");
        if (didIWin) return translateUiText("🎉 You won! 💜");
        if (didTheyWin) return translateUiTemplate("🎉 {{0}} won! 💜", [partnerName]);
        return isMyTurn ? translateUiText("Your turn") : translateUiTemplate("{{0}}'s turn", [partnerName]);
    };

    const winningLine = React.useMemo(() => {
        if (!['won_creator', 'won_partner'].includes(status)) return [];
        for (const pattern of WIN_PATTERNS) {
            const [a, b, c] = pattern;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return pattern;
            }
        }
        return [];
    }, [board, status]);

    const lineAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const gameOverTextAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.12,
                    duration: 900,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0.92,
                    duration: 900,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                })
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [pulseAnim]);

    useEffect(() => {
        if (isGameOver && (revealGameOverText || status === 'draw')) {
            gameOverTextAnim.setValue(0);
            Animated.spring(gameOverTextAnim, {
                toValue: 1,
                tension: 45,
                friction: 5.5,
                useNativeDriver: true,
            }).start();
        } else {
            gameOverTextAnim.setValue(0);
        }
    }, [revealGameOverText, isGameOver, status, gameOverTextAnim]);

    const playResultSound = useCallback(async () => {
        try {
            if (!audioPlayerRef.current) return;
            await audioPlayerRef.current.stopPlayer().catch(() => {});
            const soundAsset = require('../../assets/sounds/result.mp3');
            const soundUri = Image.resolveAssetSource(soundAsset).uri;
            await audioPlayerRef.current.startPlayer(soundUri);
            await audioPlayerRef.current.setVolume(1.0);
        } catch (error) {
            console.error('Failed to play result sound:', error);
        }
    }, []);

    useEffect(() => {
        if (winningLine.length > 0) {
            const shouldCelebrate = liveCompletionFeedbackRef.current;
            liveCompletionFeedbackRef.current = false;
            lineAnim.setValue(0);
            setRevealGameOverText(false);

            if (shouldCelebrate) {
                playResultSound();
                const localPlayerWon = (
                    isCreatorRef.current && statusRef.current === 'won_creator'
                ) || (
                    !isCreatorRef.current && statusRef.current === 'won_partner'
                );
                setShowConfetti(localPlayerWon);
            }

            Animated.timing(lineAnim, {
                toValue: 1,
                duration: 1000,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) {
                    setRevealGameOverText(true);
                }
            });
        } else {
            lineAnim.setValue(0);
            setRevealGameOverText(false);
            if (audioPlayerRef.current) {
                audioPlayerRef.current.stopPlayer().catch(() => {});
            }
        }
    }, [lineAnim, winningLine, playResultSound]);

    const lineData = React.useMemo(() => {
        if (winningLine.length === 0) return { startX: 0, startY: 0, length: 0, angle: '0rad', originalLength: 0, padding: 0 };
        const startCenter = getCellCenter(winningLine[0], cellSize);
        const endCenter = getCellCenter(winningLine[2], cellSize);
        const dx = endCenter.x - startCenter.x;
        const dy = endCenter.y - startCenter.y;
        const originalLength = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        const padding = 28; // Beautiful extra length at each end!
        
        return { 
            startX: startCenter.x, 
            startY: startCenter.y, 
            length: originalLength + padding * 2, 
            angle: `${angle}rad`,
            originalLength,
            padding
        };
    }, [cellSize, winningLine]);

    const winningLineAnchorStyle = React.useMemo(() => ({
        left: lineData.startX,
        top: lineData.startY,
        transform: [{ rotate: lineData.angle }],
    }), [lineData.angle, lineData.startX, lineData.startY]);

    const winningLineBarStyle = React.useMemo(() => ({
        left: -lineData.padding,
        width: lineData.length,
        transform: [
            {
                translateX: lineAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-lineData.length / 2, 0],
                }),
            },
            { scaleX: lineAnim },
        ],
    }), [lineAnim, lineData.length, lineData.padding]);

    const winningLineStartSparkleStyle = React.useMemo(() => ({
        left: -lineData.padding - 11,
        opacity: lineAnim.interpolate({
            inputRange: [0, 0.8, 1],
            outputRange: [0, 0, 1],
            extrapolate: 'clamp',
        }),
        transform: [{
            scale: lineAnim.interpolate({
                inputRange: [0, 0.8, 1],
                outputRange: [0, 0, 1],
                extrapolate: 'clamp',
            }),
        }],
    }), [lineAnim, lineData.padding]);

    const winningLineEndSparkleStyle = React.useMemo(() => ({
        left: lineData.length - lineData.padding - 11,
        opacity: lineAnim.interpolate({
            inputRange: [0, 0.8, 1],
            outputRange: [0, 0, 1],
            extrapolate: 'clamp',
        }),
        transform: [{
            scale: lineAnim.interpolate({
                inputRange: [0, 0.8, 1],
                outputRange: [0, 0, 1],
                extrapolate: 'clamp',
            }),
        }],
    }), [lineAnim, lineData.length, lineData.padding]);

    const renderCell = (index) => {
        const value = board[index];

        // Allow tapping if: new game OR (my turn AND cell empty AND game not over)
        const canTap = !isGameActionPending
            && !freeLimitReached
            && !limitCheckError
            && (isNewGame || (isMyTurn && value === null && !isGameOver));

        const cellOpacity = 1;

        return (
            <Animated.View
                key={index}
                style={[
                    styles.cell,
                    cellLayoutStyle,
                    index % 2 === 0 && styles.cellAlternate,
                    index % 3 !== 2 && styles.cellBorderRight,
                    index < 6 && styles.cellBorderBottom,
                    { opacity: cellOpacity }
                ]}
            >
                <TouchableOpacity
                    onPress={() => makeMove(index)}
                    disabled={!canTap}
                    activeOpacity={0.7}
                    style={styles.cellButton}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiTemplate("Row {{0}}, column {{1}}{{2}}", [Math.floor(index / 3) + 1, (index % 3) + 1, value ? `, ${value}` : ', empty'])}
                    accessibilityState={{ disabled: !canTap }}
                >
                    {value !== null && (
                        <AnimatedSymbol value={value} />
                    )}
                </TouchableOpacity>
            </Animated.View>
        );
    };

    if (loading) {
        return (
            <GradientBackground variant="light" showOrbs={true} showParticles={true}>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>{translateUiText("Setting up game...")}</Text>
                    </View>
                </SafeAreaView>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground variant="light" showOrbs={true} showParticles={true}>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigationRef.current?.goBack?.()}
                            accessibilityRole="button"
                            accessibilityLabel={translateUiText("Back to games")}
                        >
                            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M15 18l-6-6 6-6"
                                    stroke="#1B1237"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </Svg>
                        </TouchableOpacity>
                        <View style={styles.headerCopy}>
                            <Text style={styles.headerTitle} numberOfLines={1}>{translateUiText("Tic Tac Toe")}</Text>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        {partnerOnline ? (
                            <View style={styles.onlineIndicator}>
                                <View style={styles.onlineDot} />
                                <Text style={styles.onlineText}>{translateUiText("Online")}</Text>
                            </View>
                        ) : (
                            <View style={styles.offlineIndicator}>
                                <View style={styles.offlineDot} />
                                <Text style={styles.offlineText}>{translateUiText("Offline")}</Text>
                            </View>
                        )}
                        {gameId && !isGameOver && (
                            <TouchableOpacity
                                style={[
                                    styles.restartButton,
                                    (!partnerId || isGameStarting || isGameActionPending) && styles.restartButtonDisabled,
                                ]}
                                onPress={handleRestartPress}
                                disabled={!partnerId || isGameStarting || isGameActionPending}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel={translateUiText("Restart game")}
                                accessibilityState={{
                                    disabled: !partnerId || isGameStarting || isGameActionPending,
                                }}
                            >
                                {isGameActionPending ? (
                                    <ActivityIndicator size="small" color="#7C3AED" />
                                ) : (
                                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M20 7V3m0 0h-4m4 0-3.1 3.1A8 8 0 1 0 20 12"
                                            stroke="#7C3AED"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </Svg>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Player Info */}
                <View style={styles.playersContainer}>
                    {/* Left Card: YOU */}
                    <View style={[styles.playerCard, leftActive && styles.activePlayer]}>
                        {leftActive && (
                            <>
                                <SparkleStar size={11} color="#C084FC" style={styles.playerSparkleLeft} />
                                <SparkleStar size={9} color="#C084FC" style={styles.playerSparkleRight} />
                            </>
                        )}
                        <Animated.View style={[styles.cardSymbolContainer, { opacity: leftSymbolOpacity, transform: leftActive ? [{ scale: pulseAnim }] : [{ scale: 1.0 }] }]}>
                            {mySymbol === 'O' ? (
                                <Svg width={leftSymbolSize} height={leftSymbolSize} viewBox="0 0 42 42">
                                    <Circle cx="21" cy="21" r="13" stroke="#A855F7" strokeWidth="6.5" fill="none" />
                                </Svg>
                            ) : (
                                <Svg width={leftSymbolSize} height={leftSymbolSize} viewBox="0 0 42 42">
                                    <Path d="M11 11 L31 31 M31 11 L11 31" stroke="#EC4899" strokeWidth="6.5" strokeLinecap="round" />
                                </Svg>
                            )}
                        </Animated.View>
                        <View style={[styles.playerLabel, leftActive && styles.activePlayerLabel]}>
                            <Text style={[styles.playerLabelText, leftActive && styles.activePlayerLabelText]}>
                                {leftActive ? translateUiText("YOUR TURN") : translateUiText("YOU")}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.vsBadge}>
                        <Text style={styles.vsBadgeText}>{translateUiText("vs")}</Text>
                    </View>

                    {/* Right Card: Partner */}
                    <View style={[styles.playerCard, rightActive && styles.activePlayer]}>
                        {rightActive && (
                            <>
                                <SparkleStar size={11} color="#C084FC" style={styles.playerSparkleLeft} />
                                <SparkleStar size={9} color="#C084FC" style={styles.playerSparkleRight} />
                            </>
                        )}
                        <Animated.View style={[styles.cardSymbolContainer, { opacity: rightSymbolOpacity, transform: rightActive ? [{ scale: pulseAnim }] : [{ scale: 1.0 }] }]}>
                            {theirSymbol === 'O' ? (
                                <Svg width={rightSymbolSize} height={rightSymbolSize} viewBox="0 0 42 42">
                                    <Circle cx="21" cy="21" r="13" stroke="#A855F7" strokeWidth="6.5" fill="none" />
                                </Svg>
                            ) : (
                                <Svg width={rightSymbolSize} height={rightSymbolSize} viewBox="0 0 42 42">
                                    <Path d="M11 11 L31 31 M31 11 L11 31" stroke="#EC4899" strokeWidth="6.5" strokeLinecap="round" />
                                </Svg>
                            )}
                        </Animated.View>
                        <Text style={styles.partnerNameText} numberOfLines={1}>{partnerName}</Text>
                        {rightActive && (
                            <View style={[styles.playerLabel, styles.activePlayerLabel]}>
                                <Text style={[styles.playerLabelText, styles.activePlayerLabelText]}>{translateUiText("THEIR TURN")}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Status */}
                <View style={styles.statusContainer}>
                    <View style={[
                        styles.statusEyebrow,
                        isMyTurn && !isGameOver && styles.statusEyebrowActive,
                    ]}>
                        <View style={[
                            styles.statusDot,
                            isMyTurn && !isGameOver && styles.statusDotActive,
                        ]} />
                        <Text style={[
                            styles.statusEyebrowText,
                            isMyTurn && !isGameOver && styles.statusEyebrowTextActive,
                        ]}>
                            {isGameOver ? translateUiText("MATCH COMPLETE") : isMyTurn ? translateUiText("MAKE YOUR MOVE") : translateUiText("WAITING FOR PARTNER")}
                        </Text>
                    </View>
                    {isGameOver && (revealGameOverText || status === 'draw') ? (
                        <Animated.View
                            style={{
                                opacity: gameOverTextAnim,
                                transform: [
                                    { scale: gameOverTextAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.4, 1.0]
                                    }) },
                                    { translateY: gameOverTextAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [25, 0]
                                    }) },
                                    { rotate: gameOverTextAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['-8deg', '0deg']
                                    }) }
                                ]
                            }}
                        >
                            <Text style={[
                                styles.statusText,
                                didIWin ? styles.statusWin : didTheyWin ? styles.statusLose : styles.statusDraw
                            ]}>
                                {getStatusText()}
                            </Text>
                        </Animated.View>
                    ) : (
                        <Text style={[
                            styles.statusText,
                            isGameStarting && styles.statusGameStarting
                        ]}>
                            {getStatusText()}
                        </Text>
                    )}
                    {statusMessage && (
                        <Text style={[
                            styles.inlineStatus,
                            statusMessage.type === 'success' && styles.inlineStatusSuccess,
                            statusMessage.type === 'info' && styles.inlineStatusInfo,
                        ]}>
                            {statusMessage.text}
                        </Text>
                    )}
                </View>

                {/* Game Board */}
                <View style={styles.boardContainer}>
                    <Animated.View style={[
                        styles.board,
                        boardLayoutStyle,
                        {
                            transform: [
                                { translateX: shakeAnim },
                                { scale: scaleAnim }
                            ]
                        }
                    ]}>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(renderCell)}

                        {winningLine.length > 0 && (
                            <Animated.View
                                pointerEvents="none"
                                style={[styles.winningLineAnchor, winningLineAnchorStyle]}
                            >
                                <Animated.View
                                    style={[styles.winningLineBar, winningLineBarStyle]}
                                >
                                    {/* Neon Outer Halo Glow */}
                                    <View style={styles.winningLineGlow} />
                                    {/* Bright White Core */}
                                    <View style={styles.winningLineCore} />
                                </Animated.View>
                                <SparkleStar
                                    size={22}
                                    color="#F472B6"
                                    style={[styles.winningLineSparkle, winningLineStartSparkleStyle]}
                                />
                                <SparkleStar
                                    size={22}
                                    color="#F472B6"
                                    style={[styles.winningLineSparkle, winningLineEndSparkleStyle]}
                                />
                            </Animated.View>
                        )}
                    </Animated.View>

                    {isGameOver && (revealGameOverText || status === 'draw') && (
                        <View style={styles.boardGameOverButtons}>
                            <TouchableOpacity
                                onPress={handlePlayAgain}
                                activeOpacity={0.8}
                                style={[
                                    styles.restartGameButton,
                                    (isGameActionPending || checkingPremium || !playAgainReady)
                                        && styles.restartGameButtonDisabled,
                                ]}
                                disabled={isGameActionPending || checkingPremium || !playAgainReady}
                                accessibilityRole="button"
                                accessibilityLabel={translateUiText("Play again")}
                                accessibilityState={{
                                    disabled: isGameActionPending || checkingPremium || !playAgainReady,
                                }}
                            >
                                {isGameActionPending || checkingPremium ? (
                                    <ActivityIndicator color="#D84F86" />
                                ) : (
                                    <Text style={styles.restartGameButtonText}>{translateUiText("Play Again")}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Link Partner Button - shown directly below the board when no partner is linked */}
                    {!partnerId && (
                        <Animated.View
                            style={[
                                styles.linkPartnerContainer,
                                { transform: [{ translateX: linkPartnerShakeAnim }] },
                            ]}
                        >
                            <Button
                                title={translateUiText("Link Partner to Play")}
                                onPress={() => {
                                    if (onLinkPartner) {
                                        onLinkPartner();
                                    } else if (navigation?.navigate) {
                                        navigation.navigate('partnerCode');
                                    }
                                }}
                                variant="primary"
                                size="xl"
                                fullWidth
                            />
                        </Animated.View>
                    )}
                </View>

                {limitCheckError && (
                    <TouchableOpacity
                        style={styles.limitCheckError}
                        onPress={retryFreeLimitCheck}
                        activeOpacity={0.8}
                        disabled={checkingPremium}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText("Retry free-game limit check")}
                    >
                        <Text style={styles.limitCheckErrorText}>
                                    {translateUiTemplate("{{0}} Tap to retry.", [translateUiText(limitCheckError)])}</Text>
                    </TouchableOpacity>
                )}

                {/* Bottom Actions Container - fixed height to prevent layout shift */}
                <View style={styles.bottomActionsContainer}>
                    {!isGameOver && gameId && !(isMyTurn || partnerOnline) ? (
                        <View style={styles.notifyButtonContainer}>
                            <Button
                                title={translateUiTemplate("Nudge {{0}}", [partnerName])}
                                onPress={notifyPartner}
                                variant="primary"
                                size="md"
                                fullWidth
                                gradientColors={['#FF5E97', '#FFA1C9']}
                                disabled={notifying}
                                loading={notifying}
                                leftIcon={
                                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M18 8A6 6 0 106 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                                            stroke="#FFFFFF"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </Svg>
                                }
                                style={styles.nudgeButton}
                            />
                        </View>
                    ) : null}
                </View>
                </ScrollView>

                {showConfetti && (
                    <ConfettiCannon
                        count={150}
                        origin={{ x: screenWidth / 2, y: -20 }}
                        autoStart={true}
                        fadeOut={true}
                        onAnimationEnd={() => setShowConfetti(false)}
                    />
                )}
            </SafeAreaView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    animatedSymbol: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    scrollContent: {
        flexGrow: 1,
        paddingTop: 8,
        paddingBottom: 12,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingTop: 8,
        paddingBottom: 10,
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerCopy: {
        flexShrink: 1,
        justifyContent: 'center',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 0,
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: fontFamily.extraBold,
        color: '#1B1237',
        letterSpacing: -0.4,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 8,
    },
    restartButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1.5,
        borderColor: '#E9D5FF',
        shadowColor: '#A855F7',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 0,
    },
    restartButtonDisabled: {
        opacity: 0.5,
    },
    onlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.88)',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.22)',
    },
    onlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.success,
        marginRight: 6,
    },
    onlineText: {
        fontSize: 12,
        color: colors.success,
        fontWeight: '600',
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.78)',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(156,163,175,0.18)',
    },
    offlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#9CA3AF',
        marginRight: 6,
    },
    offlineText: {
        fontSize: 12,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    playersContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 14,
        paddingBottom: 10,
        gap: 12,
    },
    playerCard: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.82)',
        width: 122,
        height: 116,
        borderRadius: 26,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.95)',
        position: 'relative',
        ...Platform.select({
            ios: {
                shadowColor: '#B76A98',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.1,
                shadowRadius: 18,
            },
            android: {
                elevation: 0,
            },
        }),
    },
    activePlayer: {
        backgroundColor: '#FFFFFF',
        borderWidth: 2.5,
        borderColor: '#D8B4FE',
        shadowColor: '#A855F7',
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 0,
    },
    cardSymbolContainer: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playerSparkleLeft: {
        position: 'absolute',
        left: 10,
        top: 10,
    },
    playerSparkleRight: {
        position: 'absolute',
        right: 10,
        top: 8,
    },
    playerLabel: {
        backgroundColor: 'rgba(168,85,247,0.08)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        marginTop: 7,
    },
    activePlayerLabel: {
        backgroundColor: '#7C3AED',
    },
    playerLabelText: {
        fontSize: 9,
        fontFamily: fontFamily.extraBold,
        color: '#A855F7',
        letterSpacing: 0.8,
    },
    activePlayerLabelText: {
        color: '#FFFFFF',
    },
    partnerNameText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
        marginTop: 5,
        textAlign: 'center',
        width: '90%',
    },
    vsBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#F3DDF0',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 0,
    },
    vsBadgeText: {
        fontSize: 12,
        fontFamily: fontFamily.bold,
        color: '#A855F7',
    },
    statusContainer: {
        alignItems: 'center',
        minHeight: 76,
        paddingTop: 7,
        paddingBottom: 8,
    },
    statusEyebrow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.65)',
        marginBottom: 5,
    },
    statusEyebrowActive: {
        backgroundColor: 'rgba(236,72,153,0.1)',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#B7ACBA',
    },
    statusDotActive: {
        backgroundColor: '#EC4899',
    },
    statusEyebrowText: {
        color: '#9A8EA6',
        fontFamily: fontFamily.extraBold,
        fontSize: 9,
        letterSpacing: 0.9,
    },
    statusEyebrowTextActive: {
        color: '#D83D88',
    },
    statusText: {
        fontSize: 24,
        fontFamily: fontFamily.extraBold,
        color: '#251744',
        textAlign: 'center',
        letterSpacing: -0.3,
    },
    statusWin: {
        color: '#EC4899',
        fontFamily: fontFamily.extraBold,
    },
    statusLose: {
        color: '#EC4899',
        fontFamily: fontFamily.extraBold,
    },
    statusDraw: {
        color: '#A855F7',
        fontFamily: fontFamily.extraBold,
    },
    statusGameStarting: {
        fontSize: 26,
        fontFamily: fontFamily.extraBold,
        color: '#A855F7',
        textAlign: 'center',
        lineHeight: 36,
    },
    inlineStatus: {
        fontSize: 13,
        fontFamily: fontFamily.bold,
        color: '#EF4444',
        marginTop: 6,
        textAlign: 'center',
    },
    inlineStatusSuccess: {
        color: colors.success,
    },
    inlineStatusInfo: {
        color: colors.accent,
    },
    boardContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    board: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: '#FFFDFE',
        borderRadius: 30,
        overflow: 'hidden',
        borderWidth: BOARD_BORDER_WIDTH,
        borderColor: 'rgba(255,255,255,0.96)',
        ...Platform.select({
            ios: {
                shadowColor: '#A855F7',
                shadowOffset: { width: 0, height: 16 },
                shadowOpacity: 0.14,
                shadowRadius: 24,
            },
            android: {
                elevation: 0,
            },
        }),
    },
    cell: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.72)',
    },
    cellAlternate: {
        backgroundColor: 'rgba(250,245,255,0.72)',
    },
    cellButton: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    cellBorderRight: {
        borderRightWidth: 2,
        borderRightColor: '#F0DFF3',
    },
    cellBorderBottom: {
        borderBottomWidth: 2,
        borderBottomColor: '#F0DFF3',
    },
    cellWinning: {
        backgroundColor: 'transparent',
    },
    winningLineAnchor: {
        position: 'absolute',
        width: 0,
        height: 0,
    },
    winningLineBar: {
        position: 'absolute',
        top: -9,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    winningLineGlow: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#EC4899',
        opacity: 0.65,
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 12,
        elevation: 0,
    },
    winningLineCore: {
        position: 'absolute',
        left: 3,
        right: 3,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
    },
    winningLineSparkle: {
        position: 'absolute',
        top: -11,
        width: 22,
        height: 22,
    },
    bottomActionsContainer: {
        height: 90,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    notifyButtonContainer: {
        width: '100%',
        paddingHorizontal: 40,
        justifyContent: 'center',
    },
    nudgeButton: {
        width: '100%',
    },
    boardGameOverButtons: {
        width: '100%',
        maxWidth: 306,
        marginTop: 20,
    },
    restartGameButton: {
        minHeight: 48,
        paddingHorizontal: 24,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8D9E8',
        borderWidth: 1.5,
        borderColor: '#F2BFD5',
        shadowColor: '#D84F86',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
        elevation: 0,
    },
    restartGameButtonDisabled: {
        opacity: 0.65,
    },
    restartGameButtonText: {
        color: '#D84F86',
        fontFamily: fontFamily.extraBold,
        fontSize: 15,
        letterSpacing: 0.2,
    },
    limitCheckError: {
        alignSelf: 'center',
        width: '88%',
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 14,
        backgroundColor: '#FFF7ED',
        borderWidth: 1,
        borderColor: '#FED7AA',
        marginTop: 8,
        marginBottom: 8,
    },
    limitCheckErrorText: {
        color: '#9A3412',
        fontFamily: fontFamily.bold,
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
    linkPartnerContainer: {
        width: '100%',
        maxWidth: 306,
        marginTop: 20,
    },
});

export default TicTacToeScreen;
