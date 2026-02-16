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
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing } from '../theme';
import GradientBackground from '../components/GradientBackground';
import { API_BASE } from '../constants/Api';
import { getUser } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';



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

    // Input ref for focus management
    const inputRef = useRef(null);

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

        // Listen for guess updates from partner
        const handleGuessReceived = (data) => {
            if (data.gameId === gameId) {
                // Refresh game state to get the latest guesses
                fetchGame(gameId);
            }
        };

        // Listen for game completion
        const handleGameComplete = (data) => {
            if (data.gameId === gameId) {
                setStatus(data.status);
                fetchGame(gameId);
            }
        };

        // Listen for new game created by partner
        const handleNewGame = (data) => {
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
    const createGame = async (wordOverride) => {
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

    // Handle text input change - only allow letters
    const handleTextChange = (text) => {
        if (submitting) return;

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

    // Handle submit action
    const handleSubmit = () => {
        if (mode === 'create') {
            createGame();
        } else if (mode === 'guess') {
            submitGuess();
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

    // Render current input row (tappable to open keyboard)
    const renderCurrentRow = () => {
        const word = mode === 'create' ? secretWord : currentGuess;
        const tiles = [];
        for (let i = 0; i < 5; i++) {
            tiles.push(renderTile(word[i] || '', null, i));
        }
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => inputRef.current?.focus()}
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
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
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
                                    <View style={styles.linkPartnerContainer}>
                                        <Text style={styles.linkPartnerText}>
                                            Link a partner to send this word
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.linkPartnerButton}
                                            onPress={onLinkPartner}
                                        >
                                            <Text style={styles.linkPartnerButtonText}>
                                                Link Partner 🔗
                                            </Text>
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
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
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
    linkPartnerContainer: {
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 20,
    },
    linkPartnerText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 24,
    },
    linkPartnerButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 30,
    },
    linkPartnerButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
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
