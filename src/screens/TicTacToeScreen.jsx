// TicTacToeScreen - Real-time partner Tic Tac Toe game
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    Animated,
    Easing,
    Platform,
    Image,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import { useSocketContext } from '../context/SocketContext';
import { API_BASE } from '../constants/Api';
import { getUser } from '../utils/authStorage';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';

const AnimatedLine = Animated.createAnimatedComponent(Line);



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

const getCellCenter = (index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = col * 102 + 50;
    const y = row * 102 + 50;
    return { x, y };
};

const AnimatedSymbol = ({ value }) => {
    const scaleAnim = useRef(new Animated.Value(0.3)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Trigger haptic click exactly when showing the mark!
        ReactNativeHapticFeedback.trigger("selection", {
            enableVibrateFallback: false,
            ignoreAndroidSystemSettings: false,
        });

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
    }, []);

    return (
        <Animated.View style={{
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }],
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            height: '100%',
        }}>
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

const TicTacToeScreen = ({ navigation, route }) => {
    const { gameId: initialGameId, gameData: initialGameData } = route?.params || {};
    const { socket, partnerOnline } = useSocketContext();
    const user = getUser();
    const { width: SCREEN_WIDTH } = Dimensions.get('window');

    // Game state
    const [gameId, setGameId] = useState(initialGameId || null);
    const [board, setBoard] = useState(Array(9).fill(null));
    const [currentTurn, setCurrentTurn] = useState('creator');
    const [status, setStatus] = useState('pending');
    const [revealGameOverText, setRevealGameOverText] = useState(false);
    const [creatorSymbol, setCreatorSymbol] = useState('X');
    const [partnerSymbol, setPartnerSymbol] = useState('O');
    const [isCreator, setIsCreator] = useState(true);
    const [winner, setWinner] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notifying, setNotifying] = useState(false);
    const [lastNotifyTime, setLastNotifyTime] = useState(0);
    const [statusMessage, setStatusMessage] = useState(null);
    const statusTimerRef = useRef(null);
    const audioPlayerRef = useRef(null);
    const hasRequestedGameReviewRef = useRef(false);

    const requestGameReviewOnce = useCallback(() => {
        if (hasRequestedGameReviewRef.current) return;
        hasRequestedGameReviewRef.current = true;
        requestReviewForMoment(REVIEW_MOMENTS.GAME_COMPLETED);
    }, []);

    // Initialize audio player on mount
    useEffect(() => {
        audioPlayerRef.current = new AudioRecorderPlayer();
        return () => {
            if (audioPlayerRef.current) {
                audioPlayerRef.current.stopPlayer().catch(() => {});
            }
        };
    }, []);

    // Show inline status message that auto-clears after 3 seconds
    const showStatus = useCallback((message, type = 'error') => {
        if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
        setStatusMessage({ text: message, type });
        statusTimerRef.current = setTimeout(() => setStatusMessage(null), 3000);
    }, []);

    // Game start animation state
    const [countdown, setCountdown] = useState(0);
    const [isGameStarting, setIsGameStarting] = useState(false);
    const [gameStartMessage, setGameStartMessage] = useState('');
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Partner info
    const partnerId = route?.params?.partnerId;
    const partnerName = route?.params?.partnerName || 'Partner';

    // Determine my symbol and if it's my turn
    const mySymbol = isCreator ? creatorSymbol : partnerSymbol;
    const theirSymbol = isCreator ? partnerSymbol : creatorSymbol;
    const isMyTurn = (isCreator && currentTurn === 'creator') || (!isCreator && currentTurn === 'partner');

    // Load or create game
    useEffect(() => {
        if (initialGameData) {
            // Existing game from pending
            loadGameFromData(initialGameData);
        } else if (initialGameId) {
            // Load existing game by ID
            fetchGame(initialGameId);
        } else {
            // Check for existing active game first
            fetchActiveGame();
        }
    }, []);

    // Socket event listeners
    useEffect(() => {
        if (!socket || !gameId) return;

        // Join game room
        socket.emit('tictactoe:join', { gameId });

        // Listen for moves
        const handleMoveReceived = (data) => {
            if (data.gameId === gameId) {
                setBoard(data.board);
                setCurrentTurn(data.currentTurn);
                setStatus(data.status);
                if (data.winner) setWinner(data.winner);
            }
        };

        // Listen for player joined
        const handlePlayerJoined = (data) => {
        };

        // Listen for game complete
        const handleGameComplete = (data) => {
            setStatus(data.status);
            if (data.winnerId) setWinner(data.winnerId);
            requestGameReviewOnce();
        };

        // Listen for new game (Play Again from partner)
        const handleNewGame = (data) => {
            // Reset to the new game state
            setGameId(data.gameId);
            setBoard(data.board || Array(9).fill(null));
            setCurrentTurn(data.currentTurn || 'creator');
            setStatus(data.status || 'active');
            setCreatorSymbol(data.creatorSymbol || 'X');
            setPartnerSymbol(data.partnerSymbol || 'O');
            // Partner is NOT the creator of this new game
            setIsCreator(data.creatorId === user?.id);
            setWinner(null);
            hasRequestedGameReviewRef.current = false;
            setRevealGameOverText(false);
            // Join the new game room
            socket.emit('tictactoe:join', { gameId: data.gameId });
            // Trigger game start animation
            startGameAnimation('Game Started Again! 🎮');
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
    }, [socket, gameId, requestGameReviewOnce]);

    // Game start animation function
    const startGameAnimation = useCallback((message) => {
        setGameStartMessage(message);
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

        const countdownInterval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(countdownInterval);
                    // Fade out and end animation
                    Animated.timing(fadeAnim, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }).start(() => {
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

        return () => clearInterval(countdownInterval);
    }, [fadeAnim, shakeAnim, scaleAnim]);

    const loadGameFromData = (data) => {
        setGameId(data._id);
        setBoard(data.board || Array(9).fill(null));
        setCurrentTurn(data.currentTurn || 'creator');
        setStatus(data.status || 'pending');
        setCreatorSymbol(data.creatorSymbol || 'X');
        setPartnerSymbol(data.partnerSymbol || 'O');
        setIsCreator(data.creatorId?._id === user?.id || data.creatorId === user?.id);
        setWinner(data.winner);
        setRevealGameOverText(['won_creator', 'won_partner', 'draw'].includes(data.status));
        setLoading(false);
    };

    const fetchActiveGame = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/active/${user?.id}`);
            const data = await response.json();

            if (data.success && data.data) {
                // Active game exists - load it
                loadGameFromData(data.data);
            } else {
                // No active game - show empty board, ready to create on first move
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
    };

    const fetchGame = async (id) => {
        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/${id}`);
            const data = await response.json();
            if (data.success) {
                loadGameFromData(data.data);
            } else {
                showStatus('Failed to load game');
                navigation?.goBack?.();
            }
        } catch (error) {
            console.error('Fetch game error:', error);
            showStatus('Failed to load game');
            navigation?.goBack?.();
        }
    };

    // Create game with first move (called when tapping first cell)
    const createGameWithFirstMove = async (position) => {
        if (!user?.id || !partnerId) {
            // Partner not linked - button will show below
            return;
        }

        // Optimistic update
        const newBoard = [...board];
        newBoard[position] = 'X'; // Creator is always X
        setBoard(newBoard);

        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creatorId: user.id,
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
                setBoard(Array(9).fill(null));
                showStatus(data.message || 'Failed to create game');
            }
        } catch (error) {
            setBoard(Array(9).fill(null));
            console.error('Create game error:', error);
            showStatus('Failed to create game');
        }
    };

    // Create new game (for Play Again functionality)
    const createNewGame = async () => {
        if (!user?.id || !partnerId) {
            // Partner not linked - button will show below
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creatorId: user.id,
                    partnerId: partnerId,
                    creatorSymbol: 'X',
                }),
            });
            const data = await response.json();
            if (data.success) {
                setGameId(data.data.gameId);
                setBoard(data.data.board);
                setCurrentTurn(data.data.currentTurn);
                setStatus(data.data.status);
                setCreatorSymbol(data.data.creatorSymbol);
                setPartnerSymbol(data.data.partnerSymbol);
                setIsCreator(true);
                setLoading(false);

                // Join socket room and notify partner of new game
                if (socket) {
                    socket.emit('tictactoe:join', { gameId: data.data.gameId });
                    socket.emit('tictactoe:invite', { gameId: data.data.gameId });
                    // Emit new game event so partner's board resets
                    socket.emit('tictactoe:newGame', {
                        gameId: data.data.gameId,
                        board: data.data.board,
                        currentTurn: data.data.currentTurn,
                        status: data.data.status,
                        creatorSymbol: data.data.creatorSymbol,
                        partnerSymbol: data.data.partnerSymbol,
                    });
                }
                // Reset winner state for new game
                setWinner(null);
                setRevealGameOverText(false);
                // Trigger game start animation for creator
                startGameAnimation('Game Started Again! 🎮');
            } else {
                showStatus(data.message || 'Failed to create game');
                navigation?.goBack?.();
            }
        } catch (error) {
            console.error('Create game error:', error);
            showStatus('Failed to create game');
            navigation?.goBack?.();
        }
    };

    const makeMove = async (position) => {
        // Block moves during game start animation
        if (isGameStarting) return;

        // If no game exists yet (status is 'new'), create game with first move
        if (!gameId && status === 'new') {
            await createGameWithFirstMove(position);
            return;
        }

        if (!isMyTurn || board[position] !== null || isGameOver) return;

        // Optimistic update
        const newBoard = [...board];
        newBoard[position] = mySymbol;
        setBoard(newBoard);

        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/${gameId}/move`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    position,
                }),
            });
            const data = await response.json();
            if (data.success) {
                setBoard(data.data.board);
                setCurrentTurn(data.data.currentTurn);
                setStatus(data.data.status);
                if (data.data.winner) setWinner(data.data.winner);

                // Broadcast move via socket
                if (socket) {
                    socket.emit('tictactoe:move', {
                        gameId,
                        position,
                        board: data.data.board,
                        currentTurn: data.data.currentTurn,
                        status: data.data.status,
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
            } else {
                // Revert optimistic update
                setBoard(board);
                showStatus(data.message || 'Invalid move');
            }
        } catch (error) {
            setBoard(board);
            console.error('Move error:', error);
        }
    };

    const notifyPartner = async () => {
        // Cooldown check (5 minutes)
        const now = Date.now();
        if (now - lastNotifyTime < 5 * 60 * 1000) {
            const remaining = Math.ceil((5 * 60 * 1000 - (now - lastNotifyTime)) / 60000);
            showStatus(`You can notify again in ${remaining} minute(s)`, 'info');
            return;
        }

        setNotifying(true);
        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/${gameId}/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id }),
            });
            const data = await response.json();
            if (data.success) {
                setLastNotifyTime(now);
                showStatus(`${partnerName} has been notified ✓`, 'success');
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
        if (loading) return 'Loading...';
        if (isGameStarting) return `${gameStartMessage}\n${countdown > 0 ? countdown : 'GO!'}`;
        if (isNewGame) return 'Tap to start game!';
        if (status === 'draw') return "It's a draw! 🤝";
        if (didIWin) return `🎉 You won! 💜`;
        if (didTheyWin) return `🎉 ${partnerName} won! 💜`;
        return '';
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
    const highlightAnim = useRef(new Animated.Value(0)).current;
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
            lineAnim.setValue(0);
            highlightAnim.setValue(0);
            setRevealGameOverText(false);
            
            // Play game over result sound effect!
            playResultSound();

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
            highlightAnim.setValue(0);
            setRevealGameOverText(false);
            if (audioPlayerRef.current) {
                audioPlayerRef.current.stopPlayer().catch(() => {});
            }
        }
    }, [winningLine, playResultSound]);

    const lineData = React.useMemo(() => {
        if (winningLine.length === 0) return { startX: 0, startY: 0, length: 0, angle: '0rad', originalLength: 0, padding: 0 };
        const startCenter = getCellCenter(winningLine[0]);
        const endCenter = getCellCenter(winningLine[2]);
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
    }, [winningLine]);

    const renderCell = (index) => {
        const value = board[index];

        // Allow tapping if: new game OR (my turn AND cell empty AND game not over)
        const canTap = isNewGame || (isMyTurn && value === null && !isGameOver);

        const cellOpacity = 1;

        return (
            <Animated.View
                key={index}
                style={[
                    styles.cell,
                    index % 3 !== 2 && styles.cellBorderRight,
                    index < 6 && styles.cellBorderBottom,
                    { opacity: cellOpacity }
                ]}
            >
                <TouchableOpacity
                    onPress={() => makeMove(index)}
                    disabled={!canTap}
                    activeOpacity={0.7}
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                        height: '100%'
                    }}
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
                        <Text style={styles.loadingText}>Setting up game...</Text>
                    </View>
                </SafeAreaView>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground variant="light" showOrbs={true} showParticles={true}>
            <SafeAreaView style={styles.container} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack?.()}>
                            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M19 12H5M12 19l-7-7 7-7"
                                    stroke={colors.text}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </Svg>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Tic Tac Toe</Text>
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

                {/* Player Info */}
                <View style={styles.playersContainer}>
                    {/* Left Card: YOU */}
                    <View style={[styles.playerCard, leftActive && styles.activePlayer]}>
                        {leftActive && (
                            <>
                                <SparkleStar size={11} color="#C084FC" style={{ position: 'absolute', left: 10, top: 10 }} />
                                <SparkleStar size={9} color="#C084FC" style={{ position: 'absolute', right: 10, top: 8 }} />
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
                        <View style={styles.youBadge}>
                            <Text style={styles.youBadgeText}>YOU</Text>
                        </View>
                    </View>

                    <View style={styles.vsBadge}>
                        <Text style={styles.vsBadgeText}>vs</Text>
                    </View>

                    {/* Right Card: Partner */}
                    <View style={[styles.playerCard, rightActive && styles.activePlayer]}>
                        {rightActive && (
                            <>
                                <SparkleStar size={11} color="#C084FC" style={{ position: 'absolute', left: 10, top: 10 }} />
                                <SparkleStar size={9} color="#C084FC" style={{ position: 'absolute', right: 10, top: 8 }} />
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
                    </View>
                </View>

                {/* Status */}
                <View style={styles.statusContainer}>
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
                                style={{
                                    position: 'absolute',
                                    left: lineData.startX,
                                    top: lineData.startY,
                                    width: 0,
                                    height: 0,
                                    transform: [
                                        { rotate: lineData.angle }
                                    ],
                                }}
                            >
                                <Animated.View
                                    style={{
                                        position: 'absolute',
                                        left: -lineData.padding,
                                        top: -9,
                                        width: lineData.length,
                                        height: 18,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        transform: [
                                            { translateX: lineAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [-lineData.length / 2, 0]
                                            }) },
                                            { scaleX: lineAnim }
                                        ],
                                    }}
                                >
                                    {/* Neon Outer Halo Glow */}
                                    <View
                                        style={{
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
                                            elevation: 4,
                                        }}
                                    />
                                    {/* Bright White Core */}
                                    <View
                                        style={{
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
                                        }}
                                    />
                                </Animated.View>
                                <SparkleStar
                                    size={22}
                                    color="#F472B6"
                                    style={{
                                        position: 'absolute',
                                        left: -lineData.padding - 11,
                                        top: -11,
                                        width: 22,
                                        height: 22,
                                        opacity: lineAnim.interpolate({
                                            inputRange: [0, 0.8, 1],
                                            outputRange: [0, 0, 1],
                                            extrapolate: 'clamp'
                                        }),
                                        transform: [{
                                            scale: lineAnim.interpolate({
                                                inputRange: [0, 0.8, 1],
                                                outputRange: [0, 0, 1],
                                                extrapolate: 'clamp'
                                            })
                                        }]
                                    }}
                                />
                                <SparkleStar
                                    size={22}
                                    color="#F472B6"
                                    style={{
                                        position: 'absolute',
                                        left: lineData.length - lineData.padding - 11,
                                        top: -11,
                                        width: 22,
                                        height: 22,
                                        opacity: lineAnim.interpolate({
                                            inputRange: [0, 0.8, 1],
                                            outputRange: [0, 0, 1],
                                            extrapolate: 'clamp'
                                        }),
                                        transform: [{
                                            scale: lineAnim.interpolate({
                                                inputRange: [0, 0.8, 1],
                                                outputRange: [0, 0, 1],
                                                extrapolate: 'clamp'
                                            })
                                        }]
                                    }}
                                />
                            </Animated.View>
                        )}
                    </Animated.View>

                    {/* Play Again Button Just Below the Board */}
                    {isGameOver && (revealGameOverText || status === 'draw') && (
                        <View style={styles.boardGameOverButtons}>
                            <TouchableOpacity
                                onPress={createNewGame}
                                activeOpacity={0.8}
                                style={styles.premiumPlayAgainButton}
                            >
                                <Text style={styles.premiumPlayAgainText}>Play Again</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Bottom Actions Container - fixed height to prevent layout shift */}
                <View style={styles.bottomActionsContainer}>
                    {!isGameOver && gameId && !(isMyTurn || partnerOnline) ? (
                        <View style={styles.notifyButtonContainer}>
                            <Button
                                title={`Nudge ${partnerName}`}
                                onPress={notifyPartner}
                                variant="primary"
                                size="md"
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
                                style={{ marginHorizontal: 40 }}
                            />
                        </View>
                    ) : null}
                </View>

                {/* Link Partner Button - shown when no partner is linked */}
                {!partnerId && (
                    <View style={styles.linkPartnerContainer}>
                        <Button
                            title="Link Partner to Play 🔗"
                            onPress={() => navigation?.navigate?.('PartnerLink')}
                            variant="primary"
                            size="xl"
                            fullWidth
                        />
                    </View>
                )}

                {didIWin && revealGameOverText && (
                    <ConfettiCannon
                        count={150}
                        origin={{ x: SCREEN_WIDTH / 2, y: -20 }}
                        autoStart={true}
                        fadeOut={true}
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
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
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
        paddingVertical: 24,
        gap: 16,
    },
    playerCard: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        width: 110,
        height: 125,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F3E8FF',
        position: 'relative',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.04,
                shadowRadius: 10,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    activePlayer: {
        borderWidth: 2,
        borderColor: '#E9D5FF',
        shadowColor: '#A855F7',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    cardSymbolContainer: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    youBadge: {
        backgroundColor: 'rgba(168, 85, 247, 0.08)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 8,
    },
    youBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#A855F7',
        letterSpacing: 0.5,
    },
    partnerNameText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4B5563',
        marginTop: 8,
        textAlign: 'center',
        width: '90%',
    },
    vsBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FAF5FF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#F3E8FF',
    },
    vsBadgeText: {
        fontSize: 12,
        fontFamily: fontFamily.bold,
        color: '#A855F7',
    },
    statusContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    statusText: {
        fontSize: 22,
        fontFamily: fontFamily.extraBold,
        color: '#EC4899',
        textAlign: 'center',
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
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    board: {
        width: 306,
        height: 306,
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#F3E8FF',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.05,
                shadowRadius: 20,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    cell: {
        width: 101,
        height: 101,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cellBorderRight: {
        borderRightWidth: 1.5,
        borderRightColor: '#F3E8FF',
    },
    cellBorderBottom: {
        borderBottomWidth: 1.5,
        borderBottomColor: '#F3E8FF',
    },
    cellWinning: {
        backgroundColor: 'transparent',
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
    gameOverButtons: {
        width: '100%',
        paddingHorizontal: 40,
        justifyContent: 'center',
    },
    premiumPlayAgainButton: {
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
    premiumPlayAgainGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    premiumPlayAgainText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    premiumShareButton: {
        width: '100%',
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: 'rgba(168, 85, 247, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    premiumShareText: {
        color: '#A855F7',
        fontSize: 16,
        fontWeight: '700',
    },
    premiumButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    linkPartnerContainer: {
        paddingHorizontal: 40,
        paddingBottom: 30,
    },
    boardGameOverButtons: {
        width: 306,
        marginTop: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default TicTacToeScreen;
