// WordleScreen - Partner Wordle game with word creation and guessing
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    TextInput,
    Keyboard,
    ScrollView,
    Platform,
    Dimensions,
    Image,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { createSafeAudioPlayer } from '../utils/safeAudioPlayer';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import GradientBackground from '../components/GradientBackground';

import { API_BASE } from '../constants/Api';
import { getUser } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';
import { isValidFiveLetterWord } from '../utils/wordValidator';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const FREE_WORDLE_GAME_LIMIT = 3;
const WORDLE_AUTO_SUBMIT_DELAY_MS = 600;

const AnimatedWordleTile = ({
    letter,
    status,
    index,
    isCurrent = false,
    shouldAnimateFlip = false,
    isSecret = false,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const flipAnim = useRef(new Animated.Value(shouldAnimateFlip ? 0 : 180)).current;

    // Spring scale-in on typing (only for current row)
    useEffect(() => {
        if (letter && isCurrent) {
            scaleAnim.setValue(0.85);
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 120,
                friction: 6,
                useNativeDriver: true,
            }).start();
        }
    }, [letter, isCurrent, scaleAnim]);

    // Flip animation on submit
    useEffect(() => {
        if (shouldAnimateFlip) {
            flipAnim.setValue(0);
            Animated.timing(flipAnim, {
                toValue: 180,
                duration: 500,
                delay: index * 200,
                useNativeDriver: true,
            }).start();

            // Staggered haptic tick at mid-flip
            const midTime = index * 200 + 250;
            const timer = setTimeout(() => {
                ReactNativeHapticFeedback.trigger("selection", {
                    enableVibrateFallback: false,
                    ignoreAndroidSystemSettings: false,
                });
            }, midTime);

            return () => clearTimeout(timer);
        } else if (!shouldAnimateFlip && status) {
            // Already flipped
            flipAnim.setValue(180);
        } else {
            // Unrevealed state
            flipAnim.setValue(0);
        }
    }, [shouldAnimateFlip, status, index, flipAnim]);

    const rotateX = flipAnim.interpolate({
        inputRange: [0, 180],
        outputRange: ['0deg', '180deg'],
    });

    const frontOpacity = flipAnim.interpolate({
        inputRange: [0, 89.9, 90, 180],
        outputRange: [1, 1, 0, 0],
    });

    const backOpacity = flipAnim.interpolate({
        inputRange: [0, 90, 90.1, 180],
        outputRange: [0, 0, 1, 1],
    });

    // Style resolution for front side
    let frontBg = 'rgba(255, 255, 255, 0.65)';
    let frontBorder = 'rgba(46, 30, 60, 0.12)';
    let frontText = colors.text;

    if (isSecret) {
        frontBg = 'rgba(192, 132, 252, 0.12)';
        frontBorder = '#E9D5FF';
        frontText = colors.secondary;
    } else if (letter) {
        frontBg = '#FFFFFF';
        frontBorder = colors.primary;
    }

    // Style resolution for back side
    let backBg = 'rgba(255, 255, 255, 0.65)';
    let backBorder = 'rgba(46, 30, 60, 0.12)';
    let backText = colors.text;

    if (isSecret) {
        backBg = 'rgba(192, 132, 252, 0.12)';
        backBorder = '#E9D5FF';
        backText = colors.secondary;
    } else if (status === 'correct') {
        backBg = colors.success;
        backBorder = colors.success;
        backText = '#FFFFFF';
    } else if (status === 'present') {
        backBg = colors.warning;
        backBorder = colors.warning;
        backText = '#FFFFFF';
    } else if (status === 'absent') {
        backBg = colors.textMuted;
        backBorder = colors.textMuted;
        backText = '#FFFFFF';
    } else if (letter) {
        backBg = '#FFFFFF';
        backBorder = colors.primary;
    }

    return (
        <Animated.View
            style={[
                styles.tile,
                {
                    transform: [
                        { scale: scaleAnim },
                        { rotateX }
                    ],
                }
            ]}
        >
            {/* Front Card (Unrevealed) */}
            <Animated.View
                style={[
                    StyleSheet.absoluteFillObject,
                    styles.tileSide,
                    {
                        backgroundColor: frontBg,
                        borderColor: frontBorder,
                        opacity: frontOpacity,
                    }
                ]}
            >
                <Text style={[styles.tileText, { color: frontText }]}>{letter?.toUpperCase() || ''}</Text>
            </Animated.View>

            {/* Back Card (Revealed Status) */}
            <Animated.View
                style={[
                    StyleSheet.absoluteFillObject,
                    styles.tileSide,
                    {
                        backgroundColor: backBg,
                        borderColor: backBorder,
                        opacity: backOpacity,
                        transform: [{ rotateX: '180deg' }],
                    }
                ]}
            >
                <Text style={[styles.tileText, { color: backText }]}>{letter?.toUpperCase() || ''}</Text>
            </Animated.View>
        </Animated.View>
    );
};

