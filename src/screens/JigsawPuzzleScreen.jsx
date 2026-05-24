import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Platform,
    Animated,
    PanResponder,
    StatusBar,
    Alert,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import Svg, { Path, Image as SvgImage, ClipPath, Defs, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import GradientBackground from '../components/GradientBackground';
import { usePuzzle } from '../hooks/usePuzzle';
import * as Haptics from 'expo-haptics';

const MAX_GRID_SIZE = 9;
const SHOW_DEV_NUMBERS = false; // Set to false to hide numbers in production
const TRAY_PIECE_HEIGHT = 110;
const PIECE_SHADOW_OFFSET = { x: 0.5, y: 0.5 };
const PIECE_DRAG_SHADOW_OFFSET = { x: 5, y: 7 };

const getEdgePath = (x1, y1, x2, y2, nx, ny) => {
    if (nx === 0 && ny === 0) {
        return `L ${x2} ${y2}`;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const S = Math.sqrt(dx * dx + dy * dy);

    // Helper to compute absolute coordinates of a relative point (t, perp)
    const p = (t, perp) => {
        const px = x1 + t * dx + perp * S * nx;
        const py = y1 + t * dy + perp * S * ny;
        return `${px.toFixed(1)},${py.toFixed(1)}`;
    };

    // Construct the Bezier segments
    const pA = p(0.38, 0);
    const pB_cp1 = p(0.38, 0.05);
    const pB_cp2 = p(0.32, 0.10);
    const pB = p(0.32, 0.20);
    
    const pHead_cp1 = p(0.32, 0.30);
    const pHead_cp2 = p(0.40, 0.32);
    const pHead_mid = p(0.50, 0.32);
    
    const pHead_cp3 = p(0.60, 0.32);
    const pHead_cp4 = p(0.68, 0.30);
    const pHead = p(0.68, 0.20);
    
    const pC_cp1 = p(0.68, 0.10);
    const pC_cp2 = p(0.62, 0.05);
    const pC = p(0.62, 0);

    return `L ${pA} C ${pB_cp1} ${pB_cp2} ${pB} C ${pHead_cp1} ${pHead_cp2} ${pHead_mid} C ${pHead_cp3} ${pHead_cp4} ${pHead} C ${pC_cp1} ${pC_cp2} ${pC} L ${x2},${y2}`;
};

const getPiecePath = (row, col, gridDim, pieceSize, tabSize) => {
    const P = pieceSize;
    const T = tabSize;

    // Corner points in local coordinate system offset by T
    const TL = { x: T, y: T };
    const TR = { x: T + P, y: T };
    const BR = { x: T + P, y: T + P };
    const BL = { x: T, y: T + P };

    // Determine absolute tab direction vectors for each of the 4 edges
    const topDir = row === 0 ? 0 : ((row - 1 + col) % 2 === 0 ? 1 : -1);
    const topN = { x: 0, y: topDir };

    const rightDir = col === gridDim - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);
    const rightN = { x: rightDir, y: 0 };

    const bottomDir = row === gridDim - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);
    const bottomN = { x: 0, y: bottomDir };

    const leftDir = col === 0 ? 0 : ((row + col - 1) % 2 === 0 ? 1 : -1);
    const leftN = { x: leftDir, y: 0 };

    // Clockwise walk
    return `M ${TL.x} ${TL.y} ` +
        `${getEdgePath(TL.x, TL.y, TR.x, TR.y, topN.x, topN.y)} ` +
        `${getEdgePath(TR.x, TR.y, BR.x, BR.y, rightN.x, rightN.y)} ` +
        `${getEdgePath(BR.x, BR.y, BL.x, BL.y, bottomN.x, bottomN.y)} ` +
        `${getEdgePath(BL.x, BL.y, TL.x, TL.y, leftN.x, leftN.y)} Z`;
};

const getPieceEdgePaths = (row, col, gridDim, pieceSize, tabSize) => {
    const P = pieceSize;
    const T = tabSize;

    const TL = { x: T, y: T };
    const TR = { x: T + P, y: T };
    const BR = { x: T + P, y: T + P };
    const BL = { x: T, y: T + P };

    const topDir = row === 0 ? 0 : ((row - 1 + col) % 2 === 0 ? 1 : -1);
    const rightDir = col === gridDim - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);
    const bottomDir = row === gridDim - 1 ? 0 : ((row + col) % 2 === 0 ? 1 : -1);
    const leftDir = col === 0 ? 0 : ((row + col - 1) % 2 === 0 ? 1 : -1);

    return {
        top: `M ${TL.x} ${TL.y} ${getEdgePath(TL.x, TL.y, TR.x, TR.y, 0, topDir)}`,
        right: `M ${TR.x} ${TR.y} ${getEdgePath(TR.x, TR.y, BR.x, BR.y, rightDir, 0)}`,
        bottom: `M ${BR.x} ${BR.y} ${getEdgePath(BR.x, BR.y, BL.x, BL.y, 0, bottomDir)}`,
        left: `M ${BL.x} ${BL.y} ${getEdgePath(BL.x, BL.y, TL.x, TL.y, leftDir, 0)}`,
    };
};

const getPieceEdgeProtrusions = (r, c, gridDim) => {
    // Top edge
    const topDir = r === 0 ? 0 : ((r - 1 + c) % 2 === 0 ? 1 : -1);
    const top = topDir === 0 ? 0 : (topDir === -1 ? 1 : -1);

    // Bottom edge
    const bottomDir = r === gridDim - 1 ? 0 : ((r + c) % 2 === 0 ? 1 : -1);
    const bottom = bottomDir === 0 ? 0 : (bottomDir === 1 ? 1 : -1);

    // Left edge
    const leftDir = c === 0 ? 0 : ((r + c - 1) % 2 === 0 ? 1 : -1);
    const left = leftDir === 0 ? 0 : (leftDir === -1 ? 1 : -1);

    // Right edge
    const rightDir = c === gridDim - 1 ? 0 : ((r + c) % 2 === 0 ? 1 : -1);
    const right = rightDir === 0 ? 0 : (rightDir === 1 ? 1 : -1);

    return { top, bottom, left, right };
};

