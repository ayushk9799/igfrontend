import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Dimensions,
    Platform,
    Animated,
    PanResponder,
    StatusBar,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/Button';
import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import GradientBackground from '../components/GradientBackground';
import { usePuzzle } from '../hooks/usePuzzle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Use Math.floor to ensure integer pixel values and avoid gaps/overlaps
const PUZZLE_SIZE = Math.floor(SCREEN_WIDTH - 60);
const GRID_SIZE = 3;
const PIECE_SIZE = Math.floor(PUZZLE_SIZE / GRID_SIZE);
// Recalculate PUZZLE_SIZE to be exactly divisible by GRID_SIZE (avoids sub-pixel gaps)
const ACTUAL_PUZZLE_SIZE = PIECE_SIZE * GRID_SIZE;

/**
 * CountdownTimer - Shows seconds remaining before puzzle appears
 */
const CountdownTimer = ({ duration }) => {
    const [seconds, setSeconds] = useState(duration);

    useEffect(() => {
        if (seconds <= 0) return;
        const timer = setInterval(() => {
            setSeconds(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <View style={timerStyles.container}>
            <Text style={timerStyles.number}>{seconds}</Text>
            <Text style={timerStyles.label}>sec</Text>
        </View>
    );
};

const timerStyles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(46, 30, 60, 0.85)',
        borderRadius: 30,
        width: 60,
        height: 60,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    number: {
        fontFamily: fontFamily.extraBold,
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
    },
    label: {
        fontFamily: fontFamily.bold,
        fontSize: 10,
        color: 'rgba(255,255,255,0.7)',
        textTransform: 'uppercase',
    },
});

/**
 * JigsawPuzzleScreen - The actual puzzle-solving game
 * Features: Smooth drag-and-drop pieces, 5-second reference preview
 */
const JigsawPuzzleScreen = ({ navigation, route }) => {
    const { puzzleId, puzzleData: initialData } = route.params || {};
    const { getPuzzle, movePiece } = usePuzzle();

    const [puzzle, setPuzzle] = useState(initialData || null);
    const [pieces, setPieces] = useState([]);
    const [moveCount, setMoveCount] = useState(0);
    const [isSolved, setIsSolved] = useState(false);
    const [showReference, setShowReference] = useState(true);
    const [draggingIndex, setDraggingIndex] = useState(null);
    const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });
    const [hoverTarget, setHoverTarget] = useState(-1);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showGridLines, setShowGridLines] = useState(true);
    const [piecesReady, setPiecesReady] = useState(false); // Delay piece rendering

    // Animation refs
    const celebrateScale = useRef(new Animated.Value(0)).current;
    const celebrateOpacity = useRef(new Animated.Value(0)).current;
    const referenceOpacity = useRef(new Animated.Value(1)).current;

    // Piece animation values
    const pieceAnimations = useRef(
        Array(GRID_SIZE * GRID_SIZE).fill(null).map(() => ({
            translateX: new Animated.Value(0),
            translateY: new Animated.Value(0),
            scale: new Animated.Value(1),
        }))
    ).current;

    // Pieces ref for use in pan responders
    const piecesRef = useRef(pieces);
    useEffect(() => {
        piecesRef.current = pieces;
    }, [pieces]);

    // Grid position ref
    const gridPositionRef = useRef(gridPosition);
    useEffect(() => {
        gridPositionRef.current = gridPosition;
    }, [gridPosition]);

    // Hover target ref for use in pan responders
    const hoverTargetRef = useRef(hoverTarget);
    useEffect(() => {
        hoverTargetRef.current = hoverTarget;
    }, [hoverTarget]);

    // Dragging index ref
    const draggingIndexRef = useRef(draggingIndex);
    useEffect(() => {
        draggingIndexRef.current = draggingIndex;
    }, [draggingIndex]);

    // Load puzzle data
    useEffect(() => {
        const loadPuzzle = async () => {
            if (puzzleId && !initialData) {
                const result = await getPuzzle(puzzleId);
                if (result.success) {
                    result.data.pieces.forEach((piece, idx) => {
                    });

                    // Check for duplicates
                    const duplicates = result.data.pieces.filter((item, index) => result.data.pieces.indexOf(item) !== index);
                    if (duplicates.length > 0) {
                        console.error('🧩 ⚠️ DUPLICATE PIECES DETECTED:', duplicates);
                        console.error('🧩 This will cause overlapping! Pieces array:', result.data.pieces);
                    }

                    setPuzzle(result.data);
                    setPieces([...result.data.pieces]);
                    setMoveCount(result.data.moveCount || 0);
                }
            } else if (initialData) {
                initialData.pieces.forEach((piece, idx) => {
                });

                // Check for duplicates
                const duplicates = initialData.pieces.filter((item, index) => initialData.pieces.indexOf(item) !== index);
                if (duplicates.length > 0) {
                    console.error('🧩 ⚠️ DUPLICATE PIECES DETECTED:', duplicates);
                    console.error('🧩 This will cause overlapping! Pieces array:', initialData.pieces);
                }

                setPieces([...initialData.pieces]);
                setMoveCount(initialData.moveCount || 0);
            }
        };
        loadPuzzle();
    }, [puzzleId, initialData]);

    // Preload puzzle image
    useEffect(() => {
        if (puzzle?.imageUrl) {
            setImageLoaded(false);
            Image.prefetch(puzzle.imageUrl)
                .then(() => {
                    setImageLoaded(true);
                })
                .catch((err) => {
                    setImageLoaded(true);
                });
        }
    }, [puzzle?.imageUrl]);

    // Delay piece rendering to avoid initial mount lag
    useEffect(() => {
        if (imageLoaded) {
            const timer = setTimeout(() => {
                setPiecesReady(true);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [imageLoaded]);

    // Hide reference image after 5 seconds and show puzzle instantly
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowReference(false); // Instant switch, no animation
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    // Check if solved
    const checkSolved = useCallback((currentPieces) => {
        return currentPieces.every((piece, index) => piece === index);
    }, []);

    // Play celebration animation
    const playCelebration = useCallback(() => {
        Animated.parallel([
            Animated.spring(celebrateScale, {
                toValue: 1,
                friction: 3,
                useNativeDriver: true,
            }),
            Animated.timing(celebrateOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, [celebrateScale, celebrateOpacity]);

    // Get target position from screen coordinates
    const getTargetPosition = useCallback((pageX, pageY) => {
        const gp = gridPositionRef.current;
        const relX = pageX - gp.x;
        const relY = pageY - gp.y;

        const col = Math.floor(relX / PIECE_SIZE);
        const row = Math.floor(relY / PIECE_SIZE);


        if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
            return row * GRID_SIZE + col;
        }
        return -1;
    }, []);

    // Handle piece swap
    const handlePieceSwap = useCallback((fromIndex, toIndex) => {
        if (fromIndex === toIndex || toIndex === -1) return;

        const currentPieces = [...piecesRef.current];

        // Log before swap

        // Perform the swap
        const temp = currentPieces[fromIndex];
        currentPieces[fromIndex] = currentPieces[toIndex];
        currentPieces[toIndex] = temp;

        // Log after swap

        // Check for duplicates
        const duplicates = currentPieces.filter((item, index) => currentPieces.indexOf(item) !== index);
        if (duplicates.length > 0) {
            console.error('🧩 ⚠️ DUPLICATE PIECES AFTER SWAP:', duplicates);
        }

        setPieces(currentPieces);
        setMoveCount(prev => prev + 1);

        // Update backend (async but don't wait)
        if (puzzleId) {
            movePiece(puzzleId, fromIndex, toIndex).catch(err => {
                console.error('Failed to update backend:', err);
            });
        }

        // Check if solved
        if (checkSolved(currentPieces)) {
            setIsSolved(true);
            playCelebration();
        }
    }, [puzzleId, movePiece, checkSolved, playCelebration]);

    // Memoized pan responders
    const panResponders = useRef(
        Array(GRID_SIZE * GRID_SIZE).fill(null).map((_, index) =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderTerminationRequest: () => false,

                onPanResponderGrant: () => {
                    const currentPiece = piecesRef.current[index];
                    setDraggingIndex(index);
                    setHoverTarget(-1);
                    Animated.spring(pieceAnimations[index].scale, {
                        toValue: 1.15,
                        friction: 8,
                        useNativeDriver: true,
                    }).start();
                },

                onPanResponderMove: (evt, gestureState) => {
                    // Update dragged piece position
                    pieceAnimations[index].translateX.setValue(gestureState.dx);
                    pieceAnimations[index].translateY.setValue(gestureState.dy);

                    // Calculate which slot we're hovering over
                    const gp = gridPositionRef.current;
                    const relX = gestureState.moveX - gp.x;
                    const relY = gestureState.moveY - gp.y;
                    const col = Math.floor(relX / PIECE_SIZE);
                    const row = Math.floor(relY / PIECE_SIZE);

                    let newTarget = -1;
                    if (col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE) {
                        newTarget = row * GRID_SIZE + col;
                    }

                    // If hovering over a different slot than before
                    const prevTarget = hoverTargetRef.current;
                    if (newTarget !== prevTarget) {
                        if (newTarget !== -1 && newTarget !== index) {
                            const draggedPiece = piecesRef.current[index];
                            const targetPiece = piecesRef.current[newTarget];
                        }

                        // Reset previous hover target piece to its position
                        if (prevTarget !== -1 && prevTarget !== index) {
                            Animated.spring(pieceAnimations[prevTarget].translateX, {
                                toValue: 0,
                                friction: 6,
                                tension: 80,
                                useNativeDriver: true,
                            }).start();
                            Animated.spring(pieceAnimations[prevTarget].translateY, {
                                toValue: 0,
                                friction: 6,
                                tension: 80,
                                useNativeDriver: true,
                            }).start();
                            Animated.spring(pieceAnimations[prevTarget].scale, {
                                toValue: 1,
                                friction: 8,
                                useNativeDriver: true,
                            }).start();
                        }

                        // Animate new target piece to dragged piece's original position
                        if (newTarget !== -1 && newTarget !== index) {
                            const fromRow = Math.floor(index / GRID_SIZE);
                            const fromCol = index % GRID_SIZE;
                            const toRow = Math.floor(newTarget / GRID_SIZE);
                            const toCol = newTarget % GRID_SIZE;

                            const deltaX = (fromCol - toCol) * PIECE_SIZE;
                            const deltaY = (fromRow - toRow) * PIECE_SIZE;

                            Animated.spring(pieceAnimations[newTarget].translateX, {
                                toValue: deltaX,
                                friction: 6,
                                tension: 80,
                                useNativeDriver: true,
                            }).start();
                            Animated.spring(pieceAnimations[newTarget].translateY, {
                                toValue: deltaY,
                                friction: 6,
                                tension: 80,
                                useNativeDriver: true,
                            }).start();
                            Animated.spring(pieceAnimations[newTarget].scale, {
                                toValue: 1.05,
                                friction: 8,
                                useNativeDriver: true,
                            }).start();
                        }

                        setHoverTarget(newTarget);
                    }
                },

                onPanResponderRelease: (evt, gestureState) => {
                    const currentHoverTarget = hoverTargetRef.current;

                    // Reset dragged piece position
                    Animated.parallel([
                        Animated.spring(pieceAnimations[index].translateX, {
                            toValue: 0,
                            friction: 6,
                            useNativeDriver: true,
                        }),
                        Animated.spring(pieceAnimations[index].translateY, {
                            toValue: 0,
                            friction: 6,
                            useNativeDriver: true,
                        }),
                        Animated.spring(pieceAnimations[index].scale, {
                            toValue: 1,
                            friction: 8,
                            useNativeDriver: true,
                        }),
                    ]).start();

                    // If we have a valid hover target, complete the swap
                    if (currentHoverTarget !== -1 && currentHoverTarget !== index) {
                        const piece1 = piecesRef.current[index];
                        const piece2 = piecesRef.current[currentHoverTarget];

                        // Reset target piece animation to origin
                        Animated.parallel([
                            Animated.spring(pieceAnimations[currentHoverTarget].translateX, {
                                toValue: 0,
                                friction: 5,
                                tension: 100,
                                useNativeDriver: true,
                            }),
                            Animated.spring(pieceAnimations[currentHoverTarget].translateY, {
                                toValue: 0,
                                friction: 5,
                                tension: 100,
                                useNativeDriver: true,
                            }),
                            Animated.spring(pieceAnimations[currentHoverTarget].scale, {
                                toValue: 1,
                                friction: 8,
                                useNativeDriver: true,
                            }),
                        ]).start();

                        // USE THE EXISTING handlePieceSwap FUNCTION INSTEAD OF INLINE SWAP
                        handlePieceSwap(index, currentHoverTarget);
                    } else {
                    }

                    setHoverTarget(-1);
                    setDraggingIndex(null);
                },
            })
        )
    ).current;

    // Get piece image crop position - use exact pixel values
    const getPieceStyle = (originalIndex) => {
        const row = Math.floor(originalIndex / GRID_SIZE);
        const col = originalIndex % GRID_SIZE;
        return {
            position: 'absolute',
            top: -row * PIECE_SIZE,
            left: -col * PIECE_SIZE,
            width: ACTUAL_PUZZLE_SIZE,
            height: ACTUAL_PUZZLE_SIZE,
        };
    };

    // Get the position for each piece in the grid
    const getPiecePosition = (index) => {
        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        return {
            top: row * PIECE_SIZE,
            left: col * PIECE_SIZE,
        };
    };

    // Handle grid layout measurement
    const handleGridLayout = (event) => {
        const { x, y, width, height } = event.nativeEvent.layout;
        // Calculate absolute position
        // The grid is centered, so we calculate its position
        const gridX = (SCREEN_WIDTH - PUZZLE_SIZE) / 2;
        const gridY = event.nativeEvent.layout.y;

        // Use measure for accurate page coordinates
        event.target.measure?.((fx, fy, w, h, px, py) => {
            setGridPosition({ x: px, y: py });
        });
    };

    // Pulsing animation for loading
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        if (!puzzle || !imageLoaded) {
            // Pulse animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            // Glow animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(glowAnim, {
                        toValue: 1,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0.5,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        }
    }, [puzzle, imageLoaded]);

    if (!puzzle) {
        return (
            <View style={{ flex: 1 }}>
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <GradientBackground variant="light" showOrbs={true}>
                    <SafeAreaView style={styles.loadingContainer}>
                        {/* Emoji container with pulse */}
                        <Animated.View style={[
                            styles.loadingEmojiContainer,
                            { transform: [{ scale: pulseAnim }] }
                        ]}>
                            <Text style={styles.loadingEmoji}>🧩</Text>
                        </Animated.View>

                        {/* Loading text */}
                        <Text style={styles.loadingText}>Preparing your puzzle...</Text>
                        <Text style={styles.loadingSubtext}>Almost there!</Text>
                    </SafeAreaView>
                </GradientBackground>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <GradientBackground variant="light" showOrbs={true}>
                <SafeAreaView style={styles.container} edges={['top']}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Solve Puzzle 🧩</Text>
                        <View style={styles.headerRight}>
                            <TouchableOpacity
                                onPress={() => setShowGridLines(!showGridLines)}
                                style={[styles.gridToggleBtn, showGridLines && styles.gridToggleBtnActive]}
                            >
                                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                    <Path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z"
                                        stroke={showGridLines ? colors.primary : colors.textSecondary}
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                            </TouchableOpacity>
                            <View style={styles.moveCounter}>
                                <Text style={styles.moveText}>{moveCount}</Text>
                                <Text style={styles.moveLabel}>moves</Text>
                            </View>
                        </View>
                    </View>

                    {/* Instructions */}
                    {!isSolved && (
                        <View style={styles.instructionContainer}>
                            <Text style={styles.instructionText}>
                                👆 Drag pieces to swap them
                            </Text>
                        </View>
                    )}

                    {/* Puzzle Grid - Always rendered, reference image overlays it */}
                    <View style={styles.puzzleContainer}>
                        {/* Placeholder while image or puzzle is preparing */}
                        {(!imageLoaded || !piecesReady) && (
                            <View style={[styles.puzzleGrid, styles.puzzleGridPlaceholder]}>
                                <Text style={styles.loadingSubtext}>Loading the puzzle...</Text>
                            </View>
                        )}

                        <View
                            style={[styles.puzzleGrid, { opacity: (piecesReady && !showReference) ? 1 : 0 }]}
                            onLayout={handleGridLayout}
                            collapsable={false}
                            pointerEvents={showReference ? 'none' : 'auto'}
                        >
                            {piecesReady && pieces.length === GRID_SIZE * GRID_SIZE && pieces.map((originalIndex, currentIndex) => {
                                const isDragging = draggingIndex === currentIndex;

                                // Validate originalIndex - must be 0-8 for 3x3 grid
                                const validOriginalIndex = (typeof originalIndex === 'number' && originalIndex >= 0 && originalIndex < GRID_SIZE * GRID_SIZE)
                                    ? originalIndex
                                    : currentIndex;

                                if (validOriginalIndex !== originalIndex) {
                                    console.warn(`🧩 ⚠️ INVALID PIECE INDEX - Position ${currentIndex} had invalid value ${originalIndex}, using ${validOriginalIndex}`);
                                }

                                // Calculate which part of the image to show based on the original piece position
                                const originalRow = Math.floor(validOriginalIndex / GRID_SIZE);
                                const originalCol = validOriginalIndex % GRID_SIZE;

                                const cropTop = -originalRow * PIECE_SIZE;
                                const cropLeft = -originalCol * PIECE_SIZE;

                                return (
                                    <Animated.View
                                        key={`piece-${currentIndex}`}
                                        style={[
                                            styles.pieceContainer,
                                            getPiecePosition(currentIndex),
                                            {
                                                transform: [
                                                    { translateX: pieceAnimations[currentIndex].translateX },
                                                    { translateY: pieceAnimations[currentIndex].translateY },
                                                    { scale: pieceAnimations[currentIndex].scale },
                                                ],
                                                zIndex: isDragging ? 100 : (currentIndex + 1),
                                                elevation: isDragging ? 20 : 1,
                                            },
                                        ]}
                                        shouldRasterizeIOS={true}
                                        renderToHardwareTextureAndroid={true}
                                        needsOffscreenAlphaCompositing={true}
                                        {...panResponders[currentIndex].panHandlers}
                                    >
                                        <View style={{ width: PIECE_SIZE, height: PIECE_SIZE, overflow: 'hidden' }}>
                                            <Image
                                                source={{
                                                    uri: puzzle.imageUrl,
                                                    cache: 'force-cache'
                                                }}
                                                style={{
                                                    position: 'absolute',
                                                    top: cropTop,
                                                    left: cropLeft,
                                                    width: ACTUAL_PUZZLE_SIZE,
                                                    height: ACTUAL_PUZZLE_SIZE,
                                                }}
                                                resizeMode="cover"
                                                fadeDuration={0}
                                                onLoad={() => {
                                                }}
                                                onError={(error) => {
                                                    console.error(`🧩 ❌ Image FAILED to load for Position ${currentIndex} (Piece ${validOriginalIndex}):`, error.nativeEvent);
                                                }}
                                            />
                                        </View>
                                    </Animated.View>
                                );
                            })}

                            {/* SVG Grid Overlay - drawn on top of pieces */}
                            {piecesReady && showGridLines && !isSolved && !showReference && (
                                <View style={styles.gridOverlay} pointerEvents="none">
                                    <Svg width={ACTUAL_PUZZLE_SIZE} height={ACTUAL_PUZZLE_SIZE}>
                                        {/* Vertical lines */}
                                        <Line x1={PIECE_SIZE} y1={0} x2={PIECE_SIZE} y2={ACTUAL_PUZZLE_SIZE} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
                                        <Line x1={PIECE_SIZE * 2} y1={0} x2={PIECE_SIZE * 2} y2={ACTUAL_PUZZLE_SIZE} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
                                        {/* Horizontal lines */}
                                        <Line x1={0} y1={PIECE_SIZE} x2={ACTUAL_PUZZLE_SIZE} y2={PIECE_SIZE} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
                                        <Line x1={0} y1={PIECE_SIZE * 2} x2={ACTUAL_PUZZLE_SIZE} y2={PIECE_SIZE * 2} stroke="rgba(255,255,255,0.6)" strokeWidth={2} />
                                    </Svg>
                                </View>
                            )}
                        </View>

                        {/* Reference image overlay - shown on top during countdown */}
                        {showReference && imageLoaded && (
                            <Animated.View style={[styles.referenceOverlay, { opacity: referenceOpacity }]}>
                                <Text style={styles.referencePreviewLabel}>Memorize this image ⏱️</Text>
                                <View style={styles.referenceImageWrapper}>
                                    <Image
                                        source={{
                                            uri: puzzle.imageUrl,
                                            cache: 'force-cache'
                                        }}
                                        style={styles.referencePreviewImage}
                                        resizeMode="cover"
                                        fadeDuration={0}
                                    />
                                    <View style={styles.countdownBadge}>
                                        <CountdownTimer duration={5} />
                                    </View>
                                </View>
                                <Text style={styles.referencePreviewHint}>Puzzle will appear here...</Text>
                            </Animated.View>
                        )}
                    </View>

                    {/* Solved Celebration - Inline below puzzle */}
                    {isSolved && (
                        <Animated.View style={[
                            styles.celebrationInline,
                            {
                                opacity: celebrateOpacity,
                                transform: [{ scale: celebrateScale }],
                            }
                        ]}>
                            <Text style={styles.celebrateEmoji}>🎉</Text>
                            <Text style={styles.celebrateTitle}>Puzzle Solved!</Text>
                            <Text style={styles.celebrateSubtitle}>
                                You did it in {moveCount} moves
                            </Text>
                            <Button
                                title="Back to Home"
                                onPress={() => navigation.goBack()}
                                variant="primary"
                                size="md"
                            />
                        </Animated.View>
                    )}

                </SafeAreaView>
            </GradientBackground>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingEmojiContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.86)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        zIndex: 10,
    },
    loadingEmoji: {
        fontSize: 48,
    },
    loadingText: {
        fontFamily: fontFamily.bold,
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
        marginTop: 32,
    },
    loadingSubtext: {
        fontFamily: fontFamily.medium,
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: 12,
        paddingBottom: spacing.md,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.86)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    headerTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    gridToggleBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.86)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    gridToggleBtnActive: {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primaryLight,
    },
    moveCounter: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.86)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    moveText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 20,
        fontWeight: '800',
        color: colors.primary,
    },
    moveLabel: {
        fontFamily: fontFamily.bold,
        fontSize: 10,
        color: colors.textSecondary,
        textTransform: 'uppercase',
    },
    instructionContainer: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    instructionText: {
        fontFamily: fontFamily.medium,
        fontSize: 16,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    puzzleContainer: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    puzzleGrid: {
        width: ACTUAL_PUZZLE_SIZE,
        height: ACTUAL_PUZZLE_SIZE,
        position: 'relative',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.borderLight,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
        overflow: 'hidden',
    },
    puzzleGridPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: 0,
        zIndex: -1,
    },
    pieceContainer: {
        position: 'absolute',
        width: PIECE_SIZE,
        height: PIECE_SIZE,
        overflow: 'hidden',
    },
    pieceClip: {
        width: '100%',
        height: '100%',
        overflow: 'hidden',
    },
    gridOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
    },
    celebrationInline: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
    },
    celebrateEmoji: {
        fontSize: 48,
        marginBottom: spacing.sm,
    },
    celebrateTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    celebrateSubtitle: {
        fontFamily: fontFamily.medium,
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    referenceOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 200,
    },
    referencePreviewContainer: {
        alignItems: 'center',
    },
    referencePreviewLabel: {
        fontFamily: fontFamily.bold,
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.md,
    },
    referenceImageWrapper: {
        width: ACTUAL_PUZZLE_SIZE,
        height: ACTUAL_PUZZLE_SIZE,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.borderLight,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
    },
    referencePreviewImage: {
        width: '100%',
        height: '100%',
    },
    countdownBadge: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
    },
    referencePreviewHint: {
        fontFamily: fontFamily.medium,
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: spacing.md,
        fontStyle: 'italic',
    },
});

export default JigsawPuzzleScreen;
