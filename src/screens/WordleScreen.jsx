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
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import GradientBackground from '../components/GradientBackground';

import { API_BASE } from '../constants/Api';
import { getUser } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';



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

const WordleScreen = ({ navigation, route, onLinkPartner }) => {
    const { gameId: initialGameId, gameData: initialGameData } = route?.params || {};
    const user = getUser();
    const { socket, partnerOnline } = useSocketContext();

    // Game state
    const [gameId, setGameId] = useState(initialGameId || null);
    const [mode, setMode] = useState('loading'); // 'loading', 'create', 'guess', 'complete'
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

    // Keyboard state (for coloring used letters)
    const [keyboardState, setKeyboardState] = useState({});

    // Partner info
    const partnerId = route?.params?.partnerId;
    const partnerName = route?.params?.partnerName || 'Partner';

    // Animation
    const shakeAnim = useState(new Animated.Value(0))[0];

    // Error Toast Animations
    const errorScaleAnim = useRef(new Animated.Value(0)).current;
    const errorShakeAnim = useRef(new Animated.Value(0)).current;
    const hasRequestedGameReviewRef = useRef(false);

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
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    };

    // Track newly submitted guesses for 3D flip animation
    const [lastSubmittedRowIndex, setLastSubmittedRowIndex] = useState(-1);

    // Audio player ref
    const audioPlayerRef = useRef(null);

    // Initialize audio player on mount
    useEffect(() => {
        audioPlayerRef.current = new AudioRecorderPlayer();
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
        if (status === 'won') {
            playResultSound();
            ReactNativeHapticFeedback.trigger("notificationSuccess", {
                enableVibrateFallback: false,
                ignoreAndroidSystemSettings: false,
            });
        } else if (status === 'lost') {
            ReactNativeHapticFeedback.trigger("notificationError", {
                enableVibrateFallback: false,
                ignoreAndroidSystemSettings: false,
            });
        }
    }, [status, playResultSound]);

    // Load or check for active game
    useEffect(() => {
        if (initialGameData) {
            loadGameFromData(initialGameData);
        } else if (initialGameId) {
            fetchGame(initialGameId);
        } else {
            fetchActiveGame();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-focus input when in create or guess mode
    useEffect(() => {
        if ((mode === 'create' || mode === 'guess') && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [mode]);

    // Socket listeners for real-time updates
    useEffect(() => {
        if (!socket) return;

        // Join game room if we have a gameId
        if (gameId) {
            socket.emit('wordle:join', { gameId });
        }

        const isCurrentGameEvent = (data = {}) => data.gameId === gameId;

        // Listen for guess/game updates from partner. The backend may emit either
        // a specific event or the generic wordle:update used by AppNavigator.
        const handleGameUpdate = (data = {}) => {
            if (isCurrentGameEvent(data)) {
                if (data.status) {
                    setStatus(data.status);
                    if (['won', 'lost'].includes(data.status)) {
                        requestGameReviewOnce();
                    }
                }
                // Refresh game state to get the latest guesses/secret word.
                fetchGame(gameId);
            }
        };

        // Listen for guess updates from partner
        const handleGuessReceived = (data) => {
            if (data.gameId === gameId) {
                // Refresh game state to get the latest guesses
                fetchGame(gameId);
            }
        };

        // Listen for game completion
        const handleGameComplete = handleGameUpdate;

        // Listen for new game created by partner
        const handleNewGame = (data = {}) => {
            if (data.gameId && data.gameId === gameId) return;

            // Reset state and fetch the new game
            setGuesses([]);
            setCurrentGuess('');
            setKeyboardState({});
            setStatus('pending');
            setRevealedWord('');
            setSuccessMessage('');
            setErrorMessage('');
            setLastSubmittedRowIndex(-1);
            hasRequestedGameReviewRef.current = false;
            // Fetch the new active game
            fetchActiveGame();
        };

        socket.on('wordle:guessReceived', handleGuessReceived);
        socket.on('wordle:gameComplete', handleGameComplete);
        socket.on('wordle:update', handleGameUpdate);
        socket.on('wordle:newGame', handleNewGame);

        return () => {
            if (gameId) {
                socket.emit('wordle:leave', { gameId });
            }
            socket.off('wordle:guessReceived', handleGuessReceived);
            socket.off('wordle:gameComplete', handleGameComplete);
            socket.off('wordle:update', handleGameUpdate);
            socket.off('wordle:newGame', handleNewGame);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, gameId]);

    const loadGameFromData = (data) => {
        setGameId(data._id);
        setGuesses(data.guesses || []);
        setStatus(data.status || 'pending');
        setMaxAttempts(data.maxAttempts || 6);
        const creatorCheck = data.creatorId?._id === user?.id || data.creatorId === user?.id;
        setIsCreator(creatorCheck);

        if (creatorCheck) {
            // Creator views their game (waiting for partner)
            setSecretWord(data.secretWord || '');
            setMode('complete');
        } else {
            // Guesser mode
            updateKeyboardState(data.guesses || []);
            if (['won', 'lost'].includes(data.status)) {
                setRevealedWord(data.secretWord || '');
                setMode('complete');
                requestGameReviewOnce();
            } else {
                setMode('guess');
            }
        }
        setLoading(false);
    };

    const fetchActiveGame = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/wordle/active/${user?.id}`);
            const data = await response.json();

            if (data.success && data.data) {
                loadGameFromData(data.data);
            } else {
                // No active game - create mode
                setMode('create');
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching active Wordle:', error);
            setMode('create');
            setLoading(false);
        }
    };

    const fetchGame = async (id) => {
        try {
            const response = await fetch(`${API_BASE}/api/wordle/${id}?userId=${user?.id}`);
            const data = await response.json();
            if (data.success) {
                loadGameFromData(data.data);
            } else {
                setErrorMessage('Failed to load game');
                setTimeout(() => navigation?.goBack?.(), 2000);
            }
        } catch (error) {
            console.error('Fetch game error:', error);
            setErrorMessage('Failed to load game');
            setTimeout(() => navigation?.goBack?.(), 2000);
        }
    };

    const updateKeyboardState = (allGuesses) => {
        const newState = {};
        allGuesses.forEach(guess => {
            guess.result.forEach(({ letter, status }) => {
                const upperLetter = letter.toUpperCase();
                // Priority: correct > present > absent
                if (status === 'correct') {
                    newState[upperLetter] = 'correct';
                } else if (status === 'present' && newState[upperLetter] !== 'correct') {
                    newState[upperLetter] = 'present';
                } else if (status === 'absent' && !newState[upperLetter]) {
                    newState[upperLetter] = 'absent';
                }
            });
        });
        setKeyboardState(newState);
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
        if (submitting) return;

        const word = wordOverride || secretWord;
        if (word.length !== 5) {
            setErrorMessage('Word must be 5 letters');
            shakeRow();
            return;
        }

        setSubmitting(true);
        setErrorMessage('');

        try {
            const response = await fetch(`${API_BASE}/api/wordle/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creatorId: user?.id,
                    partnerId: partnerId,
                    secretWord: word.toLowerCase(),
                }),
            });
            const data = await response.json();

            if (data.success) {
                setGameId(data.data.gameId);
                setSuccessMessage(`Word set! ${partnerName} has been notified.`);
                setMode('complete');

                // Emit socket events to notify partner in real-time
                if (socket) {
                    socket.emit('wordle:invite', { gameId: data.data.gameId });
                    // Emit newGame event so partner's screen refreshes
                    socket.emit('wordle:newGame', {
                        gameId: data.data.gameId,
                        status: 'pending',
                        creatorId: user?.id,
                        partnerId,
                    });
                }
            } else {
                setErrorMessage(data.message || 'Invalid word');
                shakeRow();
            }
        } catch (error) {
            console.error('Create game error:', error);
            setErrorMessage('Failed to create game');
        } finally {
            setSubmitting(false);
        }
    };

    // Submit a guess
    const submitGuess = async (guessOverride) => {
        if (submitting) return;

        const guess = guessOverride || currentGuess;
        if (guess.length !== 5) {
            setErrorMessage('Guess must be 5 letters');
            shakeRow();
            return;
        }

        setSubmitting(true);
        setErrorMessage('');

        try {
            const response = await fetch(`${API_BASE}/api/wordle/${gameId}/guess`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.id,
                    guess: guess.toLowerCase(),
                }),
            });
            const data = await response.json();

            if (data.success) {
                setLastSubmittedRowIndex(guesses.length);
                const newGuess = {
                    word: guess.toLowerCase(),
                    result: data.data.guessResult,
                };
                const updatedGuesses = [...guesses, newGuess];
                setGuesses(updatedGuesses);
                updateKeyboardState(updatedGuesses);
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
                    socket.emit('wordle:update', {
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

                    // Emit completion event
                    if (socket) {
                        socket.emit('wordle:complete', {
                            gameId,
                            status: data.data.status,
                            winnerId: data.data.isCorrect ? user?.id : null
                        });
                        socket.emit('wordle:update', {
                            gameId,
                            status: data.data.status,
                            winnerId: data.data.isCorrect ? user?.id : null,
                            gameComplete: true
                        });
                    }
                }
            } else {
                setErrorMessage(data.message || 'Invalid guess');
                shakeRow();
            }
        } catch (error) {
            console.error('Guess error:', error);
            setErrorMessage('Failed to submit guess');
        } finally {
            setSubmitting(false);
        }
    };

    const startNewGame = () => {
        setGuesses([]);
        setCurrentGuess('');
        setSecretWord('');
        setKeyboardState({});
        setStatus('pending');
        setRevealedWord('');
        setSuccessMessage('');
        setErrorMessage('');
        setLastSubmittedRowIndex(-1);
        setIsCreator(true);
        hasRequestedGameReviewRef.current = false;
        setMode('create');
    };

    const notifyPartner = async () => {
        const now = Date.now();
        if (now - lastNotifyTime < 5 * 60 * 1000) {
            const remaining = Math.ceil((5 * 60 * 1000 - (now - lastNotifyTime)) / 60000);
            setNotifyMessage(`Wait ${remaining} min to notify again`);
            setTimeout(() => setNotifyMessage(''), 3000);
            return;
        }

        setNotifying(true);
        try {
            const response = await fetch(`${API_BASE}/api/wordle/${gameId}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user?.id }),
            });
            const data = await response.json();
            if (data.success) {
                setLastNotifyTime(now);
                setNotifyMessage(`${partnerName} notified!`);
                setTimeout(() => setNotifyMessage(''), 3000);
            }
        } catch (error) {
            setNotifyMessage('Failed to notify');
            setTimeout(() => setNotifyMessage(''), 3000);
        } finally {
            setNotifying(false);
        }
    };

    // Handle text input change - only allow letters
    const handleTextChange = (text) => {
        if (submitting) return;

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
                if (!user?.partnerId) {
                    // Show link partner prompt if no partner
                    setShowLinkPartner(true);
                    Keyboard.dismiss();
                } else {
                    setTimeout(() => createGame(limitedText), 100);
                }
            } else {
                setShowLinkPartner(false);
            }
        } else {
            setCurrentGuess(limitedText);
            // Auto-submit when 5 letters entered - pass word directly
            if (limitedText.length === 5) {
                setTimeout(() => submitGuess(limitedText), 100);
            }
        }
        setErrorMessage('');
    };

    const handleSubmit = () => {
        if (mode === 'create') {
            createGame();
        } else if (mode === 'guess') {
            submitGuess();
        }
    };

    // Render a guess row
    const renderGuessRow = (guess, rowIndex) => {
        const tiles = [];
        const isNewRow = rowIndex === lastSubmittedRowIndex;
        for (let i = 0; i < 5; i++) {
            const letter = guess?.word?.[i] || '';
            const status = guess?.result?.[i]?.status || null;
            tiles.push(
                <AnimatedWordleTile
                    key={i}
                    letter={letter}
                    status={status}
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
                        <Text style={styles.loadingText}>Loading...</Text>
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
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
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
                            <Text style={styles.headerTitle}>Wordle</Text>
                        </View>
                        <View style={styles.headerRight}>
                            {partnerOnline ? (
                                <View style={styles.onlineIndicator}>
                                    <View style={styles.onlineDot} />
                                    <Text style={styles.onlineText}>Online</Text>
                                </View>
                            ) : (
                                <View style={styles.offlineIndicator}>
                                    <View style={styles.offlineDot} />
                                    <Text style={styles.offlineText}>Offline</Text>
                                </View>
                            )}
                        </View>
                    </View>



                    {/* Message slots stay mounted so validation feedback does not shift the grid. */}
                    <View style={styles.notifyMessageContainer}>
                        <Text style={styles.notifyMessageText}>{notifyMessage}</Text>
                    </View>



                    {/* Game Grid */}
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.gridContainer}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {mode === 'create' && (
                            <>
                                {renderCurrentRow()}
                                {!showLinkPartner && (
                                    <Text style={styles.hintText}>Type a 5-letter word</Text>
                                )}
                                {showLinkPartner && (
                                    <View style={styles.linkPartnerCard}>
                                        <Text style={styles.linkPartnerText}>
                                            Link a partner to send this word
                                        </Text>
                                        <TouchableOpacity
                                            onPress={onLinkPartner}
                                            activeOpacity={0.8}
                                            style={styles.playAgainButton}
                                        >
                                            <Text style={styles.playAgainText}>Link Partner 🔗</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
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
                                            {partnerName}'s guesses:
                                        </Text>
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
                        <View style={[styles.statusContainer, { marginTop: 16 }]}>
                            {mode === 'create' && (
                                <Text style={styles.statusText}>Set a word for {partnerName} to guess</Text>
                            )}
                            {mode === 'guess' && (
                                <Text style={styles.statusText}>
                                    Guess the word! ({attemptsRemaining} attempts left)
                                </Text>
                            )}
                            {/* Creator views - different states */}
                            {mode === 'complete' && isCreator && successMessage && status === 'pending' && (
                                <Text style={[styles.statusText, styles.statusSuccess]}>
                                    {successMessage}
                                </Text>
                            )}
                            {mode === 'complete' && isCreator && !successMessage && status === 'pending' && (
                                <Text style={styles.statusText}>
                                    Waiting for {partnerName} to start guessing...
                                </Text>
                            )}
                            {mode === 'complete' && isCreator && status === 'in_progress' && (
                                <Text style={styles.statusText}>
                                    {partnerName} is guessing... ({guesses.length}/{maxAttempts} tries used)
                                </Text>
                            )}
                            {mode === 'complete' && isCreator && status === 'won' && (
                                <Text style={[styles.statusText, styles.statusWin]}>
                                    {partnerName} guessed it in {guesses.length} {guesses.length === 1 ? 'try' : 'tries'}!
                                </Text>
                            )}
                            {mode === 'complete' && isCreator && status === 'lost' && (
                                <Text style={[styles.statusText, styles.statusLose]}>
                                    {partnerName} couldn't guess "{secretWord}"
                                </Text>
                            )}
                            {/* Guesser views */}
                            {mode === 'complete' && !isCreator && status === 'won' && (
                                <Text style={[styles.statusText, styles.statusWin]}>You Won in {guesses.length} {guesses.length === 1 ? 'try' : 'tries'}!</Text>
                            )}
                            {mode === 'complete' && !isCreator && status === 'lost' && (
                                <Text style={[styles.statusText, styles.statusLose]}>
                                    Game Over - The word was "{revealedWord}"
                                </Text>
                            )}
                        </View>
                    </ScrollView>

                    {/* Hidden TextInput for native keyboard */}
                    {(mode === 'create' || mode === 'guess') && (
                        <TextInput
                            ref={inputRef}
                            style={styles.hiddenInput}
                            value={mode === 'create' ? secretWord : currentGuess}
                            onChangeText={handleTextChange}
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
                                onPress={startNewGame}
                                activeOpacity={0.8}
                                style={styles.playAgainButton}
                            >
                                <Text style={styles.playAgainText}>Play Again</Text>
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
                                    notifying && { opacity: 0.5 },
                                ]}
                            >
                                {notifying ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.playAgainText}>{`Nudge ${partnerName}`}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}

                    {status === 'won' && (
                        <ConfettiCannon
                            count={150}
                            origin={{ x: Dimensions.get('window').width / 2, y: -20 }}
                            autoStart={true}
                            fadeOut={true}
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
                        <Text style={styles.floatingErrorText}>{errorMessage}</Text>
                    </Animated.View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
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
});

export default WordleScreen;
