// WordleScreen - Partner Wordle game with word creation and guessing
import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing } from '../theme';
import GradientBackground from '../components/GradientBackground';
import { API_BASE } from '../constants/Api';
import { getUser } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';

const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫']
];

const WordleScreen = ({ navigation, route }) => {
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

    // Keyboard state (for coloring used letters)
    const [keyboardState, setKeyboardState] = useState({});

    // Partner info
    const partnerId = route?.params?.partnerId;
    const partnerName = route?.params?.partnerName || 'Partner';

    // Animation
    const shakeAnim = useState(new Animated.Value(0))[0];

    // Load or check for active game
    useEffect(() => {
        if (initialGameData) {
            loadGameFromData(initialGameData);
        } else if (initialGameId) {
            fetchGame(initialGameId);
        } else {
            fetchActiveGame();
        }
    }, []);

    // Socket listeners for real-time updates
    useEffect(() => {
        if (!socket) return;

        // Join game room if we have a gameId
        if (gameId) {
            socket.emit('wordle:join', { gameId });
        }

        // Listen for guess updates from partner
        const handleGuessReceived = (data) => {
            console.log('🎯 Received wordle:guessReceived', data);
            if (data.gameId === gameId) {
                // Refresh game state to get the latest guesses
                fetchGame(gameId);
            }
        };

        // Listen for game completion
        const handleGameComplete = (data) => {
            console.log('🎯 Received wordle:gameComplete', data);
            if (data.gameId === gameId) {
                setStatus(data.status);
                fetchGame(gameId);
            }
        };

        // Listen for new game created by partner
        const handleNewGame = (data) => {
            console.log('🎯 New Wordle game received from partner:', data);
            // Reset state and fetch the new game
            setGuesses([]);
            setCurrentGuess('');
            setKeyboardState({});
            setStatus('pending');
            setRevealedWord('');
            setSuccessMessage('');
            setErrorMessage('');
            // Fetch the new active game
            fetchActiveGame();
        };

        socket.on('wordle:guessReceived', handleGuessReceived);
        socket.on('wordle:gameComplete', handleGameComplete);
        socket.on('wordle:newGame', handleNewGame);

        return () => {
            if (gameId) {
                socket.emit('wordle:leave', { gameId });
            }
            socket.off('wordle:guessReceived', handleGuessReceived);
            socket.off('wordle:gameComplete', handleGameComplete);
            socket.off('wordle:newGame', handleNewGame);
        };
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
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 100, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 100, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
    };

    // Create game with secret word
    const createGame = async () => {
        if (secretWord.length !== 5) {
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
                    secretWord: secretWord.toLowerCase(),
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
    const submitGuess = async () => {
        if (currentGuess.length !== 5) {
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
                    guess: currentGuess.toLowerCase(),
                }),
            });
            const data = await response.json();

            if (data.success) {
                const newGuess = {
                    word: currentGuess.toLowerCase(),
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
                }

                if (data.data.gameComplete) {
                    setRevealedWord(data.data.secretWord);
                    setMode('complete');

                    // Emit completion event
                    if (socket) {
                        socket.emit('wordle:complete', {
                            gameId,
                            status: data.data.status,
                            winnerId: data.data.isCorrect ? user?.id : null
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

    // Handle keyboard press
    const handleKeyPress = (key) => {
        if (submitting) return;

        const targetWord = mode === 'create' ? secretWord : currentGuess;
        const setTargetWord = mode === 'create' ? setSecretWord : setCurrentGuess;

        if (key === '⌫') {
            setTargetWord(targetWord.slice(0, -1));
            setErrorMessage('');
        } else if (key === 'ENTER') {
            if (mode === 'create') {
                createGame();
            } else if (mode === 'guess') {
                submitGuess();
            }
        } else if (targetWord.length < 5) {
            setTargetWord(targetWord + key);
            setErrorMessage('');
        }
    };

    // Render a single tile
    const renderTile = (letter, status, index) => {
        let bgColor = colors.surface;
        let textColor = colors.text;
        let borderColor = '#D3D6DA';

        if (status === 'correct') {
            bgColor = '#6AAA64'; // Green
            textColor = '#FFFFFF';
            borderColor = '#6AAA64';
        } else if (status === 'present') {
            bgColor = '#C9B458'; // Yellow
            textColor = '#FFFFFF';
            borderColor = '#C9B458';
        } else if (status === 'absent') {
            bgColor = '#787C7E'; // Gray
            textColor = '#FFFFFF';
            borderColor = '#787C7E';
        } else if (letter) {
            borderColor = '#878A8C';
        }

        return (
            <View key={index} style={[styles.tile, { backgroundColor: bgColor, borderColor }]}>
                <Text style={[styles.tileText, { color: textColor }]}>{letter?.toUpperCase() || ''}</Text>
            </View>
        );
    };

    // Render a guess row
    const renderGuessRow = (guess, rowIndex) => {
        const tiles = [];
        for (let i = 0; i < 5; i++) {
            const letter = guess?.word?.[i] || '';
            const status = guess?.result?.[i]?.status || null;
            tiles.push(renderTile(letter, status, i));
        }
        return (
            <View key={rowIndex} style={styles.guessRow}>
                {tiles}
            </View>
        );
    };

    // Render current input row
    const renderCurrentRow = () => {
        const word = mode === 'create' ? secretWord : currentGuess;
        const tiles = [];
        for (let i = 0; i < 5; i++) {
            tiles.push(renderTile(word[i] || '', null, i));
        }
        return (
            <Animated.View style={[styles.guessRow, { transform: [{ translateX: shakeAnim }] }]}>
                {tiles}
            </Animated.View>
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

    // Render keyboard key
    const renderKey = (key) => {
        const isEnter = key === 'ENTER';
        const isBackspace = key === '⌫';
        const isSpecial = isEnter || isBackspace;
        const keyStatus = keyboardState[key];

        let bgColor = 'rgba(211, 214, 218, 0.95)';
        let textColor = colors.text;

        if (keyStatus === 'correct') {
            bgColor = '#6AAA64';
            textColor = '#FFFFFF';
        } else if (keyStatus === 'present') {
            bgColor = '#C9B458';
            textColor = '#FFFFFF';
        } else if (keyStatus === 'absent') {
            bgColor = '#787C7E';
            textColor = '#FFFFFF';
        }

        return (
            <TouchableOpacity
                key={key}
                style={[
                    styles.keyboardKey,
                    isSpecial && styles.keyboardKeyWide,
                    isEnter && styles.keyboardKeyEnter,
                    { backgroundColor: bgColor }
                ]}
                onPress={() => handleKeyPress(key)}
                activeOpacity={0.6}
            >
                {isBackspace ? (
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                        <Path
                            d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2zm-3 11l-4-4m0 0l-4 4m4-4l4-4m-4 4l-4-4"
                            stroke={textColor}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                ) : (
                    <Text style={[
                        styles.keyboardKeyText,
                        isEnter && styles.keyboardKeyTextSmall,
                        { color: textColor }
                    ]}>
                        {isEnter ? '↵' : key}
                    </Text>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <GradientBackground variant="warm">
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
        <GradientBackground variant="warm">
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M19 12H5M12 19l-7-7 7-7"
                                stroke={colors.text}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Wordle</Text>
                    <View style={styles.headerRight}>
                        {partnerOnline && (
                            <View style={styles.onlineIndicator}>
                                <View style={styles.onlineDot} />
                                <Text style={styles.onlineText}>Online</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Status Text */}
                <View style={styles.statusContainer}>
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

                {/* Notify Message */}
                {notifyMessage ? (
                    <View style={styles.notifyMessageContainer}>
                        <Text style={styles.notifyMessageText}>{notifyMessage}</Text>
                    </View>
                ) : null}

                {/* Error Message */}
                {errorMessage ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{errorMessage}</Text>
                    </View>
                ) : null}

                {/* Game Grid */}
                <View style={styles.gridContainer}>
                    {mode === 'create' && (
                        <>
                            {renderCurrentRow()}
                            <Text style={styles.hintText}>Type a 5-letter word</Text>
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
                                    <View key={i} style={[styles.tile, styles.tileSecret]}>
                                        <Text style={[styles.tileText, { color: '#FFFFFF' }]}>
                                            {letter.toUpperCase()}
                                        </Text>
                                    </View>
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

                            {/* Waiting message when no guesses yet */}
                            {guesses.length === 0 && status === 'pending' && (
                                <Text style={styles.waitingText}>Waiting for {partnerName} to start...</Text>
                            )}
                        </>
                    )}

                    {mode === 'complete' && !isCreator && (
                        <>
                            {guesses.map((guess, i) => renderGuessRow(guess, i))}
                        </>
                    )}
                </View>

                {/* Keyboard */}
                {(mode === 'create' || mode === 'guess') && (
                    <View style={styles.keyboardContainer}>
                        {KEYBOARD_ROWS.map((row, rowIndex) => (
                            <View key={rowIndex} style={styles.keyboardRow}>
                                {row.map(key => renderKey(key))}
                            </View>
                        ))}
                    </View>
                )}

                {/* Action Buttons */}
                {mode === 'complete' && isCreator && gameId && partnerOnline !== true && (status === 'pending' || status === 'in_progress') && (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.notifyButton}
                            onPress={notifyPartner}
                            disabled={notifying}
                        >
                            {notifying ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <Text style={styles.notifyButtonText}>Nudge {partnerName}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {mode === 'complete' && !isCreator && (
                    <View style={styles.actionButtons}>
                        <TouchableOpacity
                            style={styles.backHomeButton}
                            onPress={() => navigation?.goBack?.()}
                        >
                            <Text style={styles.backHomeText}>Back to Home</Text>
                        </TouchableOpacity>
                    </View>
                )}
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
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: 2,
    },
    headerRight: {
        width: 80,
        alignItems: 'flex-end',
    },
    onlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(72, 187, 120, 0.15)',
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
    statusContainer: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 20,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
        textAlign: 'center',
    },
    statusWin: {
        color: '#6AAA64',
        fontSize: 24,
    },
    statusLose: {
        color: '#787C7E',
    },
    statusSuccess: {
        color: '#6AAA64',
        fontSize: 18,
    },
    notifyMessageContainer: {
        alignItems: 'center',
        paddingVertical: 6,
    },
    notifyMessageText: {
        fontSize: 14,
        color: '#6AAA64',
        fontWeight: '600',
    },
    errorContainer: {
        alignItems: 'center',
        paddingVertical: 8,
    },
    errorText: {
        fontSize: 14,
        color: '#FF6B6B',
        fontWeight: '600',
    },
    gridContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    guessRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 6,
    },
    tile: {
        width: 56,
        height: 56,
        borderWidth: 2,
        borderColor: '#D3D6DA',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
    },
    tileSecret: {
        backgroundColor: '#6AAA64',
        borderColor: '#6AAA64',
    },
    tileText: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
    },
    hintText: {
        marginTop: 16,
        fontSize: 14,
        color: colors.textSecondary,
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
        borderTopColor: 'rgba(0,0,0,0.1)',
    },
    creatorGuessesTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 12,
    },
    keyboardContainer: {
        paddingHorizontal: 2,
        paddingBottom: 12,
        paddingTop: 4,
    },
    keyboardRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
        marginBottom: 8,
    },
    keyboardKey: {
        minWidth: 36,
        height: 56,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
    },
    keyboardKeyWide: {
        minWidth: 58,
        paddingHorizontal: 6,
    },
    keyboardKeyEnter: {
        backgroundColor: '#6AAA64',
    },
    keyboardKeyText: {
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    keyboardKeyTextSmall: {
        fontSize: 22,
        fontWeight: '800',
    },
    actionButtons: {
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 40,
    },
    notifyButton: {
        backgroundColor: colors.secondary,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 30,
        minWidth: 200,
        alignItems: 'center',
    },
    notifyButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    backHomeButton: {
        backgroundColor: colors.text,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 30,
    },
    backHomeText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.surface,
    },
});

export default WordleScreen;
