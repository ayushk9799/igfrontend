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
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import ConfettiCannon from 'react-native-confetti-cannon';
import { colors, spacing } from '../theme';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import { useSocketContext } from '../context/SocketContext';
import { API_BASE } from '../constants/Api';
import { getUser } from '../utils/authStorage';

const AnimatedLine = Animated.createAnimatedComponent(Line);

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

const AnimatedSymbol = ({ value, mySymbol }) => {
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
        }}>
            {value === 'X' ? (
                <Text style={[styles.symbolX, value === mySymbol && styles.mySymbol]}>
                    ✕
                </Text>
            ) : (
                <Text style={[styles.symbolO, value === mySymbol && styles.mySymbol]}>
                    ○
                </Text>
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
    }, [socket, gameId]);

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

    const getStatusText = () => {
        if (loading) return 'Loading...';
        if (isGameStarting) return `${gameStartMessage}\n${countdown > 0 ? countdown : 'GO!'}`;
        if (isNewGame) return 'Tap to start game!';
        if (status === 'draw') return "It's a draw! 🤝";
        if (didIWin) return 'You won! 🎉';
        if (didTheyWin) return `${partnerName} won! 💜`;
        if (isMyTurn) return 'Your turn';
        return `${partnerName}'s turn`;
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
                duration: 500,
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

    const startCenter = winningLine.length > 0 ? getCellCenter(winningLine[0]) : { x: 0, y: 0 };
    const endCenter = winningLine.length > 0 ? getCellCenter(winningLine[2]) : { x: 0, y: 0 };

    const lineData = React.useMemo(() => {
        if (winningLine.length === 0) return { startX: 0, startY: 0, length: 0, angle: '0rad' };
        const dx = endCenter.x - startCenter.x;
        const dy = endCenter.y - startCenter.y;
        const originalLength = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Extend line by 50px at each end to reach outer edges
        const startX = startCenter.x - 50 * Math.cos(angle);
        const startY = startCenter.y - 50 * Math.sin(angle);
        const length = originalLength + 100;
        
        return { startX, startY, length, angle: `${angle}rad` };
    }, [winningLine, startCenter, endCenter]);

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
                        <AnimatedSymbol value={value} mySymbol={mySymbol} />
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
                    <View style={[styles.playerCard, isMyTurn && !isGameOver && styles.activePlayer]}>
                        <Text style={[styles.playerSymbol, { color: mySymbol === 'X' ? colors.primary : colors.secondary }]}>{mySymbol}</Text>
                        <Text style={styles.playerName}>You</Text>
                    </View>
                    <Text style={styles.vsText}>vs</Text>
                    <View style={[styles.playerCard, !isMyTurn && !isGameOver && styles.activePlayer]}>
                        <Text style={[styles.playerSymbol, { color: theirSymbol === 'X' ? colors.primary : colors.secondary }]}>{theirSymbol}</Text>
                        <Text style={styles.playerName}>{partnerName}</Text>
                    </View>
                </View>

                {/* Status */}
                <View style={styles.statusContainer}>
                    <Text style={[
                        styles.statusText,
                        isGameOver && (didIWin ? styles.statusWin : didTheyWin ? styles.statusLose : styles.statusDraw),
                        isGameStarting && styles.statusGameStarting
                    ]}>
                        {getStatusText()}
                    </Text>
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
                                    top: lineData.startY - 3, // Align vertically with extended start center
                                    width: lineData.length,
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: colors.secondary,
                                    transformOrigin: 'left',
                                    transform: [
                                        { rotate: lineData.angle },
                                        { scaleX: lineAnim }
                                    ],
                                    shadowColor: colors.secondary,
                                    shadowOffset: { width: 0, height: 0 },
                                    shadowOpacity: 0.8,
                                    shadowRadius: 10,
                                    elevation: 5,
                                }}
                            />
                        )}
                    </Animated.View>
                </View>

                {/* Notify Partner Button Container - fixed height to prevent layout shift */}
                {!isGameOver && gameId && (
                    <View style={styles.notifyButtonContainer}>
                        {!(isMyTurn || partnerOnline) ? (
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
                        ) : null}
                    </View>
                )}

                {/* Play Again / Back buttons */}
                {isGameOver && (revealGameOverText || status === 'draw') && (
                    <View style={styles.gameOverButtons}>
                        <Button
                            title="Play Again"
                            onPress={createNewGame}
                            variant="glow"
                            size="xl"
                            fullWidth
                        />
                    </View>
                )}

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
        paddingVertical: 20,
        gap: 16,
    },
    playerCard: {
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 16,
        minWidth: 100,
        borderWidth: 1,
        borderColor: '#FAE8FF',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    activePlayer: {
        borderWidth: 2,
        borderColor: colors.secondary,
        shadowColor: colors.secondary,
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 3,
    },
    playerSymbol: {
        fontSize: 32,
        fontWeight: '800',
    },
    playerName: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    vsText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textMuted,
    },
    statusContainer: {
        alignItems: 'center',
        paddingVertical: 16,
    },
    statusText: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
    },
    statusWin: {
        color: colors.success,
    },
    statusLose: {
        color: colors.primary,
    },
    statusDraw: {
        color: colors.accent,
    },
    statusGameStarting: {
        fontSize: 28,
        color: colors.secondary,
        textAlign: 'center',
        lineHeight: 40,
    },
    inlineStatus: {
        fontSize: 13,
        fontWeight: '600',
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
        width: 304,
        height: 304,
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: 'rgba(255, 255, 255, 0.65)',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FAE8FF',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.06,
                shadowRadius: 16,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    cell: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cellBorderRight: {
        borderRightWidth: 1,
        borderRightColor: '#FAE8FF',
    },
    cellBorderBottom: {
        borderBottomWidth: 1,
        borderBottomColor: '#FAE8FF',
    },
    cellWinning: {
        backgroundColor: 'rgba(74, 222, 128, 0.12)',
    },
    symbolX: {
        fontSize: 56,
        fontWeight: '300',
        color: colors.primary,
    },
    symbolO: {
        fontSize: 64,
        fontWeight: '200',
        color: colors.secondary,
    },
    mySymbol: {
        opacity: 1,
    },
    notifyButtonContainer: {
        height: 150, // Fixed height to prevent layout shift
        justifyContent: 'center',
    },
    gameOverButtons: {
        paddingHorizontal: 40,
        paddingBottom: 30,
        gap: 12,
    },
    linkPartnerContainer: {
        paddingHorizontal: 40,
        paddingBottom: 30,
    },
});

export default TicTacToeScreen;