const RaisedPieceEdges = ({
    path,
    edgePaths,
    hiddenEdges = {},
    isDragging = false,
    includeShadow = true,
    includeBevel = true,
}) => {
    const shadowOffset = isDragging ? PIECE_DRAG_SHADOW_OFFSET : PIECE_SHADOW_OFFSET;
    const shadowOpacity = isDragging ? 0 : 0;
    const hasHiddenEdges = Object.values(hiddenEdges).some(Boolean);
    const visibleEdgePaths = edgePaths
        ? Object.entries(edgePaths).filter(([edge]) => !hiddenEdges[edge]).map(([, edgePath]) => edgePath)
        : [];

    return (
        <>
            {includeShadow && hasHiddenEdges && visibleEdgePaths.map((edgePath, index) => (
                <Path
                    key={`shadow-edge-${index}`}
                    d={edgePath}
                    fill="none"
                    stroke={`rgba(35, 18, 56, ${shadowOpacity})`}
                    strokeWidth={isDragging ? 5 : 4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    transform={`translate(${shadowOffset.x} ${shadowOffset.y})`}
                />
            ))}
            {includeShadow && !hasHiddenEdges && (
                <Path
                    d={path}
                    fill={`rgba(35, 18, 56, ${shadowOpacity})`}
                    transform={`translate(${shadowOffset.x} ${shadowOffset.y})`}
                />
            )}
            {includeBevel && (hasHiddenEdges ? visibleEdgePaths : [path]).map((edgePath, index) => (
                <React.Fragment key={`bevel-edge-${index}`}>
                    <Path
                        d={edgePath}
                        fill="none"
                        stroke="rgba(255, 255, 255, 0.82)"
                        strokeWidth={isDragging ? 2.4 : 1.9}
                        transform="translate(-1 -1)"
                    />
                    <Path
                        d={edgePath}
                        fill="none"
                        stroke="rgba(44, 20, 72, 0.34)"
                        strokeWidth={isDragging ? 2.8 : 2.2}
                        transform="translate(1.2 1.6)"
                    />
                </React.Fragment>
            ))}
        </>
    );
};

// Check if a single slot's piece collides with its immediate neighbors.
// This avoids false positives from pre-existing board state unrelated to the current move.
const checkSlotOverlap = (piecesArray, slotIndex, gridDim) => {
    const val = piecesArray[slotIndex];
    if (val === null || val === undefined || val < 0) return false;

    const row = Math.floor(slotIndex / gridDim);
    const col = slotIndex % gridDim;
    const originalRow = Math.floor(val / gridDim);
    const originalCol = val % gridDim;
    const pEdge = getPieceEdgeProtrusions(originalRow, originalCol, gridDim);

    // Right neighbor — collision if the sum of outward protrusions > 0:
    //   tab+tab (1+1=2), tab+flat (1+0=1), flat+tab (0+1=1) are ALL physical overlaps.
    //   tab+indent (1-1=0) is fine (tab fits into indent).
    if (col < gridDim - 1) {
        const rightVal = piecesArray[slotIndex + 1];
        if (rightVal !== null && rightVal !== undefined && rightVal >= 0) {
            const rEdge = getPieceEdgeProtrusions(Math.floor(rightVal / gridDim), rightVal % gridDim, gridDim);
            if (pEdge.right + rEdge.left > 0) return true;
        }
    }
    // Left neighbor
    if (col > 0) {
        const leftVal = piecesArray[slotIndex - 1];
        if (leftVal !== null && leftVal !== undefined && leftVal >= 0) {
            const lEdge = getPieceEdgeProtrusions(Math.floor(leftVal / gridDim), leftVal % gridDim, gridDim);
            if (lEdge.right + pEdge.left > 0) return true;
        }
    }
    // Bottom neighbor
    if (row < gridDim - 1) {
        const bottomVal = piecesArray[slotIndex + gridDim];
        if (bottomVal !== null && bottomVal !== undefined && bottomVal >= 0) {
            const bEdge = getPieceEdgeProtrusions(Math.floor(bottomVal / gridDim), bottomVal % gridDim, gridDim);
            if (pEdge.bottom + bEdge.top > 0) return true;
        }
    }
    // Top neighbor
    if (row > 0) {
        const topVal = piecesArray[slotIndex - gridDim];
        if (topVal !== null && topVal !== undefined && topVal >= 0) {
            const tEdge = getPieceEdgeProtrusions(Math.floor(topVal / gridDim), topVal % gridDim, gridDim);
            if (tEdge.bottom + pEdge.top > 0) return true;
        }
    }
    return false;
};


/**
 * CountdownTimer - Shows seconds remaining before puzzle appears
 */
const CountdownTimer = ({ duration }) => {
    const [seconds, setSeconds] = useState(duration);

    useEffect(() => {
        const timer = setInterval(() => {
            setSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
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
    const [trayOrder, setTrayOrder] = useState([]);
    const [moveCount, setMoveCount] = useState(0);
    const [isSolved, setIsSolved] = useState(false);
    const [showReference, setShowReference] = useState(true);
    const [draggingPiece, setDraggingPiece] = useState(null);
    const draggingIndex = draggingPiece ? draggingPiece.currentIndex : null;
    const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });
    const [hoverTarget, setHoverTarget] = useState(-1);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showGridLines, setShowGridLines] = useState(true);
    const [piecesReady, setPiecesReady] = useState(false); // Delay piece rendering
    const [devShowCorrect, setDevShowCorrect] = useState(false);
    const [devJiggle, setDevJiggle] = useState(false);
    // Natural pixel dimensions of the puzzle image (loaded asynchronously)
    const [imageNaturalSize, setImageNaturalSize] = useState({ width: 1, height: 1 });

    // Dynamic layout parameters based on the loaded puzzle
    // Use useWindowDimensions so PUZZLE_SIZE responds to actual device screen width
    const { width: windowWidth } = useWindowDimensions();
    const PUZZLE_SIZE = Math.floor(windowWidth - 60);
    const gridDim = pieces.length > 0 ? Math.round(Math.sqrt(pieces.length)) : 5;
    const pieceSize = Math.floor(PUZZLE_SIZE / gridDim);
    const actualPuzzleSize = pieceSize * gridDim;
    const tabSize = Math.floor(pieceSize * 0.35);

    // Cover-scale: scale image uniformly to fill actualPuzzleSize×actualPuzzleSize
    // (like CSS object-fit:cover). This ensures "what is viewed = what gets puzzled".
    const imgCoverScale = Math.max(
        actualPuzzleSize / imageNaturalSize.width,
        actualPuzzleSize / imageNaturalSize.height,
    );
    const scaledImgW = imageNaturalSize.width * imgCoverScale;
    const scaledImgH = imageNaturalSize.height * imgCoverScale;
    // Center the scaled image over the puzzle area (negative values = image overflows grid edge)
    const imgOffsetX = (actualPuzzleSize - scaledImgW) / 2;
    const imgOffsetY = (actualPuzzleSize - scaledImgH) / 2;

    const gridRef = useRef(null);

    // Animation refs
    const celebrateScale = useRef(new Animated.Value(0)).current;
    const celebrateOpacity = useRef(new Animated.Value(0)).current;
    const referenceOpacity = useRef(new Animated.Value(1)).current;
    const idleAnim = useRef(new Animated.Value(0)).current;

    // Piece animation values
    const pieceAnimations = useRef(
        Array(MAX_GRID_SIZE * MAX_GRID_SIZE).fill(null).map(() => ({
            translateX: new Animated.Value(0),
            translateY: new Animated.Value(0),
            scale: new Animated.Value(1),
            jiggleX: new Animated.Value(0),
            jiggleY: new Animated.Value(0),
            jiggleRotate: new Animated.Value(0),
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

    const gridMetricsRef = useRef({ gridDim, pieceSize, actualPuzzleSize });
    useEffect(() => {
        gridMetricsRef.current = { gridDim, pieceSize, actualPuzzleSize };
    }, [gridDim, pieceSize, actualPuzzleSize]);

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

    const originalImageUrlRef = useRef(null);
    const originalPiecesRef = useRef(null);
    const originalGridSizeRef = useRef(null);
    const trayScrollViewRef = useRef(null);
    const audioPlayerRef = useRef(null);
    const jigsawSoundUriRef = useRef(null);
    const jigsawSoundPlayingRef = useRef(false);
    const jigsawSoundTimeoutRef = useRef(null);

    useEffect(() => {
        audioPlayerRef.current = new AudioRecorderPlayer();
        const soundAsset = require('../../assets/sounds/jigsaw.mp3');
        jigsawSoundUriRef.current = Image.resolveAssetSource(soundAsset).uri;

        return () => {
            if (jigsawSoundTimeoutRef.current) {
                clearTimeout(jigsawSoundTimeoutRef.current);
            }
            audioPlayerRef.current?.stopPlayer().catch(() => {});
        };
    }, []);

    const playJigsawSound = useCallback(async () => {
        try {
            if (!audioPlayerRef.current) return;
            const soundUri = jigsawSoundUriRef.current;
            if (!soundUri) return;

            if (jigsawSoundPlayingRef.current) {
                await audioPlayerRef.current.stopPlayer().catch(() => {});
            }

            await audioPlayerRef.current.startPlayer(soundUri);
            await audioPlayerRef.current.setVolume(1.0);
            jigsawSoundPlayingRef.current = true;

            if (jigsawSoundTimeoutRef.current) {
                clearTimeout(jigsawSoundTimeoutRef.current);
            }
            jigsawSoundTimeoutRef.current = setTimeout(() => {
                jigsawSoundPlayingRef.current = false;
            }, 700);
        } catch (error) {
            jigsawSoundPlayingRef.current = false;
            console.error('Failed to play jigsaw sound:', error);
        }
    }, []);

    // Handle dev jiggle positions & rotations
    useEffect(() => {
        const animations = pieces.map((_, index) => {
            const row = Math.floor(index / gridDim);
            const col = index % gridDim;

            // Spread out pieces slightly from the center, plus apply random-looking offsets and rotations
            const targetX = devJiggle ? (col - (gridDim - 1) / 2) * 35 + (row % 2 === 0 ? 6 : -6) : 0;
            const targetY = devJiggle ? (row - (gridDim - 1) / 2) * 35 + (col % 2 === 0 ? 6 : -6) : 0;
            const targetRotate = devJiggle ? (row * 2 - col) * 4 : 0;

            return Animated.parallel([
                Animated.spring(pieceAnimations[index].jiggleX, {
                    toValue: targetX,
                    friction: 6,
                    tension: 50,
                    useNativeDriver: true,
                }),
                Animated.spring(pieceAnimations[index].jiggleY, {
                    toValue: targetY,
                    friction: 6,
                    tension: 50,
                    useNativeDriver: true,
                }),
                Animated.spring(pieceAnimations[index].jiggleRotate, {
                    toValue: targetRotate,
                    friction: 6,
                    tension: 50,
                    useNativeDriver: true,
                }),
            ]);
        });

        Animated.parallel(animations).start();
    }, [devJiggle, pieces, pieceAnimations, gridDim]);

    // Continuous float loop when jiggling is active
    useEffect(() => {
        let loopAnim;
        if (devJiggle) {
            idleAnim.setValue(0);
            loopAnim = Animated.loop(
                Animated.sequence([
                    Animated.timing(idleAnim, {
                        toValue: 1,
                        duration: 1800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(idleAnim, {
                        toValue: 0,
                        duration: 1800,
                        useNativeDriver: true,
                    }),
                ])
            );
            loopAnim.start();
        } else {
            Animated.spring(idleAnim, {
                toValue: 0,
                friction: 8,
                useNativeDriver: true,
            }).start();
        }
        return () => {
            if (loopAnim) loopAnim.stop();
        };
    }, [devJiggle, idleAnim]);

    // Load puzzle data
    useEffect(() => {
        const loadPuzzle = async () => {
            if (puzzleId && !initialData) {
                const result = await getPuzzle(puzzleId);
                if (result.success) {
                    const loadedPuzzle = result.data;
                    const dim = loadedPuzzle.gridSize?.rows || 5;
                    const targetLength = dim * dim;

                    let loadedPieces = [...loadedPuzzle.pieces];
                    if (loadedPieces.length < targetLength) {
                        loadedPieces = [...loadedPieces, ...Array(targetLength - loadedPieces.length).fill(null)];
                    } else if (loadedPieces.length > targetLength) {
                        loadedPieces = loadedPieces.slice(0, targetLength);
                    }

                    // Normalize pieces to support tray/board distinction
                    const hasNegative = loadedPieces.some(p => p !== null && p < 0);
                    if (!hasNegative && loadedPuzzle.status !== 'solved') {
                        loadedPieces = loadedPieces.map((p) => p !== null ? -p - 1 : null);
                    }

                    // Check for duplicates (ignoring empty/null slots)
                    const absolutePieces = loadedPieces.map(p => p !== null ? (p < 0 ? -p - 1 : p) : null);
                    const duplicates = absolutePieces.filter((item, index) => item !== null && absolutePieces.indexOf(item) !== index);
                    if (duplicates.length > 0) {
                        console.error('🧩 ⚠️ DUPLICATE PIECES DETECTED:', duplicates);
                        console.error('🧩 This will cause overlapping! Pieces array:', loadedPieces);
                    }

                    setPuzzle(loadedPuzzle);
                    originalImageUrlRef.current = loadedPuzzle.imageUrl;
                    originalPiecesRef.current = [...loadedPieces];
                    originalGridSizeRef.current = loadedPuzzle.gridSize || { rows: dim, cols: dim };
                    setPieces(loadedPieces);
                    setTrayOrder(loadedPieces.filter(val => val !== null && val < 0).map(val => -val - 1));
                    setMoveCount(loadedPuzzle.moveCount || 0);
                }
            } else if (initialData) {
                const dim = initialData.gridSize?.rows || 5;
                const targetLength = dim * dim;

                let loadedPieces = [...initialData.pieces];
                if (loadedPieces.length < targetLength) {
                    loadedPieces = [...loadedPieces, ...Array(targetLength - loadedPieces.length).fill(null)];
                } else if (loadedPieces.length > targetLength) {
                    loadedPieces = loadedPieces.slice(0, targetLength);
                }

                // Normalize pieces to support tray/board distinction
                const hasNegative = loadedPieces.some(p => p !== null && p < 0);
                if (!hasNegative && initialData.status !== 'solved') {
                    loadedPieces = loadedPieces.map((p) => p !== null ? -p - 1 : null);
                }

                // Check for duplicates (ignoring empty/null slots)
                const absolutePieces = loadedPieces.map(p => p !== null ? (p < 0 ? -p - 1 : p) : null);
                const duplicates = absolutePieces.filter((item, index) => item !== null && absolutePieces.indexOf(item) !== index);
                if (duplicates.length > 0) {
                    console.error('🧩 ⚠️ DUPLICATE PIECES DETECTED:', duplicates);
                    console.error('🧩 This will cause overlapping! Pieces array:', loadedPieces);
                }

                if (initialData.imageUrl) {
                    originalImageUrlRef.current = initialData.imageUrl;
                }
                originalPiecesRef.current = [...loadedPieces];
                originalGridSizeRef.current = initialData.gridSize || { rows: dim, cols: dim };
                setPieces(loadedPieces);
                setTrayOrder(loadedPieces.filter(val => val !== null && val < 0).map(val => -val - 1));
                setMoveCount(initialData.moveCount || 0);
            }
        };
        loadPuzzle();
    }, [puzzleId, initialData, getPuzzle]);

    // Preload puzzle image and measure its natural pixel dimensions
    useEffect(() => {
        if (puzzle?.imageUrl) {
            if (puzzle.imageUrl.startsWith('file:/') || puzzle.imageUrl.startsWith('content:/') || !puzzle.imageUrl.startsWith('http')) {
                // Local files: use Image.getSize directly
                Image.getSize(
                    puzzle.imageUrl,
                    (w, h) => { setImageNaturalSize({ width: w, height: h }); setImageLoaded(true); },
                    () => { setImageLoaded(true); }
                );
                return;
            }
            setImageLoaded(false);
            // Measure dimensions while prefetching
            Image.getSize(
                puzzle.imageUrl,
                (w, h) => setImageNaturalSize({ width: w, height: h }),
                () => {} // Keep fallback size (1×1) on error; won't show white bands
            );
            Image.prefetch(puzzle.imageUrl)
                .then(() => { setImageLoaded(true); })
                .catch(() => { setImageLoaded(true); });
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

    // trayOrder is synchronized directly inside interaction and helper functions

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
    const measureGridPosition = useCallback(() => {
        requestAnimationFrame(() => {
            gridRef.current?.measureInWindow?.((x, y) => {
                const nextPosition = { x, y };
                gridPositionRef.current = nextPosition;
                setGridPosition(nextPosition);
            });
        });
    }, []);

    const getTargetPosition = useCallback((pageX, pageY) => {
        const gp = gridPositionRef.current;
        const relX = pageX - gp.x;
        const relY = pageY - gp.y;

        const {
            gridDim: currentGridDim,
            pieceSize: currentPieceSize,
            actualPuzzleSize: currentActualPuzzleSize,
        } = gridMetricsRef.current;

        if (
            relX < 0 ||
            relY < 0 ||
            relX >= currentActualPuzzleSize ||
            relY >= currentActualPuzzleSize
        ) {
            return -1;
        }

        const col = Math.floor(relX / currentPieceSize);
        const row = Math.floor(relY / currentPieceSize);

        return row * currentGridDim + col;
    }, []);

    // Check if placing the dragging piece at targetSlot causes collision with its immediate neighbors
    const checkHoverCollision = useCallback((targetSlot) => {
        if (!draggingPiece || targetSlot === -1) return false;

        const currentPieces = [...piecesRef.current];
        const fromIndex = draggingPiece.currentIndex;
        if (fromIndex === -1) return false;

        const pieceFrom = currentPieces[fromIndex];
        const pieceTo = currentPieces[targetSlot];
        const originalPieceFrom = pieceFrom < 0 ? -pieceFrom - 1 : pieceFrom;

        // Simulate the swap
        let newPieceTo;
        if (fromIndex === targetSlot) {
            newPieceTo = pieceFrom;
            currentPieces[targetSlot] = originalPieceFrom;
        } else {
            if (pieceTo < 0) {
                // Target slot was empty. The tray piece for that target slot remains in the tray.
                newPieceTo = pieceTo;
            } else {
                // Target slot was occupied by an active piece.
                if (pieceFrom < 0) {
                    // Dragged from tray, so the occupied piece is bumped back to the tray (becomes negative).
                    newPieceTo = -pieceTo - 1;
                } else {
                    // Dragged from board, so we just swap their board positions (both stay active).
                    newPieceTo = pieceTo;
                }
            }

            currentPieces[targetSlot] = originalPieceFrom;
            currentPieces[fromIndex] = newPieceTo;
        }

        // Only check the slots involved in this move against their neighbors
        return checkSlotOverlap(currentPieces, targetSlot, gridDim) ||
            (fromIndex !== targetSlot && newPieceTo >= 0 && checkSlotOverlap(currentPieces, fromIndex, gridDim));
    }, [draggingPiece, gridDim]);

    // Handle piece swap
    const handlePieceSwap = useCallback((fromIndex, toIndex) => {
        if (toIndex === -1) return false;

        const currentPieces = [...piecesRef.current];

        const pieceFrom = currentPieces[fromIndex];
        const pieceTo = currentPieces[toIndex];

        // Dragged piece becomes active on the board (positive)
        const originalPieceFrom = pieceFrom < 0 ? -pieceFrom - 1 : pieceFrom;

        if (fromIndex === toIndex) {
            // Dragged and dropped on the same slot
            if (pieceFrom < 0) {
                // Piece was in the tray, now placing it on the board at its current slot index
                currentPieces[toIndex] = originalPieceFrom;

                if (checkSlotOverlap(currentPieces, toIndex, gridDim)) {
                    return false;
                }

                setPieces(currentPieces);
                setMoveCount(prev => prev + 1);
                setTrayOrder(prev => prev.filter(idx => idx !== originalPieceFrom));
                playJigsawSound();

                if (puzzleId) {
                    movePiece(puzzleId, fromIndex, toIndex, currentPieces).catch(err => {
                        console.error('Failed to update backend:', err);
                    });
                }

                if (checkSolved(currentPieces)) {
                    setIsSolved(true);
                    playCelebration();
                    try {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } catch (e) {}
                } else {
                    try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    } catch (e) {}
                }
                return true;
            } else {
                // Already active on the board, dropped back on the same slot. Just return true (no-op).
                return true;
            }
        }

        // Replaced/swapped piece logic
        let newPieceTo;
        if (pieceTo < 0) {
            // Target slot was empty. The tray piece for that target slot remains in the tray.
            newPieceTo = pieceTo;
        } else {
            // Target slot was occupied by an active piece.
            if (pieceFrom < 0) {
                // Dragged from tray, so the occupied piece is bumped back to the tray (becomes negative).
                newPieceTo = -pieceTo - 1;
            } else {
                // Dragged from board, so we just swap their board positions (both stay active).
                newPieceTo = pieceTo;
            }
        }

        currentPieces[toIndex] = originalPieceFrom;
        currentPieces[fromIndex] = newPieceTo;

        // Validate shape collisions before saving:
        // Only check the destination slot (and source if a piece lands there too)
        if (checkSlotOverlap(currentPieces, toIndex, gridDim)) {
            return false;
        }
        if (newPieceTo >= 0 && checkSlotOverlap(currentPieces, fromIndex, gridDim)) {
            return false;
        }

        // Check for duplicates (ignoring empty/null slots)
        const absolutePieces = currentPieces.map(p => p !== null ? (p < 0 ? -p - 1 : p) : null);
        const duplicates = absolutePieces.filter((item, index) => item !== null && absolutePieces.indexOf(item) !== index);
        if (duplicates.length > 0) {
            console.error('🧩 ⚠️ DUPLICATE PIECES AFTER SWAP:', duplicates);
        }

        setPieces(currentPieces);
        setMoveCount(prev => prev + 1);
        playJigsawSound();

        // Update trayOrder directly when moving from/to tray
        if (pieceFrom < 0) {
            if (pieceTo >= 0) {
                // Dragged from tray, bumped pieceTo back to tray
                setTrayOrder(prev => [pieceTo, ...prev.filter(idx => idx !== pieceTo && idx !== originalPieceFrom)]);
                setTimeout(() => {
                    trayScrollViewRef.current?.scrollTo({ x: 0, animated: true });
                }, 100);
            } else {
                // Dragged from tray, placed on empty board slot
                setTrayOrder(prev => prev.filter(idx => idx !== originalPieceFrom));
            }
        }

        // Update backend (async but don't wait)
        if (puzzleId) {
            movePiece(puzzleId, fromIndex, toIndex, currentPieces).catch(err => {
                console.error('Failed to update backend:', err);
            });
        }

        // Check if solved
        if (checkSolved(currentPieces)) {
            setIsSolved(true);
            playCelebration();
            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (e) {}
        } else {
            try {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            } catch (e) {}
        }
        return true;
    }, [puzzleId, movePiece, checkSolved, playCelebration, playJigsawSound, gridDim]);

    // Memoized pan responders
    const panResponders = useRef(
        Array(MAX_GRID_SIZE * MAX_GRID_SIZE).fill(null).map((_, index) =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => false,
                onMoveShouldSetPanResponder: (evt, gestureState) => {
                    const currentSlot = piecesRef.current.indexOf(index);
                    const isOnBoard = currentSlot !== -1;
                    if (isOnBoard) {
                        return (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2) && !isSolved;
                    }
                    // Only claim responder if vertical drag is dominant (to allow horizontal scrolling in tray)
                    const isVertical = Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
                    return isVertical && !isSolved;
                },
                onPanResponderTerminationRequest: () => false,

                onPanResponderGrant: (evt, gestureState) => {
                    measureGridPosition();

                    const currentSlot = piecesRef.current.indexOf(index) !== -1
                        ? piecesRef.current.indexOf(index)
                        : piecesRef.current.indexOf(-index - 1);
                    if (currentSlot === -1) return;
                    
                    // Set dragging piece state with layout information
                    setDraggingPiece({
                        originalIndex: index,
                        currentIndex: currentSlot,
                    });

                    // Set drag position to current finger position
                    dragPosition.setValue({
                        x: gestureState.x0,
                        y: gestureState.y0,
                    });
                },

                onPanResponderMove: (evt, gestureState) => {
                    // Update drag position with finger movement
                    dragPosition.setValue({
                        x: gestureState.moveX,
                        y: gestureState.moveY,
                    });

                    // Calculate if we are hovering over any slot on the board
                    const targetSlot = getTargetPosition(gestureState.moveX, gestureState.moveY);
                    setHoverTarget(targetSlot);
                },

                onPanResponderRelease: (evt, gestureState) => {
                    const targetSlot = getTargetPosition(gestureState.moveX, gestureState.moveY);
                    
                    const currentSlot = piecesRef.current.indexOf(index) !== -1
                        ? piecesRef.current.indexOf(index)
                        : piecesRef.current.indexOf(-index - 1);

                    if (targetSlot !== -1) {
                        // Yes, drop on board slot!
                        let success = true;
                        if (currentSlot !== -1) {
                            success = handlePieceSwap(currentSlot, targetSlot);
                        }
                        if (success) {
                            setHoverTarget(-1);
                            setDraggingPiece(null);
                        } else {
                            // If placing the piece caused an overlap collision, reject and animate back
                            try {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            } catch (e) {}
                            Animated.spring(dragPosition, {
                                toValue: { x: gestureState.x0, y: gestureState.y0 },
                                useNativeDriver: false,
                                tension: 40,
                                friction: 7,
                            }).start(() => {
                                setHoverTarget(-1);
                                setDraggingPiece(null);
                            });
                        }
                    } else {
                        // Drop outside board (back to tray)!
                        if (currentSlot !== -1) {
                            // If the piece was on the board (positive value), convert it back to a tray piece (negative).
                            // Note: piecesRef.current[currentSlot] may be -index-1 (already in tray) if piece was
                            // dragged from the tray without reaching a board slot.
                            const slotValue = piecesRef.current[currentSlot];
                            const wasOnBoard = slotValue >= 0; // board pieces are stored as non-negative originalIndex
                            if (wasOnBoard) {
                                const currentPieces = [...piecesRef.current];
                                currentPieces[currentSlot] = -slotValue - 1;
                                setPieces(currentPieces);
                                setMoveCount(prev => prev + 1);

                                // Prepend returned piece to trayOrder and scroll to beginning
                                setTrayOrder(prev => [slotValue, ...prev.filter(idx => idx !== slotValue)]);
                                setTimeout(() => {
                                    trayScrollViewRef.current?.scrollTo({ x: 0, animated: true });
                                }, 100);

                                if (puzzleId) {
                                    movePiece(puzzleId, currentSlot, -1, currentPieces).catch(err => {
                                        console.error('Failed to update backend:', err);
                                    });
                                }

                                // Reset dragging states immediately, preventing the ghost piece from flying back
                                setHoverTarget(-1);
                                setDraggingPiece(null);
                                try {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                } catch (e) {}
                                return;
                            }
                            // If wasOnBoard is false, piece was already in tray (negative) — nothing to do,
                            // it remains in the tray with its existing negative value.
                        }

                        // Animate back for pieces already in the tray dropped back to the tray
                        Animated.spring(dragPosition, {
                            toValue: { x: gestureState.x0, y: gestureState.y0 },
                            useNativeDriver: false,
                            tension: 40,
                            friction: 7,
                        }).start(() => {
                            setHoverTarget(-1);
                            setDraggingPiece(null);
                        });
                        try {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        } catch (e) {}
                    }
                },
            })
        )
    ).current;

    // Get piece image crop position - use exact pixel values
    const getPieceStyle = (originalIndex) => {
        const row = Math.floor(originalIndex / gridDim);
        const col = originalIndex % gridDim;
        return {
            position: 'absolute',
            top: -row * pieceSize,
            left: -col * pieceSize,
            width: actualPuzzleSize,
            height: actualPuzzleSize,
        };
    };

    // Get the position for each piece in the grid
    const getPiecePosition = (index) => {
        const row = Math.floor(index / gridDim);
        const col = index % gridDim;
        return {
            top: row * pieceSize - tabSize,
            left: col * pieceSize - tabSize,
        };
    };

    const resetToDefaultImage = () => {
        if (originalImageUrlRef.current) {
            setPuzzle(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    imageUrl: originalImageUrlRef.current,
                    gridSize: originalGridSizeRef.current || prev.gridSize || { rows: 5, cols: 5 }
                };
            });
            if (originalPiecesRef.current) {
                setPieces([...originalPiecesRef.current]);
                setTrayOrder(originalPiecesRef.current.filter(val => val !== null && val < 0).map(val => -val - 1));
            }
        }
    };

    const updatePuzzleForDev = (uri) => {
        setPuzzle(prev => {
            const base = prev || {
                id: 'dev-puzzle',
                status: 'pending',
                moveCount: 0,
            };
            return {
                ...base,
                imageUrl: uri,
                gridSize: { rows: 5, cols: 5 } // Always force 5x5 for dev custom image gallery picker testing
            };
        });
        // Generate a shuffled 5x5 pieces array (25 elements) for dev testing
        const devPieces = Array.from({ length: 25 }, (_, i) => i);
        for (let i = devPieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [devPieces[i], devPieces[j]] = [devPieces[j], devPieces[i]];
        }
        setPieces(devPieces.map(piece => -piece - 1));
        setTrayOrder(devPieces);
    };

    const performImageSelection = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to pick a custom dev image!');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 1,
            });

            if (result.canceled) return;
            const asset = result.assets ? result.assets[0] : result;
            const sourceUri = asset?.uri;
            if (!sourceUri) return;

            // Normalize URI prefix
            const normalizedUri = sourceUri.startsWith('file://') || sourceUri.startsWith('content://') 
                ? sourceUri 
                : (sourceUri.startsWith('/') ? `file://${sourceUri}` : sourceUri);

            const hasDimensions = asset?.width && asset?.height;
            if (hasDimensions) {
                try {
                    const width = asset.width;
                    const height = asset.height;
                    const size = Math.min(width, height);
                    const originX = (width - size) / 2;
                    const originY = (height - size) / 2;

                    const cropResult = await manipulateAsync(
                        normalizedUri,
                        [{ crop: { originX, originY, width: size, height: size } }],
                        { compress: 0.9, format: SaveFormat.JPEG }
                    );

                    updatePuzzleForDev(cropResult.uri);
                } catch (cropError) {
                    console.error('🧩 Failed to crop chosen image directly:', cropError);
                    updatePuzzleForDev(normalizedUri);
                }
            } else {
                // Fallback to Image.getSize if dimensions aren't present in Picker output
                Image.getSize(normalizedUri, async (width, height) => {
                    try {
                        const size = Math.min(width, height);
                        const originX = (width - size) / 2;
                        const originY = (height - size) / 2;

                        const cropResult = await manipulateAsync(
                            normalizedUri,
                            [{ crop: { originX, originY, width: size, height: size } }],
                            { compress: 0.9, format: SaveFormat.JPEG }
                        );

                        updatePuzzleForDev(cropResult.uri);
                    } catch (cropError) {
                        console.error('🧩 Failed to crop chosen image after getSize:', cropError);
                        updatePuzzleForDev(normalizedUri);
                    }
                }, (getSizeError) => {
                    console.error('🧩 Failed to get chosen image size:', getSizeError);
                    updatePuzzleForDev(normalizedUri);
                });
            }
        } catch (pickError) {
            console.error('🧩 Failed to pick image from gallery:', pickError);
        }
    };

    const handleDevPickImage = () => {
        if (originalImageUrlRef.current && puzzle?.imageUrl !== originalImageUrlRef.current) {
            Alert.alert(
                'Custom Dev Image',
                'Would you like to pick a new image or reset to the original default puzzle image?',
                [
                    { text: 'Pick New Image', onPress: () => performImageSelection() },
                    { text: 'Reset to Default', onPress: () => resetToDefaultImage() },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
        } else {
            performImageSelection();
        }
    };

    // Handle grid layout measurement
    const handleGridLayout = () => {
        measureGridPosition();
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
    }, [puzzle, imageLoaded, glowAnim, pulseAnim]);

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
                            {SHOW_DEV_NUMBERS && (
                                <>
                                    <TouchableOpacity
                                        onPress={handleDevPickImage}
                                        style={[styles.gridToggleBtn, { marginRight: 4 }]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ fontSize: 16 }}>🖼️</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setDevShowCorrect(!devShowCorrect)}
                                        style={[styles.gridToggleBtn, devShowCorrect && styles.gridToggleBtnActive, { marginRight: 4 }]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ fontSize: 16 }}>🎯</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setDevJiggle(!devJiggle)}
                                        style={[styles.gridToggleBtn, devJiggle && styles.gridToggleBtnActive, { marginRight: 4 }]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ fontSize: 16 }}>🫨</Text>
                                    </TouchableOpacity>
                                </>
                            )}
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
                                {devShowCorrect 
                                    ? '🎯 Dev Mode: Showing Correct Placements 🎯' 
                                    : devJiggle 
                                        ? '🫨 Dev Mode: Jiggly Explosive Cut-View 🫨' 
                                        : '👆 Drag pieces to swap them'}
                            </Text>
                        </View>
                    )}

                    {/* Puzzle Grid - Always rendered, reference image overlays it */}
                    <View style={styles.puzzleContainer}>
                        {/* Placeholder while image or puzzle is preparing */}
                        {(!imageLoaded || !piecesReady) && (
                            <View style={[styles.puzzleGrid, { width: actualPuzzleSize, height: actualPuzzleSize }, styles.puzzleGridPlaceholder]}>
                                <Text style={styles.loadingSubtext}>Loading the puzzle...</Text>
                            </View>
                        )}

                        <View
                            ref={gridRef}
                            style={[
                                styles.puzzleGrid,
                                {
                                    width: actualPuzzleSize,
                                    height: actualPuzzleSize,
                                    opacity: (piecesReady && !showReference) ? 1 : 0
                                }
                            ]}
                            onLayout={handleGridLayout}
                            collapsable={false}
                            pointerEvents={showReference ? 'none' : 'auto'}
                        >
                            {piecesReady && pieces.length > 0 && pieces.length === gridDim * gridDim && pieces.map((val, currentIndex) => {
                                const isHovered = hoverTarget === currentIndex && draggingPiece;
                                const isDragging = draggingPiece && draggingPiece.currentIndex === currentIndex;

                                // Decide which piece index to show (placed piece or hover preview)
                                const renderPieceIndex = (devShowCorrect || devJiggle)
                                    ? currentIndex 
                                    : (val >= 0 ? val : (isHovered ? draggingPiece.originalIndex : -1));

                                const slotRow = Math.floor(currentIndex / gridDim);
                                const slotCol = currentIndex % gridDim;
                                const originalRow = renderPieceIndex !== -1 ? Math.floor(renderPieceIndex / gridDim) : 0;
                                const originalCol = renderPieceIndex !== -1 ? renderPieceIndex % gridDim : 0;
                                const isColliding = isHovered && checkHoverCollision(currentIndex);
                                const renderedPiecePath = renderPieceIndex !== -1
                                    ? getPiecePath(originalRow, originalCol, gridDim, pieceSize, tabSize)
                                    : null;
                                const renderedPieceEdgePaths = renderPieceIndex !== -1
                                    ? getPieceEdgePaths(originalRow, originalCol, gridDim, pieceSize, tabSize)
                                    : null;
                                const slotPiecePath = getPiecePath(slotRow, slotCol, gridDim, pieceSize, tabSize);
                                const isCorrectlyPlaced = renderPieceIndex === currentIndex;
                                const hasVisibleBoardPiece = (slotIndex) => {
                                    if (slotIndex < 0 || slotIndex >= pieces.length) return false;
                                    if (devShowCorrect || devJiggle) return true;
                                    return pieces[slotIndex] >= 0 || (hoverTarget === slotIndex && draggingPiece);
                                };
                                const sharedEdges = {
                                    top: slotRow > 0 && hasVisibleBoardPiece(currentIndex - gridDim),
                                    right: slotCol < gridDim - 1 && hasVisibleBoardPiece(currentIndex + 1),
                                    bottom: slotRow < gridDim - 1 && hasVisibleBoardPiece(currentIndex + gridDim),
                                    left: slotCol > 0 && hasVisibleBoardPiece(currentIndex - 1),
                                };

                                const idleY = devJiggle ? idleAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, (currentIndex % 2 === 0 ? 3.5 : -3.5)],
                                }) : 0;
                                const idleX = devJiggle ? idleAnim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, (currentIndex % 3 === 0 ? -2.5 : 2.5)],
                                }) : 0;

                                return (
                                    <Animated.View
                                        key={`piece-${currentIndex}`}
                                        style={[
                                            styles.pieceContainer,
                                            getPiecePosition(currentIndex),
                                            {
                                                width: pieceSize + 2 * tabSize,
                                                height: pieceSize + 2 * tabSize,
                                                opacity: (devShowCorrect || devJiggle)
                                                    ? 1
                                                    : (isDragging 
                                                        ? 0.0  // Hide piece from original board slot while dragging to prevent overlapping
                                                        : (val >= 0 
                                                            ? 1 
                                                            : (isHovered ? 0.45 : 0))),
                                                transform: [
                                                    { translateX: pieceAnimations[currentIndex].translateX },
                                                    { translateY: pieceAnimations[currentIndex].translateY },
                                                    { translateX: pieceAnimations[currentIndex].jiggleX },
                                                    { translateY: pieceAnimations[currentIndex].jiggleY },
                                                    { translateX: idleX },
                                                    { translateY: idleY },
                                                    { 
                                                        rotate: pieceAnimations[currentIndex].jiggleRotate.interpolate({
                                                            inputRange: [-360, 360],
                                                            outputRange: ['-360deg', '360deg']
                                                         })
                                                    },
                                                    { scale: pieceAnimations[currentIndex].scale },
                                                ],
                                                zIndex: isDragging ? 100 : (currentIndex + 1),
                                                elevation: isDragging ? 20 : 1,
                                            },
                                        ]}
                                        shouldRasterizeIOS={true}
                                        renderToHardwareTextureAndroid={true}
                                        needsOffscreenAlphaCompositing={true}
                                        pointerEvents={(devShowCorrect || devJiggle || val >= 0) ? 'auto' : 'none'}
                                        {...(val >= 0 && panResponders[val] ? panResponders[val].panHandlers : {})}
                                    >
                                        <Svg
                                            width={pieceSize + 2 * tabSize}
                                            height={pieceSize + 2 * tabSize}
                                            viewBox={`0 0 ${pieceSize + 2 * tabSize} ${pieceSize + 2 * tabSize}`}
                                            overflow="visible"
                                        >
                                            {renderPieceIndex !== -1 && (
                                                <Defs>
                                                    <ClipPath id={`clip-${currentIndex}`}>
                                                        <Path d={renderedPiecePath} />
                                                    </ClipPath>
                                                </Defs>
                                            )}
                                            {renderedPiecePath && (
                                                <RaisedPieceEdges
                                                    path={renderedPiecePath}
                                                    edgePaths={renderedPieceEdgePaths}
                                                    hiddenEdges={sharedEdges}
                                                    includeBevel={false}
                                                />
                                            )}
                                            {renderPieceIndex !== -1 && (
                                                <SvgImage
                                                    href={puzzle.imageUrl}
                                                    x={tabSize - originalCol * pieceSize + imgOffsetX}
                                                    y={tabSize - originalRow * pieceSize + imgOffsetY}
                                                    width={scaledImgW}
                                                    height={scaledImgH}
                                                    clipPath={`url(#clip-${currentIndex})`}
                                                />
                                            )}
                                            {renderedPiecePath && isCorrectlyPlaced && (
                                                <Path
                                                    d={renderedPiecePath}
                                                    fill="none"
                                                    stroke="rgba(34, 197, 94, 0.9)"
                                                    strokeWidth={2.4}
                                                />
                                            )}
                                            {renderedPiecePath && (
                                                <RaisedPieceEdges
                                                    path={renderedPiecePath}
                                                    edgePaths={renderedPieceEdgePaths}
                                                    hiddenEdges={sharedEdges}
                                                    includeShadow={false}
                                                />
                                            )}
                                            {showGridLines && !isSolved && (val < 0 || isColliding) && (
                                                <Path
                                                    d={slotPiecePath}
                                                    fill="none"
                                                    stroke={isColliding ? "rgba(255, 75, 75, 0.9)" : "rgba(255, 255, 255, 0.55)"}
                                                    strokeWidth={isColliding ? 2.5 : 1.5}
                                                />
                                            )}
                                            {SHOW_DEV_NUMBERS && renderPieceIndex !== -1 && (
                                                <SvgText
                                                    x={tabSize + pieceSize / 2}
                                                    y={tabSize + pieceSize / 2 + (gridDim > 4 ? 3 : 6)}
                                                    fill="#FF4B4B"
                                                    fontSize={Math.max(8, Math.floor(pieceSize * 0.28)).toString()}
                                                    fontWeight="bold"
                                                    textAnchor="middle"
                                                >
                                                    {gridDim > 4 
                                                        ? `${currentIndex}/${renderPieceIndex}` 
                                                        : `Idx: ${currentIndex} / Orig: ${renderPieceIndex}`}
                                                </SvgText>
                                            )}
                                        </Svg>
                                    </Animated.View>
                                );
                            })}
                        </View>

                        {/* Reference image overlay - shown on top during countdown */}
                        {showReference && imageLoaded && (
                            <Animated.View style={[styles.referenceOverlay, { opacity: referenceOpacity }]}>
                                <Text style={styles.referencePreviewLabel}>Memorize this image ⏱️</Text>
                                <View style={[styles.referenceImageWrapper, { width: actualPuzzleSize, height: actualPuzzleSize }]}>
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

                    {/* Horizontal Tray of Unplaced Pieces */}
                    {!isSolved && imageLoaded && piecesReady && !showReference && (
                        <View style={styles.trayContainer}>
                            <Text style={styles.trayTitle}>Remaining Pieces</Text>
                            <ScrollView
                                ref={trayScrollViewRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.trayScrollView}
                                contentContainerStyle={styles.trayContent}
                                scrollEnabled={!draggingPiece}
                            >
                                {trayOrder.map((originalIndex) => {
                                    // Render pieces that are in the tray (negative value in pieces array)
                                    if (!pieces.includes(-originalIndex - 1) || devShowCorrect) return null;

                                    const originalRow = Math.floor(originalIndex / gridDim);
                                    const originalCol = originalIndex % gridDim;
                                    const trayPiecePath = getPiecePath(originalRow, originalCol, gridDim, pieceSize, tabSize);
                                    
                                    const trayScale = TRAY_PIECE_HEIGHT / (pieceSize + 2 * tabSize);
                                    const trayPieceSize = (pieceSize + 2 * tabSize) * trayScale;
                                    const isBeingDragged = draggingPiece && draggingPiece.originalIndex === originalIndex;

                                    return (
                                        <View
                                            key={`tray-piece-wrapper-${originalIndex}`}
                                            style={[
                                                styles.trayPieceWrapper,
                                                { width: trayPieceSize, height: trayPieceSize }
                                            ]}
                                        >
                                            <Animated.View
                                                style={[
                                                    styles.trayPieceContainer,
                                                    {
                                                        width: pieceSize + 2 * tabSize,
                                                        height: pieceSize + 2 * tabSize,
                                                        transform: [{ scale: trayScale }],
                                                        opacity: isBeingDragged ? 0.15 : 1,
                                                    }
                                                ]}
                                                {...(panResponders[originalIndex] ? panResponders[originalIndex].panHandlers : {})}
                                            >
                                                <Svg
                                                    width={pieceSize + 2 * tabSize}
                                                    height={pieceSize + 2 * tabSize}
                                                    viewBox={`0 0 ${pieceSize + 2 * tabSize} ${pieceSize + 2 * tabSize}`}
                                                    overflow="visible"
                                                >
                                                    <Defs>
                                                        <ClipPath id={`clip-tray-${originalIndex}`}>
                                                            <Path d={trayPiecePath} />
                                                        </ClipPath>
                                                    </Defs>
                                                    <RaisedPieceEdges path={trayPiecePath} includeBevel={false} />
                                                    <SvgImage
                                                        href={puzzle.imageUrl}
                                                        x={tabSize - originalCol * pieceSize + imgOffsetX}
                                                        y={tabSize - originalRow * pieceSize + imgOffsetY}
                                                        width={scaledImgW}
                                                        height={scaledImgH}
                                                        clipPath={`url(#clip-tray-${originalIndex})`}
                                                    />
                                                    <RaisedPieceEdges path={trayPiecePath} includeShadow={false} />
                                                    <Path
                                                        d={trayPiecePath}
                                                        fill="none"
                                                        stroke="rgba(255, 255, 255, 0.7)"
                                                        strokeWidth={1.5}
                                                    />
                                                    {SHOW_DEV_NUMBERS && (
                                                        <SvgText
                                                            x={tabSize + pieceSize / 2}
                                                            y={tabSize + pieceSize / 2 + (gridDim > 4 ? 3 : 6)}
                                                            fill="#FF4B4B"
                                                            fontSize={Math.max(8, Math.floor(pieceSize * 0.28)).toString()}
                                                            fontWeight="bold"
                                                            textAnchor="middle"
                                                        >
                                                            {originalIndex}
                                                        </SvgText>
                                                    )}
                                                </Svg>
                                            </Animated.View>
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

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
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                activeOpacity={0.8}
                                style={styles.premiumActionButton}
                            >
                                <Text style={styles.premiumActionText}>Back to Home</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                </SafeAreaView>
            </GradientBackground>
            {draggingPiece && (
                <Animated.View
                    style={[
                        styles.draggingOverlay,
                        {
                            width: pieceSize + 2 * tabSize,
                            height: pieceSize + 2 * tabSize,
                            left: dragPosition.x,
                            top: dragPosition.y,
                            transform: [
                                { translateX: -pieceSize / 2 - tabSize },
                                { translateY: -pieceSize / 2 - tabSize },
                                { scale: 1.1 },
                            ],
                        }
                    ]}
                    pointerEvents="none"
                >
                    {(() => {
                        const dragRow = Math.floor(draggingPiece.originalIndex / gridDim);
                        const dragCol = draggingPiece.originalIndex % gridDim;
                        const dragPiecePath = getPiecePath(dragRow, dragCol, gridDim, pieceSize, tabSize);

                        return (
                    <Svg
                        width={pieceSize + 2 * tabSize}
                        height={pieceSize + 2 * tabSize}
                        viewBox={`0 0 ${pieceSize + 2 * tabSize} ${pieceSize + 2 * tabSize}`}
                        overflow="visible"
                    >
                        <Defs>
                            <ClipPath id={`clip-drag-${draggingPiece.originalIndex}`}>
                                <Path d={dragPiecePath} />
                            </ClipPath>
                        </Defs>
                        <RaisedPieceEdges path={dragPiecePath} isDragging includeBevel={false} />
                        <SvgImage
                            href={puzzle.imageUrl}
                            x={tabSize - dragCol * pieceSize + imgOffsetX}
                            y={tabSize - dragRow * pieceSize + imgOffsetY}
                            width={scaledImgW}
                            height={scaledImgH}
                            clipPath={`url(#clip-drag-${draggingPiece.originalIndex})`}
                        />
                        <RaisedPieceEdges path={dragPiecePath} isDragging includeShadow={false} />
                        <Path
                            d={dragPiecePath}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.8)"
                            strokeWidth={2}
                        />
                    </Svg>
                        );
                    })()}
                </Animated.View>
            )}
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
        overflow: 'visible',
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
    premiumActionButton: {
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
    premiumActionText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
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
    trayContainer: {
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.sm,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E9D5FF', // beautiful lavender border
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 3,
    },
    trayTitle: {
        fontFamily: fontFamily.bold,
        fontSize: 12,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    trayScrollView: {
        width: '100%',
        maxHeight: 150,
    },
    trayContent: {
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        gap: 8,
    },
    trayPieceWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 4,
    },
    trayPieceContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible',
    },
    draggingOverlay: {
        position: 'absolute',
        zIndex: 9999,
        elevation: 99,
        overflow: 'visible',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
    },
});

export default JigsawPuzzleScreen;