const WordleScreen = ({
    navigation,
    route,
    onLinkPartner,
    onRequestPremium,
    hasPremiumAccess = false,
}) => {
    const { gameId: initialGameId, gameData: initialGameData } = route?.params || {};
    const user = getUser();
    const currentUserId = user?.id || user?._id;
    const { socket, partnerOnline } = useSocketContext();

    // Game state
    const [gameId, setGameId] = useState(initialGameId || null);
    const [mode, setMode] = useState('loading');
    const [secretWord, setSecretWord] = useState('');
    const [currentGuess, setCurrentGuess] = useState('');
    const [guesses, setGuesses] = useState([]);
    const [status, setStatus] = useState('pending');
    const [maxAttempts, setMaxAttempts] = useState(6);
    const [isCreator, setIsCreator] = useState(true);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [notifying, setNotifying] = useState(false);
    const [lastNotifyTime, setLastNotifyTime] = useState(0);
    const [revealedWord, setRevealedWord] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [notifyMessage, setNotifyMessage] = useState('');
    const [showLinkPartner, setShowLinkPartner] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [checkingPremium, setCheckingPremium] = useState(false);
    const [, setFreeLimitReached] = useState(false);
    const [playAgainReady, setPlayAgainReady] = useState(false);
    const [limitCheckError, setLimitCheckError] = useState('');
    const [showConfetti, setShowConfetti] = useState(false);

    // Partner info
    const partnerId = route?.params?.partnerId;
    const partnerName = route?.params?.partnerName || 'Partner';

    // Animation
    const shakeAnim = useState(new Animated.Value(0))[0];

    // Error Toast Animations
    const errorScaleAnim = useRef(new Animated.Value(0)).current;
    const errorShakeAnim = useRef(new Animated.Value(0)).current;
    const hasRequestedGameReviewRef = useRef(false);
    const liveCompletionFeedbackRef = useRef(false);
    const statusRef = useRef(status);
    const mountedRef = useRef(true);
    const submittingRef = useRef(false);
    const checkingPremiumRef = useRef(false);
    const autoSubmitTimerRef = useRef(null);
    const focusTimerRef = useRef(null);
    const messageTimerRef = useRef(null);
    const socketRefreshTimerRef = useRef(null);
    const playAgainTimerRef = useRef(null);
    const loadRequestRef = useRef(0);
    const limitSheetGameRef = useRef(null);
    statusRef.current = status;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            [
                autoSubmitTimerRef,
                focusTimerRef,
                messageTimerRef,
                socketRefreshTimerRef,
                playAgainTimerRef,
            ].forEach(timerRef => {
                if (timerRef.current) clearTimeout(timerRef.current);
            });
        };
    }, []);

    const requestGameReviewOnce = useCallback(() => {
        if (hasRequestedGameReviewRef.current) return;
        hasRequestedGameReviewRef.current = true;
        requestReviewForMoment(REVIEW_MOMENTS.GAME_COMPLETED);
    }, []);

    useEffect(() => {
        if (errorMessage) {
            errorScaleAnim.setValue(0);
            errorShakeAnim.setValue(0);

            Animated.parallel([
                Animated.spring(errorScaleAnim, {
                    toValue: 1,
                    tension: 120,
                    friction: 7,
                    useNativeDriver: true,
                }),
                Animated.sequence([
                    Animated.timing(errorShakeAnim, { toValue: 10, duration: 40, useNativeDriver: true }),
                    Animated.timing(errorShakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
                    Animated.timing(errorShakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
                    Animated.timing(errorShakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
                    Animated.timing(errorShakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
                ])
            ]).start();
        } else {
            Animated.timing(errorScaleAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true,
            }).start();
        }
    }, [errorMessage, errorScaleAnim, errorShakeAnim]);

    // Input ref for focus management
    const inputRef = useRef(null);

    const openKeyboard = () => {
        if (!inputRef.current) return;

        inputRef.current.blur();
        if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
        focusTimerRef.current = setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    // Track newly submitted guesses for 3D flip animation
    const [lastSubmittedRowIndex, setLastSubmittedRowIndex] = useState(-1);

    // Audio player ref
    const audioPlayerRef = useRef(null);

    // Initialize audio player on mount
    useEffect(() => {
        audioPlayerRef.current = createSafeAudioPlayer();
        return () => {
            if (audioPlayerRef.current) {
                audioPlayerRef.current.stopPlayer().catch(() => {});
            }
        };
    }, []);

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

    // Haptic/audio feedback on game resolution (win/loss)
    useEffect(() => {
        const shouldCelebrate = liveCompletionFeedbackRef.current;
        liveCompletionFeedbackRef.current = false;

        if (status === 'won') {
            if (shouldCelebrate) {
                playResultSound();
                setShowConfetti(true);
                ReactNativeHapticFeedback.trigger("notificationSuccess", {
                    enableVibrateFallback: false,
                    ignoreAndroidSystemSettings: false,
                });
            }
        } else if (status === 'lost') {
            if (shouldCelebrate) {
                ReactNativeHapticFeedback.trigger("notificationError", {
                    enableVibrateFallback: false,
                    ignoreAndroidSystemSettings: false,
                });
            }
        }

        if (status === 'won' || status === 'lost') {
            setPlayAgainReady(false);
            if (playAgainTimerRef.current) clearTimeout(playAgainTimerRef.current);
            playAgainTimerRef.current = setTimeout(() => {
                if (mountedRef.current) setPlayAgainReady(true);
            }, 800);
        } else {
            setPlayAgainReady(false);
        }

        return () => {
            if (playAgainTimerRef.current) clearTimeout(playAgainTimerRef.current);
        };
    }, [status, playResultSound]);

    // Auto-focus input when in create or guess mode
    useEffect(() => {
        if ((mode === 'create' || mode === 'guess') && inputRef.current) {
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
            focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 100);
        }

        return () => {
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
        };
    }, [mode]);

    // Socket listeners for real-time updates
    useEffect(() => {
        if (!socket) return;

        // Join game room if we have a gameId
        if (gameId) {
            socket.emit('wordle:join', { gameId });
        }

        const isCurrentGameEvent = (data = {}) => String(data.gameId) === String(gameId);
        const refreshCurrentGame = () => {
            if (socketRefreshTimerRef.current) clearTimeout(socketRefreshTimerRef.current);
            socketRefreshTimerRef.current = setTimeout(() => {
                fetchGame(gameId);
            }, 80);
        };

        // Listen for guess/game updates from partner. The backend may emit either
        // a specific event or the generic wordle:update used by AppNavigator.
        const handleGameUpdate = (data = {}) => {
            if (isCurrentGameEvent(data)) {
                if (data.status) {
                    if (
                        ['won', 'lost'].includes(data.status)
                        && !['won', 'lost'].includes(statusRef.current)
                    ) {
                        liveCompletionFeedbackRef.current = true;
                    }
                    setStatus(data.status);
                    if (['won', 'lost'].includes(data.status)) {
                        requestGameReviewOnce();
                    }
                }
                refreshCurrentGame();
            }
        };

        // Listen for guess updates from partner
        const handleGuessReceived = (data) => {
            if (String(data.gameId) === String(gameId)) {
                refreshCurrentGame();
            }
        };

        // Listen for game completion
        const handleGameComplete = handleGameUpdate;

        // Listen for new game created by partner
        const handleNewGame = (data = {}) => {
            if (data.gameId && String(data.gameId) === String(gameId)) return;

            // Reset state and fetch the new game
            if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
            setGuesses([]);
            setCurrentGuess('');
            setStatus('pending');
            setRevealedWord('');
            setSuccessMessage('');
            setErrorMessage('');
            setLastSubmittedRowIndex(-1);
            setLoading(true);
            hasRequestedGameReviewRef.current = false;
            // Fetch the new active game
            fetchActiveGame();
        };

        socket.on('wordle:guessReceived', handleGuessReceived);
        socket.on('wordle:gameComplete', handleGameComplete);
        socket.on('wordle:update', handleGameUpdate);
        socket.on('wordle:invite', handleNewGame);
        socket.on('wordle:newGame', handleNewGame);

        return () => {
            if (gameId) {
                socket.emit('wordle:leave', { gameId });
            }
            socket.off('wordle:guessReceived', handleGuessReceived);
            socket.off('wordle:gameComplete', handleGameComplete);
            socket.off('wordle:update', handleGameUpdate);
            socket.off('wordle:invite', handleNewGame);
            socket.off('wordle:newGame', handleNewGame);
            if (socketRefreshTimerRef.current) clearTimeout(socketRefreshTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, gameId]);

    const loadGameFromData = (data) => {
        if (!data) return;
        if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
        setGameId(data._id || data.gameId);
        setGuesses(data.guesses || []);
        setStatus(data.status || 'pending');
        setMaxAttempts(data.maxAttempts || 6);
        setLoadError('');
        const creatorId = data.creatorId?._id || data.creatorId;
        const creatorCheck = Boolean(currentUserId)
            && String(creatorId) === String(currentUserId);
        setIsCreator(creatorCheck);

        if (creatorCheck) {
            // Creator views their game (waiting for partner)
            setSecretWord(data.secretWord || '');
            setMode('complete');
        } else {
            // Guesser mode
            if (['won', 'lost'].includes(data.status)) {
                setRevealedWord(data.secretWord || '');
                setMode('complete');
            } else {
                setMode('guess');
            }
        }
        setLoading(false);
    };

    const fetchCompletedGames = async () => {
        const response = await fetch(
            `${API_BASE}/api/wordle/history/${currentUserId}?limit=${FREE_WORDLE_GAME_LIMIT}`
        );
        const data = await response.json();

        if (!response.ok || !data.success || !Array.isArray(data.data)) {
            throw new Error(data.message || 'Failed to check completed games');
        }

        return data.data;
    };

    const fetchCompletedGameCount = async () => {
        const completedGames = await fetchCompletedGames();
        return completedGames.length;
    };

    const refreshFreeLimitStatus = async ({ showLimitSheet = false } = {}) => {
        setLimitCheckError('');
        const completedGames = await fetchCompletedGameCount();
        const limitReached = completedGames >= FREE_WORDLE_GAME_LIMIT;
        if (mountedRef.current) {
            setFreeLimitReached(limitReached);
            const limitKey = String(gameId || 'wordle-limit');
            if (
                showLimitSheet
                && limitReached
                && limitSheetGameRef.current !== limitKey
            ) {
                limitSheetGameRef.current = limitKey;
                onRequestPremium?.();
            }
        }
        return completedGames;
    };

    const loadGameWithAccessCheck = async (data, requestId) => {
        const isActiveGame = ['pending', 'in_progress'].includes(data?.status);

        if (
            isActiveGame
            && !hasPremiumAccess
            && onRequestPremium
            && currentUserId
        ) {
            const completedGames = await fetchCompletedGames();
            if (!mountedRef.current || requestId !== loadRequestRef.current) return;

            if (completedGames.length >= FREE_WORDLE_GAME_LIMIT) {
                setFreeLimitReached(true);
                setLimitCheckError('');
                loadGameFromData(completedGames[0]);
                return;
            }
        }

        loadGameFromData(data);

        if (!isActiveGame && !hasPremiumAccess && currentUserId) {
            try {
                const completedGames = await fetchCompletedGameCount();
                if (!mountedRef.current || requestId !== loadRequestRef.current) return;
                setFreeLimitReached(completedGames >= FREE_WORDLE_GAME_LIMIT);
                setLimitCheckError('');
            } catch (historyError) {
                if (mountedRef.current) {
                    setLimitCheckError('Couldn’t verify your free-game limit.');
                }
            }
        } else {
            setFreeLimitReached(false);
        }
    };

    const fetchActiveGame = async () => {
        const requestId = ++loadRequestRef.current;
        setLoadError('');
        try {
            const response = await fetch(`${API_BASE}/api/wordle/active/${currentUserId}`);
            const data = await response.json();
            if (!mountedRef.current || requestId !== loadRequestRef.current) return;

            if (response.ok && data.success && data.data) {
                await loadGameWithAccessCheck(data.data, requestId);
            } else if (response.ok && data.success) {
                if (!hasPremiumAccess && onRequestPremium && currentUserId) {
                    try {
                        const completedGames = await fetchCompletedGames();
                        if (!mountedRef.current || requestId !== loadRequestRef.current) return;

                        if (completedGames.length >= FREE_WORDLE_GAME_LIMIT) {
                            setFreeLimitReached(true);
                            setLimitCheckError('');
                            loadGameFromData(completedGames[0]);
                            return;
                        }
                    } catch (historyError) {
                        if (!mountedRef.current || requestId !== loadRequestRef.current) return;
                        setLoadError('Unable to check your free games. Please try again.');
                        setMode('error');
                        setLoading(false);
                        return;
                    }
                }

                setMode('create');
                setLoading(false);
            } else {
                setLoadError(data.message || 'Failed to load your game');
                setMode('error');
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching active Wordle:', error);
            if (!mountedRef.current || requestId !== loadRequestRef.current) return;
            setLoadError('Unable to load your game. Check your connection and try again.');
            setMode('error');
            setLoading(false);
        }
    };

    const fetchGame = async (id) => {
        if (!id) return;
        const requestId = ++loadRequestRef.current;
        setLoadError('');
        try {
            const response = await fetch(`${API_BASE}/api/wordle/${id}?userId=${currentUserId}`);
            const data = await response.json();
            if (!mountedRef.current || requestId !== loadRequestRef.current) return;

            if (response.ok && data.success) {
                await loadGameWithAccessCheck(data.data, requestId);
            } else {
                setLoadError(data.message || 'Failed to load your game');
                setMode('error');
                setLoading(false);
            }
        } catch (error) {
            console.error('Fetch game error:', error);
            if (!mountedRef.current || requestId !== loadRequestRef.current) return;
            setLoadError('Unable to load your game. Check your connection and try again.');
            setMode('error');
            setLoading(false);
        }
    };

    // Reload when navigation selects a different Wordle game while this screen stays mounted.
    useEffect(() => {
        setLoading(true);
        setLoadError('');

        if (initialGameData) {
            const requestId = ++loadRequestRef.current;
            loadGameWithAccessCheck(initialGameData, requestId).catch(() => {
                if (!mountedRef.current || requestId !== loadRequestRef.current) return;
                setLoadError('Unable to check your free games. Please try again.');
                setMode('error');
                setLoading(false);
            });
        } else if (initialGameId) {
            fetchGame(initialGameId);
        } else {
            fetchActiveGame();
        }
        // initialGameData is intentionally included so an updated route payload is applied.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialGameId, initialGameData]);

    const retryLoadGame = () => {
        setLoading(true);
        if (gameId || initialGameId) {
            fetchGame(gameId || initialGameId);
        } else {
            fetchActiveGame();
        }
    };

    const shakeRow = () => {
        ReactNativeHapticFeedback.trigger("notificationWarning", {
            enableVibrateFallback: false,
            ignoreAndroidSystemSettings: false,
        });

        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    // Create game with secret word
    const createGame = async (wordOverride) => {
        if (submittingRef.current) return;

        const word = wordOverride || secretWord;
        if (word.length !== 5) {
            setErrorMessage('Word must be 5 letters');
            shakeRow();
            return;
        }
        if (!isValidFiveLetterWord(word)) {
            setErrorMessage('This word is not in our dictionary. Please choose another word.');
            shakeRow();
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setErrorMessage('');

        try {
            const response = await fetch(`${API_BASE}/api/wordle/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creatorId: currentUserId,
                    partnerId: partnerId,
                    secretWord: word.toLowerCase(),
                }),
            });
            const data = await response.json();
            if (!mountedRef.current) return;

            if (response.ok && data.success) {
                setGameId(data.data.gameId);
                setSuccessMessage(translateUiTemplate("Word set! {{0}} has been notified.", [partnerName]));
                setMode('complete');

                // One event is enough to update the partner's screen and pending-game state.
                if (socket) {
                    socket.emit('wordle:invite', { gameId: data.data.gameId });
                }
            } else {
                if (data.code === 'WORDLE_FREE_LIMIT_REACHED') {
                    setFreeLimitReached(true);
                    setLimitCheckError('');
                    onRequestPremium?.();
                    setLoading(true);
                    fetchActiveGame();
                    return;
                }
                setErrorMessage(data.message || 'Invalid word');
                shakeRow();
            }
        } catch (error) {
            console.error('Create game error:', error);
            if (mountedRef.current) setErrorMessage('Failed to create game');
        } finally {
            submittingRef.current = false;
            if (mountedRef.current) setSubmitting(false);
        }
    };

    // Submit a guess
    const submitGuess = async (guessOverride) => {
        if (submittingRef.current) return;

        const guess = guessOverride || currentGuess;
        if (guess.length !== 5) {
            setErrorMessage('Guess must be 5 letters');
            shakeRow();
            return;
        }
        if (!isValidFiveLetterWord(guess)) {
            setErrorMessage('Not a valid word. Try another!');
            shakeRow();
            return;
        }

        submittingRef.current = true;
        setSubmitting(true);
        setErrorMessage('');

        try {
            const response = await fetch(`${API_BASE}/api/wordle/${gameId}/guess`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUserId,
                    guess: guess.toLowerCase(),
                }),
            });
            const data = await response.json();
            if (!mountedRef.current) return;

            if (response.ok && data.success) {
                if (data.data.gameComplete) {
                    liveCompletionFeedbackRef.current = true;
                }
                setLastSubmittedRowIndex(guesses.length);
                const newGuess = {
                    word: guess.toLowerCase(),
                    result: data.data.guessResult,
                };
                const updatedGuesses = [...guesses, newGuess];
                setGuesses(updatedGuesses);
                setCurrentGuess('');
                setStatus(data.data.status);

                // Emit socket event for real-time partner update
                if (socket) {
                    socket.emit('wordle:guess', {
                        gameId,
                        guessResult: data.data.guessResult,
                        status: data.data.status,
                        gameComplete: data.data.gameComplete
                    });
                }

                if (data.data.gameComplete) {
                    setRevealedWord(data.data.secretWord);
                    setMode('complete');
                    requestGameReviewOnce();

                    if (!hasPremiumAccess && currentUserId) {
                        try {
                            await refreshFreeLimitStatus({ showLimitSheet: true });
                        } catch (historyError) {
                            if (mountedRef.current) {
                                setLimitCheckError('Couldn’t verify your free-game limit.');
                            }
                        }
                    }

                }
            } else {
                if (data.code === 'WORDLE_FREE_LIMIT_REACHED') {
                    setFreeLimitReached(true);
                    setLimitCheckError('');
                    onRequestPremium?.();
                    setLoading(true);
                    fetchActiveGame();
                    return;
                }
                setErrorMessage(data.message || 'Invalid guess');
                shakeRow();
            }
        } catch (error) {
            console.error('Guess error:', error);
            if (mountedRef.current) setErrorMessage('Failed to submit guess');
        } finally {
            submittingRef.current = false;
            if (mountedRef.current) setSubmitting(false);
        }
    };

    const startNewGame = () => {
        if (!mountedRef.current) return;
        if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
        setGuesses([]);
        setCurrentGuess('');
        setSecretWord('');
        setStatus('pending');
        setRevealedWord('');
        setSuccessMessage('');
        setErrorMessage('');
        setLastSubmittedRowIndex(-1);
        setIsCreator(true);
        setLoadError('');
        setFreeLimitReached(false);
        setLimitCheckError('');
        setShowConfetti(false);
        liveCompletionFeedbackRef.current = false;
        hasRequestedGameReviewRef.current = false;
        setMode('create');
    };

    const handlePlayAgain = async () => {
        if (!playAgainReady || checkingPremiumRef.current) return;

        if (hasPremiumAccess || !onRequestPremium || !currentUserId) {
            startNewGame();
            return;
        }

        checkingPremiumRef.current = true;
        setCheckingPremium(true);

        try {
            const completedGames = await refreshFreeLimitStatus();
            if (!mountedRef.current) return;

            if (completedGames >= FREE_WORDLE_GAME_LIMIT) {
                setFreeLimitReached(true);
                onRequestPremium();
                return;
            }

            startNewGame();
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

    useEffect(() => {
        if (hasPremiumAccess) {
            setFreeLimitReached(false);
            setLimitCheckError('');
        }
    }, [hasPremiumAccess]);

    const notifyPartner = async () => {
        const now = Date.now();
        if (now - lastNotifyTime < 5 * 60 * 1000) {
            const remaining = Math.ceil((5 * 60 * 1000 - (now - lastNotifyTime)) / 60000);
            setNotifyMessage(translateUiTemplate("Wait {{0}} min to notify again", [remaining]));
            if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
            messageTimerRef.current = setTimeout(() => setNotifyMessage(''), 3000);
            return;
        }

        setNotifying(true);
        try {
            const response = await fetch(`${API_BASE}/api/wordle/${gameId}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId }),
            });
            const data = await response.json();
            if (!mountedRef.current) return;

            if (response.ok && data.success) {
                setLastNotifyTime(now);
                setNotifyMessage(translateUiTemplate("{{0}} notified!", [partnerName]));
            } else {
                setNotifyMessage(data.message || 'Failed to notify');
            }
            if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
            messageTimerRef.current = setTimeout(() => setNotifyMessage(''), 3000);
        } catch (error) {
            if (!mountedRef.current) return;
            setNotifyMessage('Failed to notify');
            if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
            messageTimerRef.current = setTimeout(() => setNotifyMessage(''), 3000);
        } finally {
            if (mountedRef.current) setNotifying(false);
        }
    };

    // Handle text input change - only allow letters
    const handleInputKeyPress = ({ nativeEvent }) => {
        if (nativeEvent.key !== 'Backspace' || !autoSubmitTimerRef.current) return;
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
    };

    const handleTextChange = (text) => {
        if (submitting) return;
        if (autoSubmitTimerRef.current) {
            clearTimeout(autoSubmitTimerRef.current);
            autoSubmitTimerRef.current = null;
        }

        ReactNativeHapticFeedback.trigger("selection", {
            enableVibrateFallback: false,
            ignoreAndroidSystemSettings: false,
        });

        // Filter to only allow letters (A-Z, a-z)
        const lettersOnly = text.replace(/[^a-zA-Z]/g, '').toUpperCase();

        // Limit to 5 characters
        const limitedText = lettersOnly.slice(0, 5);

        if (mode === 'create') {
            setSecretWord(limitedText);
            // Auto-submit when 5 letters entered - pass word directly
            if (limitedText.length === 5) {
                if (!partnerId) {
                    // Show link partner prompt if no partner
                    setShowLinkPartner(true);
                    Keyboard.dismiss();
                } else {
                    autoSubmitTimerRef.current = setTimeout(
                        () => createGame(limitedText),
                        WORDLE_AUTO_SUBMIT_DELAY_MS
                    );
                }
            } else {
                setShowLinkPartner(false);
            }
        } else {
            setCurrentGuess(limitedText);
            // Auto-submit when 5 letters entered - pass word directly
            if (limitedText.length === 5) {
                autoSubmitTimerRef.current = setTimeout(
                    () => submitGuess(limitedText),
                    WORDLE_AUTO_SUBMIT_DELAY_MS
                );
            }
        }
        setErrorMessage('');
    };

    // Render a guess row
    const renderGuessRow = (guess, rowIndex) => {
        const tiles = [];
        const isNewRow = rowIndex === lastSubmittedRowIndex;
        for (let i = 0; i < 5; i++) {
            const letter = guess?.word?.[i] || '';
            const tileStatus = guess?.result?.[i]?.status || null;
            tiles.push(
                <AnimatedWordleTile
                    key={i}
                    letter={letter}
                    status={tileStatus}
                    index={i}
                    isCurrent={false}
                    shouldAnimateFlip={isNewRow}
                />
            );
        }
        return (
            <View key={rowIndex} style={styles.guessRow}>
                {tiles}
            </View>
        );
    };

    // Render current input row (tappable to open keyboard)
    const renderCurrentRow = () => {
        const word = mode === 'create' ? secretWord : currentGuess;
        const tiles = [];
        for (let i = 0; i < 5; i++) {
            tiles.push(
                <AnimatedWordleTile
                    key={i}
                    letter={word[i] || ''}
                    status={null}
                    index={i}
                    isCurrent={true}
                    shouldAnimateFlip={false}
                />
            );
        }
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={openKeyboard}
                accessibilityRole="button"
                accessibilityLabel={mode === 'create' ? translateUiText("Enter a five letter word") : translateUiText("Enter your five letter guess")}
            >
                <Animated.View style={[styles.guessRow, { transform: [{ translateX: shakeAnim }] }]}>
                    {tiles}
                </Animated.View>
            </TouchableOpacity>
        );
    };

    // Render empty rows
    const renderEmptyRows = (count) => {
        const rows = [];
        for (let i = 0; i < count; i++) {
            rows.push(renderGuessRow(null, `empty-${i}`));
        }
        return rows;
    };

    if (loading) {
        return (
            <GradientBackground variant="light" showOrbs={true} showParticles={true}>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>{translateUiText("Loading...")}</Text>
                    </View>
                </SafeAreaView>
            </GradientBackground>
        );
    }

    const isGameOver = ['won', 'lost'].includes(status);
    const attemptsUsed = guesses.length;
    const attemptsRemaining = maxAttempts - attemptsUsed;

    return (
        <GradientBackground variant="light" showOrbs={true} showParticles={true}>
            <SafeAreaView style={styles.container} edges={['top']}>
                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => navigation?.goBack?.()}
                                accessibilityRole="button"
                                accessibilityLabel={translateUiText("Go back")}
                            >
                                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="M19 12H5M12 19l-7-7 7-7"
                                        stroke={colors.text}
                                        strokeWidth={2.5}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                            </TouchableOpacity>
                            <Text style={styles.headerTitle}>{translateUiText("Wordle")}</Text>
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
                        </View>
                    </View>



                    {/* Message slots stay mounted so validation feedback does not shift the grid. */}
                    <View style={styles.notifyMessageContainer}>
                        <Text style={styles.notifyMessageText}>{translateUiText(notifyMessage)}</Text>
                    </View>



                    {/* Game Grid */}
                    <ScrollView
                        style={styles.flex}
                        contentContainerStyle={styles.gridContainer}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {mode === 'create' && (
                            <>
                                {renderCurrentRow()}
                                {!showLinkPartner && (
                                    <Text style={styles.hintText}>{translateUiText("Type a 5-letter word")}</Text>
                                )}
                                {showLinkPartner && (
                                    <View style={styles.linkPartnerCard}>
                                        <Text style={styles.linkPartnerText}>{translateUiText("Link a partner to send this word")}</Text>
                                        <TouchableOpacity
                                            onPress={onLinkPartner}
                                            activeOpacity={0.8}
                                            style={styles.playAgainButton}
                                        >
                                            <Text style={styles.playAgainText}>{translateUiText("Link Partner 🔗")}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        )}

                        {mode === 'error' && (
                            <View style={styles.loadErrorCard}>
                                <Text style={styles.loadErrorTitle}>{translateUiText("Couldn’t load Wordle")}</Text>
                                <Text style={styles.loadErrorText}>{translateUiText(loadError)}</Text>
                                <TouchableOpacity
                                    onPress={retryLoadGame}
                                    activeOpacity={0.8}
                                    style={styles.playAgainButton}
                                    accessibilityRole="button"
                                    accessibilityLabel={translateUiText("Retry loading Wordle")}
                                >
                                    <Text style={styles.playAgainText}>{translateUiText("Try Again")}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {mode === 'guess' && (
                            <>
                                {guesses.map((guess, i) => renderGuessRow(guess, i))}
                                {!isGameOver && renderCurrentRow()}
                                {renderEmptyRows(maxAttempts - attemptsUsed - 1)}
                            </>
                        )}

                        {mode === 'complete' && isCreator && (
                            <>
                                {/* Show the secret word */}
                                <View style={styles.secretWordContainer}>
                                    {secretWord.split('').map((letter, i) => (
                                        <AnimatedWordleTile
                                            key={i}
                                            letter={letter}
                                            status={null}
                                            index={i}
                                            isCurrent={false}
                                            shouldAnimateFlip={false}
                                            isSecret={true}
                                        />
                                    ))}
                                </View>

                                {/* Show partner's guesses if any */}
                                {guesses.length > 0 && (
                                    <View style={styles.creatorGuessesContainer}>
                                        <Text style={styles.creatorGuessesTitle}>
                                            {translateUiTemplate("{{0}}'s guesses:", [partnerName])}</Text>
                                        {guesses.map((guess, i) => renderGuessRow(guess, i))}
                                    </View>
                                )}
                            </>
                        )}

                        {mode === 'complete' && !isCreator && (
                            <>
                                {guesses.map((guess, i) => renderGuessRow(guess, i))}
                            </>
                        )}

                        {/* Status Text Rendered at the Bottom of the Grid */}
                        <View style={[styles.statusContainer, styles.statusContainerSpacing]}>
                            {mode === 'create' && (
                                <Text style={styles.statusText}>{translateUiTemplate("Set a word for {{0}} to guess", [partnerName])}</Text>
                            )}
                            {mode === 'guess' && (
                                <Text style={styles.statusText}>
                                    {attemptsRemaining === 1
                                        ? translateUiTemplate("Guess the word! ({{0}} attempt left)", [attemptsRemaining])
                                        : translateUiTemplate("Guess the word! ({{0}} attempts left)", [attemptsRemaining])}
                                </Text>
                            )}
                            {/* Creator views - different states */}
                            {mode === 'complete' && isCreator && successMessage && status === 'pending' && (
                                <Text style={[styles.statusText, styles.statusSuccess]}>
                                    {successMessage}
                                </Text>
                            )}
                            {mode === 'complete' && isCreator && !successMessage && status === 'pending' && (
                                <Text style={styles.statusText}>{translateUiTemplate("Waiting for {{0}} to start guessing...", [partnerName])}</Text>
                            )}
                            {mode === 'complete' && isCreator && status === 'in_progress' && (
                                <Text style={styles.statusText}>
                                    {translateUiTemplate("{{0}} is guessing... ({{1}}/{{2}} tries used)", [partnerName, guesses.length, maxAttempts])}</Text>
                            )}
                            {mode === 'complete' && isCreator && status === 'won' && (
                                <Text style={[styles.statusText, styles.statusWin]}>
                                    {guesses.length === 1
                                        ? translateUiTemplate("{{0}} guessed it in {{1}} try!", [partnerName, guesses.length])
                                        : translateUiTemplate("{{0}} guessed it in {{1}} tries!", [partnerName, guesses.length])}
                                </Text>
                            )}
                            {mode === 'complete' && isCreator && status === 'lost' && (
                                <Text style={[styles.statusText, styles.statusLose]}>
                                    {translateUiTemplate("{{0}} couldn't guess “{{1}}”", [partnerName, secretWord])}
                                </Text>
                            )}
                            {/* Guesser views */}
                            {mode === 'complete' && !isCreator && status === 'won' && (
                                <Text style={[styles.statusText, styles.statusWin]}>
                                    {guesses.length === 1
                                        ? translateUiTemplate("You won in {{0}} try!", [guesses.length])
                                        : translateUiTemplate("You won in {{0}} tries!", [guesses.length])}
                                </Text>
                            )}
                            {mode === 'complete' && !isCreator && status === 'lost' && (
                                <Text style={[styles.statusText, styles.statusLose]}>
                                    {translateUiTemplate("Game over — the word was “{{0}}”", [revealedWord])}
                                </Text>
                            )}
                        </View>

                        {limitCheckError && mode === 'complete' && (
                            <TouchableOpacity
                                style={styles.limitCheckError}
                                onPress={retryFreeLimitCheck}
                                activeOpacity={0.8}
                                disabled={checkingPremium || !playAgainReady}
                                accessibilityRole="button"
                                accessibilityLabel={translateUiText("Retry free-game limit check")}
                            >
                                <Text style={styles.limitCheckErrorText}>
                                    {translateUiTemplate("{{0}} Tap to retry.", [translateUiText(limitCheckError)])}</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    {/* Hidden TextInput for native keyboard */}
                    {(mode === 'create' || mode === 'guess') && (
                        <TextInput
                            ref={inputRef}
                            style={styles.hiddenInput}
                            value={mode === 'create' ? secretWord : currentGuess}
                            onChangeText={handleTextChange}
                            onKeyPress={handleInputKeyPress}
                            maxLength={5}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            autoComplete="off"
                            keyboardType="default"
                            autoFocus={true}
                        />
                    )}

                    {/* Action Buttons */}
                    {/* 1. Game is finished (won or lost): Show Play Again */}
                    {mode === 'complete' && (status === 'won' || status === 'lost') && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                onPress={handlePlayAgain}
                                activeOpacity={0.8}
                                style={styles.playAgainButton}
                                disabled={checkingPremium || !playAgainReady}
                                accessibilityRole="button"
                                accessibilityLabel={translateUiText("Play Wordle again")}
                                accessibilityState={{ disabled: checkingPremium || !playAgainReady }}
                            >
                                {checkingPremium ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.playAgainText}>{translateUiText("Play Again")}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* 2. Creator is waiting & partner is offline: Show Nudge */}
                    {mode === 'complete' && isCreator && (status === 'pending' || status === 'in_progress') && partnerOnline !== true && (
                        <View style={styles.actionButtons}>
                            <TouchableOpacity
                                onPress={notifyPartner}
                                activeOpacity={0.8}
                                disabled={notifying}
                                style={[
                                    styles.playAgainButton,
                                    notifying && styles.buttonDisabled,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={translateUiTemplate("Nudge {{0}}", [partnerName])}
                            >
                                {notifying ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.playAgainText}>{translateUiTemplate("Nudge {{0}}", [partnerName])}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {showConfetti && (
                        <ConfettiCannon
                            count={150}
                            origin={{ x: Dimensions.get('window').width / 2, y: -20 }}
                            autoStart={true}
                            fadeOut={true}
                            onAnimationEnd={() => setShowConfetti(false)}
                        />
                    )}

                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.floatingErrorContainer,
                            {
                                opacity: errorScaleAnim,
                                transform: [
                                    { scale: errorScaleAnim },
                                    { translateX: errorShakeAnim }
                                ]
                            }
                        ]}
                    >
                        <Text style={styles.floatingErrorText}>{translateUiText(errorMessage)}</Text>
                    </Animated.View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    container: {
        flex: 1,
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
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FAE8FF',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.08,
                shadowRadius: 6,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: 1,
    },
    headerRight: {
        width: 80,
        alignItems: 'flex-end',
    },
    onlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
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
        backgroundColor: 'rgba(156, 163, 175, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    offlineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.textMuted,
        marginRight: 6,
    },
    offlineText: {
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: '600',
    },
    statusContainer: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 20,
    },
    statusContainerSpacing: {
        marginTop: 16,
    },
    statusText: {
        fontSize: 16,
        fontFamily: fontFamily.bold,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    statusWin: {
        color: colors.success,
        fontSize: 24,
        fontFamily: fontFamily.extraBold,
    },
    statusLose: {
        color: colors.error,
        fontSize: 18,
        fontFamily: fontFamily.extraBold,
    },
    statusSuccess: {
        color: colors.success,
        fontSize: 18,
        fontFamily: fontFamily.extraBold,
    },
    notifyMessageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 26,
        paddingHorizontal: 20,
    },
    notifyMessageText: {
        fontSize: 14,
        color: colors.success,
        fontWeight: '600',
    },
    errorContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 30,
        paddingHorizontal: 20,
    },
    errorText: {
        fontSize: 14,
        color: colors.error,
        fontWeight: '600',
    },
    floatingErrorContainer: {
        position: 'absolute',
        bottom: 24,
        left: '10%',
        right: '10%',
        backgroundColor: 'rgba(239, 68, 68, 0.95)',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        ...Platform.select({
            ios: {
                shadowColor: '#EF4444',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    floatingErrorText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    gridContainer: {
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 16,
        paddingBottom: 20,
        flexGrow: 1,
    },
    guessRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 6,
    },
    tile: {
        width: 56,
        height: 56,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
            },
            android: {
                elevation: 5,
                shadowColor: '#8B5CF6',
            },
        }),
    },
    tileSide: {
        borderWidth: 1.5,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tileText: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
    },
    hintText: {
        marginTop: 16,
        fontSize: 14,
        color: colors.textMuted,
    },
    secretWordContainer: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 16,
    },
    waitingText: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: 12,
    },
    creatorGuessesContainer: {
        alignItems: 'center',
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(46, 30, 60, 0.1)',
    },
    creatorGuessesTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textMuted,
        marginBottom: 12,
    },
    inputContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        paddingTop: 10,
        gap: 12,
    },
    hiddenInput: {
        position: 'absolute',
        opacity: 0,
        height: 0,
        width: 0,
    },
    linkPartnerCard: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24,
        paddingVertical: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#FAE8FF',
        marginTop: 20,
        marginHorizontal: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    linkPartnerText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 24,
    },
    loadErrorCard: {
        width: '88%',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24,
        paddingVertical: 24,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#FAE8FF',
        marginTop: 28,
    },
    loadErrorTitle: {
        color: colors.text,
        fontFamily: fontFamily.extraBold,
        fontSize: 20,
        marginBottom: 8,
    },
    loadErrorText: {
        color: colors.textSecondary,
        fontFamily: fontFamily.medium,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginBottom: 20,
    },
    limitCheckError: {
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
    actionButtons: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
        height: 90,
        width: '100%',
    },
    playAgainButton: {
        backgroundColor: colors.primary,
        minHeight: 40,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing['2xl'],
        borderRadius: borderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        ...Platform.select({
            ios: {
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    playAgainGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playAgainContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    playAgainText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: fontFamily.bold,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});

export default WordleScreen;
