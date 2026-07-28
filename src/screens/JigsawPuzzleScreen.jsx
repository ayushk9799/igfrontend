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
    AppState,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import Svg, { Path, Image as SvgImage, ClipPath, Defs, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { createSafeAudioPlayer } from '../utils/safeAudioPlayer';

import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import GradientBackground from '../components/GradientBackground';
import { usePuzzle } from '../hooks/usePuzzle';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';
import { getUser } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const MAX_GRID_SIZE = 9;
const PUZZLE_DURATION_MS = 5 * 60 * 1000;
const SHOW_DEV_NUMBERS = false; // Set to false to hide dev tools in production
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
                        stroke="rgba(255, 255, 255, 0.42)"
                        strokeWidth={isDragging ? 1.5 : 1.1}
                        transform="translate(-0.45 -0.45)"
                    />
                    <Path
                        d={edgePath}
                        fill="none"
                        stroke="rgba(44, 20, 72, 0.18)"
                        strokeWidth={isDragging ? 1.7 : 1.25}
                        transform="translate(0.55 0.7)"
                    />
                </React.Fragment>
            ))}
        </>
    );
};

const DraggedPuzzlePiece = React.memo(({
    gridDim,
    pieceSize,
    tabSize,
    imageUrl,
    imgOffsetX,
    imgOffsetY,
    scaledImgW,
    scaledImgH,
    dragPosition,
    draggingPiece,
    dragVisualPieceIndex,
    piecePathCache,
}) => {
    const outerSize = pieceSize + 2 * tabSize;
    const centerOffset = outerSize / 2;
    // Keep this layer mounted between drags so SvgImage can retain its decoded
    // image texture instead of briefly rendering only the vector piece edges.
    const activeIndex = draggingPiece
        ? draggingPiece.originalIndex
        : dragVisualPieceIndex;

    const row = Math.floor(activeIndex / gridDim);
    const col = activeIndex % gridDim;
    const path = piecePathCache?.[activeIndex]?.path || getPiecePath(row, col, gridDim, pieceSize, tabSize);
    const imgX = tabSize - col * pieceSize + imgOffsetX;
    const imgY = tabSize - row * pieceSize + imgOffsetY;

    return (
        <Animated.View
            style={[
                styles.draggingOverlay,
                draggingPiece ? styles.draggingOverlayVisible : styles.draggingOverlayHidden,
                {
                    width: outerSize,
                    height: outerSize,
                    transform: [
                        { translateX: dragPosition.x },
                        { translateY: dragPosition.y },
                        { translateX: -centerOffset },
                        { translateY: -centerOffset },
                        { scale: 1.1 },
                    ],
                }
            ]}
            pointerEvents="none"
        >
            <Svg
                width={outerSize}
                height={outerSize}
                viewBox={`0 0 ${outerSize} ${outerSize}`}
                overflow="visible"
            >
                <Defs>
                    <ClipPath id={`clip-drag-${activeIndex}`}>
                        <Path d={path} />
                    </ClipPath>
                </Defs>
                <RaisedPieceEdges path={path} isDragging includeBevel={false} />
                <SvgImage
                    href={imageUrl}
                    x={imgX}
                    y={imgY}
                    width={scaledImgW}
                    height={scaledImgH}
                    clipPath={`url(#clip-drag-${activeIndex})`}
                />
                <RaisedPieceEdges path={path} isDragging includeShadow={false} />
                <Path
                    d={path}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.5)"
                    strokeWidth={1.25}
                />
            </Svg>
        </Animated.View>
    );
});

DraggedPuzzlePiece.displayName = 'DraggedPuzzlePiece';

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
            <Text style={timerStyles.label}>{translateUiText("sec")}</Text>
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

const helperNormalizePieces = (rawPieces, gridSize, status) => {
    if (!rawPieces || !Array.isArray(rawPieces)) return [];
    const dim = gridSize?.rows || 5;
    const targetLength = dim * dim;
    let loadedPieces = [...rawPieces];
    if (loadedPieces.length < targetLength) {
        loadedPieces = [...loadedPieces, ...Array(targetLength - loadedPieces.length).fill(null)];
    } else if (loadedPieces.length > targetLength) {
        loadedPieces = loadedPieces.slice(0, targetLength);
    }
    const hasNegative = loadedPieces.some(p => p !== null && p < 0);
    if (!hasNegative && status !== 'solved') {
        loadedPieces = loadedPieces.map((p) => p !== null ? -p - 1 : null);
    }
    return loadedPieces;
};

const PuzzleLoader = ({ pulseAnim, glowAnim, compact = false }) => (
    <View style={[styles.loaderContent, compact && styles.loaderContentCompact]}>
        <Animated.View
            style={[
                styles.loaderMark,
                compact && styles.loaderMarkCompact,
                {
                    opacity: glowAnim,
                    transform: [{ scale: pulseAnim }],
                },
            ]}
        >
            <View style={styles.loaderPiece} />
            <View style={[styles.loaderPiece, styles.loaderPieceLight]} />
            <View style={[styles.loaderPiece, styles.loaderPieceLight]} />
            <View style={[styles.loaderPiece, styles.loaderPieceOffset]} />
        </Animated.View>
        <Text style={[styles.loadingText, compact && styles.loadingTextCompact]}>{translateUiText("Building your puzzle")}</Text>
        <Text style={[styles.loadingSubtext, compact && styles.loadingSubtextCompact]}>{translateUiText("Cutting the photo into pieces…")}</Text>
    </View>
);

/**
 * JigsawPuzzleScreen - The actual puzzle-solving game
 * Features: Smooth drag-and-drop pieces, 5-second reference preview
 */
const JigsawPuzzleScreen = ({ navigation, route }) => {
    const { puzzleId, puzzleData: initialData } = route.params || {};
    const { getPuzzle, startPuzzle, movePiece } = usePuzzle();

    const activePuzzleId = puzzleId || initialData?._id || initialData?.id;
    const initialNormalizedPieces = React.useMemo(() => (
        initialData?.pieces ? helperNormalizePieces(initialData.pieces, initialData.gridSize, initialData.status) : []
    ), [initialData?.pieces, initialData?.gridSize, initialData?.status]);

    const initialNormalizedTray = React.useMemo(() => (
        initialNormalizedPieces.filter(val => val !== null && val < 0).map(val => -val - 1)
    ), [initialNormalizedPieces]);

    const [puzzle, setPuzzle] = useState(initialData || null);
    const [pieces, setPieces] = useState(initialNormalizedPieces);
    const [trayOrder, setTrayOrder] = useState(initialNormalizedTray);
    const [moveCount, setMoveCount] = useState(initialData?.moveCount || 0);
    const [isSolved, setIsSolved] = useState(initialData?.status === 'solved');
    const [showReference, setShowReference] = useState(initialData?.status === 'pending');
    const [expiresAt, setExpiresAt] = useState(initialData?.expiresAt || null);
    const [remainingMs, setRemainingMs] = useState(() => (
        initialData?.expiresAt
            ? Math.max(0, new Date(initialData.expiresAt).getTime() - Date.now())
            : PUZZLE_DURATION_MS
    ));
    const [isExpired, setIsExpired] = useState(initialData?.status === 'expired');

    useEffect(() => {
        if (!initialData) return;
        setPuzzle(initialData);
        if (initialData.pieces && Array.isArray(initialData.pieces)) {
            const norm = helperNormalizePieces(initialData.pieces, initialData.gridSize, initialData.status);
            setPieces(norm);
            setTrayOrder(norm.filter(val => val !== null && val < 0).map(val => -val - 1));
        }
        if (initialData.moveCount !== undefined) {
            setMoveCount(initialData.moveCount);
        }
        if (initialData.expiresAt) {
            setExpiresAt(initialData.expiresAt);
            setRemainingMs(Math.max(0, new Date(initialData.expiresAt).getTime() - Date.now()));
        }
        setIsSolved(initialData.status === 'solved');
        setShowReference(initialData.status === 'pending');
        setIsExpired(initialData.status === 'expired');
    }, [initialData]);
    const [isStarting, setIsStarting] = useState(false);
    const [screenMessage, setScreenMessage] = useState(null);
    const [leaveWarningShown, setLeaveWarningShown] = useState(false);
    const [draggingPiece, setDraggingPiece] = useState(null);
    const [dragVisualPieceIndex, setDragVisualPieceIndex] = useState(0);
    const draggingIndex = draggingPiece ? draggingPiece.currentIndex : null;
    const dragPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });
    const [hoverTarget, setHoverTarget] = useState(-1);
    const [imageLoaded, setImageLoaded] = useState(false);
    const showGridLines = true;
    const [piecesReady, setPiecesReady] = useState(false); // Delay piece rendering
    const [puzzleContentReady, setPuzzleContentReady] = useState(false);
    const [referenceImageReady, setReferenceImageReady] = useState(false);
    const [devShowCorrect, setDevShowCorrect] = useState(false);
    const [devJiggle, setDevJiggle] = useState(false);
    const hasRequestedGameReviewRef = useRef(false);
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
    const naturalW = (imageNaturalSize?.width && imageNaturalSize.width > 1) ? imageNaturalSize.width : actualPuzzleSize;
    const naturalH = (imageNaturalSize?.height && imageNaturalSize.height > 1) ? imageNaturalSize.height : actualPuzzleSize;

    const imgCoverScale = Math.max(
        actualPuzzleSize / naturalW,
        actualPuzzleSize / naturalH,
    );
    const scaledImgW = naturalW * imgCoverScale;
    const scaledImgH = naturalH * imgCoverScale;
    // Center the scaled image over the puzzle area (negative values = image overflows grid edge)
    const imgOffsetX = (actualPuzzleSize - scaledImgW) / 2;
    const imgOffsetY = (actualPuzzleSize - scaledImgH) / 2;

    // Cache for precalculated cut-piece SVG paths and edge paths
    const piecePathCache = React.useMemo(() => {
        const total = gridDim * gridDim;
        const cache = new Array(total);
        for (let i = 0; i < total; i++) {
            const r = Math.floor(i / gridDim);
            const c = i % gridDim;
            cache[i] = {
                path: getPiecePath(r, c, gridDim, pieceSize, tabSize),
                edgePaths: getPieceEdgePaths(r, c, gridDim, pieceSize, tabSize),
                row: r,
                col: c,
            };
        }
        return cache;
    }, [gridDim, pieceSize, tabSize]);

    const gridRef = useRef(null);

    // Animation refs
    const celebrateScale = useRef(new Animated.Value(0)).current;
    const celebrateOpacity = useRef(new Animated.Value(0)).current;
    const referenceOpacity = useRef(new Animated.Value(1)).current;
    const idleAnim = useRef(new Animated.Value(0)).current;
    const expiredScale = useRef(new Animated.Value(0.85)).current;
    const expiredOpacity = useRef(new Animated.Value(0)).current;

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

    const { socket } = useSocketContext();
    const currentUser = getUser();
    const currentUserId = currentUser?.id || currentUser?._id;
    const isCreator = puzzle?.creatorId
        ? (puzzle.creatorId._id || puzzle.creatorId) === currentUserId
        : false;
    const isSpectator = isCreator;

    // Pieces ref for use in pan responders
    const piecesRef = useRef(pieces);
    useEffect(() => {
        piecesRef.current = pieces;
    }, [pieces]);
    const interactionLockedRef = useRef(isSpectator || isSolved || isExpired || showReference);
    useEffect(() => {
        interactionLockedRef.current = isSpectator || isSolved || isExpired || showReference;
    }, [isExpired, isSolved, showReference, isSpectator]);

    useEffect(() => {
        if (!socket) return;
        const targetId = puzzleId || puzzle?._id;
        if (!targetId) return;

        const handleSocketUpdate = (eventData) => {
            const updated = eventData?.puzzle;
            const currentTargetId = String(puzzleId || puzzle?._id);
            if (eventData?.puzzleId && String(eventData.puzzleId) === currentTargetId && updated) {
                setPuzzle(updated);
                if (updated.pieces && Array.isArray(updated.pieces)) {
                    setPieces(updated.pieces);
                    setTrayOrder(updated.pieces.filter(val => val !== null && val < 0).map(val => -val - 1));
                }
                if (updated.moveCount !== undefined) {
                    setMoveCount(updated.moveCount);
                }
                if (updated.expiresAt) {
                    setExpiresAt(updated.expiresAt);
                    setRemainingMs(Math.max(0, new Date(updated.expiresAt).getTime() - Date.now()));
                }
                if (updated.status === 'in_progress') {
                    setShowReference(false);
                } else if (updated.status === 'solved') {
                    setIsSolved(true);
                    playCelebration();
                } else if (updated.status === 'expired') {
                    expireLocally();
                }
            }
        };

        socket.on('puzzle:updated', handleSocketUpdate);
        return () => {
            socket.off('puzzle:updated', handleSocketUpdate);
        };
    }, [socket, puzzleId, puzzle?._id, playCelebration, expireLocally]);

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
    const dropHandoffFrameRef = useRef(null);
    const dropHandoffTimeoutRef = useRef(null);
    const pendingDropHandoffRef = useRef(null);
    const loadedBoardSlotsRef = useRef(new Set());

    useEffect(() => {
        loadedBoardSlotsRef.current.clear();
    }, [puzzle?.imageUrl]);

    useEffect(() => () => {
        if (dropHandoffFrameRef.current !== null) {
            cancelAnimationFrame(dropHandoffFrameRef.current);
        }
        if (dropHandoffTimeoutRef.current !== null) {
            clearTimeout(dropHandoffTimeoutRef.current);
        }
    }, []);

    const trayScrollViewRef = useRef(null);
    const audioPlayerRef = useRef(null);
    const jigsawSoundUriRef = useRef(null);
    const jigsawSoundPlayingRef = useRef(false);
    const jigsawSoundTimeoutRef = useRef(null);
    const moveQueueRef = useRef(Promise.resolve());
    const legacyStartAttemptedRef = useRef(false);

    useEffect(() => {
        audioPlayerRef.current = createSafeAudioPlayer();
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
        let isMounted = true;
        const targetId = activePuzzleId;
        if (!targetId) return;

        getPuzzle(targetId).then((result) => {
            if (result.success && isMounted) {
                const loadedPuzzle = result.data;
                const loadedPieces = helperNormalizePieces(loadedPuzzle.pieces, loadedPuzzle.gridSize, loadedPuzzle.status);
                setPuzzle(loadedPuzzle);
                setPieces(loadedPieces);
                setTrayOrder(loadedPieces.filter(val => val !== null && val < 0).map(val => -val - 1));
                setMoveCount(loadedPuzzle.moveCount || 0);
                setExpiresAt(loadedPuzzle.expiresAt || null);
                setIsSolved(loadedPuzzle.status === 'solved');
                setShowReference(loadedPuzzle.status === 'pending');
                setIsExpired(loadedPuzzle.status === 'expired');
            }
        });

        return () => {
            isMounted = false;
        };
    }, [activePuzzleId, getPuzzle]);

    // Preload puzzle image and measure natural size safely
    useEffect(() => {
        if (!puzzle?.imageUrl) return;

        let isMounted = true;

        Image.getSize(
            puzzle.imageUrl,
            (w, h) => {
                if (!isMounted) return;
                if (w > 0 && h > 0) {
                    setImageNaturalSize({ width: w, height: h });
                }
                setImageLoaded(true);
                setPiecesReady(true);
            },
            () => {
                if (!isMounted) return;
                setImageLoaded(true);
                setPiecesReady(true);
            }
        );

        Image.prefetch(puzzle.imageUrl).catch(() => {});

        return () => {
            isMounted = false;
        };
    }, [puzzle?.imageUrl]);

    // Do not dismiss the loader at prefetch time. Give the board and tray SVGs
    // two render frames to mount and paint the shared image first.
    useEffect(() => {
        if (!imageLoaded || !piecesReady || pieces.length === 0) {
            setPuzzleContentReady(false);
            return undefined;
        }

        let secondFrame;
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                setPuzzleContentReady(true);
            });
        });

        return () => {
            cancelAnimationFrame(firstFrame);
            if (secondFrame) cancelAnimationFrame(secondFrame);
        };
    }, [imageLoaded, pieces.length, piecesReady, trayOrder.length]);

    const expireLocally = useCallback(() => {
        setRemainingMs(0);
        setIsSolved(false);
        setIsExpired(true);
        setDraggingPiece(null);
        setHoverTarget(-1);
    }, []);

    // A fixed deadline keeps running across screens, backgrounding, and offline periods.
    useEffect(() => {
        if (!expiresAt || isSolved || isExpired) return undefined;

        const updateRemaining = () => {
            const next = Math.max(0, new Date(expiresAt).getTime() - Date.now());
            setRemainingMs(next);
            if (next <= 0) expireLocally();
        };
        updateRemaining();
        const timer = setInterval(updateRemaining, 1000);
        const expiryTimer = setTimeout(
            expireLocally,
            Math.max(0, new Date(expiresAt).getTime() - Date.now())
        );
        const appStateSubscription = AppState.addEventListener('change', updateRemaining);

        return () => {
            clearInterval(timer);
            clearTimeout(expiryTimer);
            appStateSubscription.remove();
        };
    }, [expiresAt, expireLocally, isExpired, isSolved]);

    // Pending puzzles get one 5-second preview; its end permanently starts the attempt.
    useEffect(() => {
        if (
            !showReference
            || puzzle?.status !== 'pending'
            || !puzzleContentReady
            || !referenceImageReady
        ) {
            return undefined;
        }

        const timer = setTimeout(async () => {
            setIsStarting(true);
            const result = await startPuzzle(puzzleId || puzzle?._id);
            setIsStarting(false);
            if (result.success) {
                setPuzzle(result.data);
                setExpiresAt(result.data.expiresAt);
                setRemainingMs(Math.max(0, new Date(result.data.expiresAt).getTime() - Date.now()));
                setShowReference(false);
            } else if (result.code === 'PUZZLE_EXPIRED') {
                setShowReference(false);
                expireLocally();
            } else {
                setScreenMessage({
                    tone: 'error',
                    text: translateUiText("Couldn’t start the puzzle. Check your connection and open it again."),
                });
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [
        expireLocally,
        navigation,
        puzzle,
        puzzleId,
        puzzleContentReady,
        referenceImageReady,
        showReference,
        startPuzzle,
    ]);

    // Puzzles that were already active before timed puzzles existed need a deadline once.
    useEffect(() => {
        if (
            puzzle?.status !== 'in_progress'
            || puzzle.expiresAt
            || expiresAt
            || isExpired
            || legacyStartAttemptedRef.current
        ) {
            return;
        }

        legacyStartAttemptedRef.current = true;
        let cancelled = false;
        setIsStarting(true);
        startPuzzle(puzzleId || puzzle?._id).then((result) => {
            if (cancelled) return;
            setIsStarting(false);
            if (result.success && result.data?.expiresAt) {
                setPuzzle(result.data);
                setExpiresAt(result.data.expiresAt);
                setRemainingMs(Math.max(
                    0,
                    new Date(result.data.expiresAt).getTime() - Date.now()
                ));
            } else if (result.code === 'PUZZLE_EXPIRED') {
                expireLocally();
            }
        });

        return () => {
            cancelled = true;
        };
    }, [
        expireLocally,
        expiresAt,
        isExpired,
        puzzle,
        puzzleId,
        startPuzzle,
    ]);

    const handleBack = useCallback(() => {
        if (puzzle?.status === 'in_progress' && !isSolved && !isExpired && !leaveWarningShown) {
            const seconds = Math.ceil(remainingMs / 1000);
            const minutesPart = Math.floor(seconds / 60);
            const secondsPart = String(seconds % 60).padStart(2, '0');
            setLeaveWarningShown(true);
            setScreenMessage({
                tone: 'warning',
                text: translateUiTemplate("Puzzle still running — {{0}}:{{1}} left. Your timer continues if you leave. Tap back again to leave.", [
                    minutesPart,
                    secondsPart,
                ]),
            });
            return;
        }
        navigation.goBack();
    }, [isExpired, isSolved, leaveWarningShown, navigation, puzzle?.status, remainingMs]);

    const timerSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const timerLabel = `${String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;
    const timerTone = timerSeconds <= 30 ? 'danger' : timerSeconds <= 60 ? 'warning' : 'normal';

    // trayOrder is synchronized directly inside interaction and helper functions

    // Check if solved
    const checkSolved = useCallback((currentPieces) => {
        return currentPieces.every((piece, index) => piece === index);
    }, []);

    const requestGameReviewOnce = useCallback(() => {
        if (hasRequestedGameReviewRef.current) return;
        hasRequestedGameReviewRef.current = true;
        requestReviewForMoment(REVIEW_MOMENTS.GAME_COMPLETED);
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

    useEffect(() => {
        if (isExpired) {
            Animated.parallel([
                Animated.spring(expiredScale, {
                    toValue: 1,
                    friction: 6,
                    tension: 80,
                    useNativeDriver: true,
                }),
                Animated.timing(expiredOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [isExpired, expiredOpacity, expiredScale]);

    const persistMove = useCallback((fromIndex, toIndex, currentPieces) => {
        const targetId = activePuzzleId;
        if (!targetId) return;
        moveQueueRef.current = moveQueueRef.current
            .catch(() => {})
            .then(() => movePiece(targetId, fromIndex, toIndex, currentPieces))
            .then((result) => {
                if (result?.code === 'PUZZLE_EXPIRED') {
                    expireLocally();
                }
            })
            .catch((error) => {
                console.error('Failed to update backend:', error);
            });
    }, [activePuzzleId, expireLocally, movePiece]);

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

                persistMove(fromIndex, toIndex, currentPieces);

                if (checkSolved(currentPieces)) {
                    setIsSolved(true);
                    requestGameReviewOnce();
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
        persistMove(fromIndex, toIndex, currentPieces);

        // Check if solved
        if (checkSolved(currentPieces)) {
            setIsSolved(true);
            requestGameReviewOnce();
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
    }, [checkSolved, requestGameReviewOnce, playCelebration, playJigsawSound, gridDim, persistMove]);

    const completeDropHandoff = useCallback(() => {
        if (dropHandoffFrameRef.current !== null) {
            cancelAnimationFrame(dropHandoffFrameRef.current);
        }
        if (dropHandoffTimeoutRef.current !== null) {
            clearTimeout(dropHandoffTimeoutRef.current);
            dropHandoffTimeoutRef.current = null;
        }

        // onLoad fires when the native image is ready; keep the overlay for one
        // additional paint so there is never an outline-only destination frame.
        dropHandoffFrameRef.current = requestAnimationFrame(() => {
            setHoverTarget(-1);
            setDraggingPiece(null);
            pendingDropHandoffRef.current = null;
            dropHandoffFrameRef.current = null;
        });
    }, []);

    const handleBoardPieceImageLoad = useCallback((slotIndex) => {
        loadedBoardSlotsRef.current.add(slotIndex);
        const pendingDrop = pendingDropHandoffRef.current;
        if (pendingDrop && pendingDrop.targetSlot === slotIndex) {
            completeDropHandoff();
        }
    }, [completeDropHandoff]);

    const handleBoardPieceImageError = useCallback((slotIndex) => {
        const pendingDrop = pendingDropHandoffRef.current;
        if (pendingDrop && pendingDrop.targetSlot === slotIndex) {
            completeDropHandoff();
        }
    }, [completeDropHandoff]);

    const finishSuccessfulDrop = useCallback((targetSlot) => {
        const {
            gridDim: currentGridDim,
            pieceSize: currentPieceSize,
        } = gridMetricsRef.current;
        const measuredGridPosition = gridPositionRef.current;
        const targetRow = Math.floor(targetSlot / currentGridDim);
        const targetCol = targetSlot % currentGridDim;

        // Keep the already-loaded floating piece over the committed board slot
        // until React Native has painted the destination SvgImage underneath it.
        dragPosition.setValue({
            x: measuredGridPosition.x + (targetCol + 0.5) * currentPieceSize,
            y: measuredGridPosition.y + (targetRow + 0.5) * currentPieceSize,
        });

        pendingDropHandoffRef.current = { targetSlot };

        if (loadedBoardSlotsRef.current.has(targetSlot)) {
            completeDropHandoff();
            return;
        }

        // Do not leave interaction stuck if the remote image fails silently.
        dropHandoffTimeoutRef.current = setTimeout(completeDropHandoff, 3000);
    }, [completeDropHandoff, dragPosition]);

    // Memoized pan responders
    const panResponders = useRef(
        Array(MAX_GRID_SIZE * MAX_GRID_SIZE).fill(null).map((_, index) =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => false,
                onMoveShouldSetPanResponder: (evt, gestureState) => {
                    if (interactionLockedRef.current) return false;
                    const currentSlot = piecesRef.current.indexOf(index);
                    const isOnBoard = currentSlot !== -1;
                    if (isOnBoard) {
                        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
                    }
                    // Only claim responder if vertical drag is dominant (to allow horizontal scrolling in tray)
                    const isVertical = Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
                    return isVertical;
                },
                onPanResponderTerminationRequest: () => false,

                onPanResponderGrant: (evt, gestureState) => {
                    if (interactionLockedRef.current) return;
                    measureGridPosition();

                    const currentSlot = piecesRef.current.indexOf(index) !== -1
                        ? piecesRef.current.indexOf(index)
                        : piecesRef.current.indexOf(-index - 1);
                    if (currentSlot === -1) return;
                    
                    // Position the pre-warmed drag layer before revealing it.
                    dragPosition.setValue({
                        x: gestureState.x0,
                        y: gestureState.y0,
                    });
                    setDragVisualPieceIndex(index);
                    setDraggingPiece({
                        originalIndex: index,
                        currentIndex: currentSlot,
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
                    if (hoverTargetRef.current !== targetSlot) {
                        hoverTargetRef.current = targetSlot;
                        setHoverTarget(targetSlot);
                    }
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
                            finishSuccessfulDrop(targetSlot);
                        } else {
                            // If placing the piece caused an overlap collision, reject and animate back
                            try {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            } catch (e) {}
                            Animated.spring(dragPosition, {
                                toValue: { x: gestureState.x0, y: gestureState.y0 },
                                useNativeDriver: true,
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

                                persistMove(currentSlot, -1, currentPieces);

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
                            useNativeDriver: true,
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
                setScreenMessage({
                    tone: 'error',
                    text: translateUiText("Photo library access is needed to choose an image."),
                });
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
        performImageSelection();
    };

    const handleDevSimulateSolve = () => {
        const solvedPieces = Array.from({ length: gridDim * gridDim }, (_, i) => i);
        setPieces(solvedPieces);
        setTrayOrder([]);
        setShowReference(false);
        setIsExpired(false);
        setIsSolved(true);
        playCelebration();
    };

    const handleDevSimulateExpire = () => {
        setShowReference(false);
        setIsSolved(false);
        setIsExpired(true);
    };

    // Handle grid layout measurement
    const handleGridLayout = () => {
        measureGridPosition();
    };

    // Pulsing animation for loading
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        if (!puzzle || !puzzleContentReady || (showReference && !referenceImageReady)) {
            const pulseLoop = Animated.loop(
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
            );

            const glowLoop = Animated.loop(
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
            );

            pulseLoop.start();
            glowLoop.start();

            return () => {
                pulseLoop.stop();
                glowLoop.stop();
            };
        }
        return undefined;
    }, [
        puzzle,
        puzzleContentReady,
        referenceImageReady,
        showReference,
        glowAnim,
        pulseAnim,
    ]);

    if (!puzzle) {
        return (
            <View style={{ flex: 1 }}>
                <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
                <GradientBackground variant="light" showOrbs={true}>
                    <SafeAreaView style={styles.loadingContainer}>
                        <PuzzleLoader pulseAnim={pulseAnim} glowAnim={glowAnim} />
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
                        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>
                            {isSolved ? translateUiText("Made it whole") : isSpectator ? translateUiText("Partner's Puzzle") : translateUiText("Piece it together")}
                        </Text>
                        <View style={styles.headerRight}>
                            {!showReference && !isSolved && (
                                <View style={[
                                    styles.solveTimer,
                                    timerTone === 'warning' && styles.solveTimerWarning,
                                    timerTone === 'danger' && styles.solveTimerDanger,
                                ]}>
                                    <Text style={[
                                        styles.solveTimerText,
                                        timerTone !== 'normal' && styles.solveTimerTextUrgent,
                                    ]}>⏱ {timerLabel}</Text>
                                </View>
                            )}
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
                                    <TouchableOpacity
                                        onPress={handleDevSimulateSolve}
                                        style={[styles.gridToggleBtn, isSolved && styles.gridToggleBtnActive, { marginRight: 4 }]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ fontSize: 16 }}>🎉</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleDevSimulateExpire}
                                        style={[styles.gridToggleBtn, isExpired && styles.gridToggleBtnActive, { marginRight: 4 }]}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={{ fontSize: 16 }}>⏰</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>

                    {screenMessage && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setScreenMessage(null)}
                            style={[
                                styles.screenMessage,
                                screenMessage.tone === 'error'
                                    ? styles.screenMessageError
                                    : styles.screenMessageWarning,
                            ]}
                        >
                            <Text style={[
                                styles.screenMessageText,
                                screenMessage.tone === 'error'
                                    ? styles.screenMessageTextError
                                    : styles.screenMessageTextWarning,
                            ]}>
                                {screenMessage.text}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Instructions */}
                    {!isSolved && !isExpired && (
                        <View style={styles.instructionContainer}>
                            <Text style={styles.instructionText}>
                                {devShowCorrect 
                                    ? translateUiText("🎯 Dev Mode: Showing Correct Placements 🎯")
                                    : devJiggle 
                                        ? translateUiText("🫨 Dev Mode: Jiggly Explosive Cut-View 🫨")
                                        : isSpectator
                                            ? translateUiTemplate("Watching your partner piece it together · {{0}} moves", [moveCount])
                                            : translateUiTemplate("Drag a piece into place · {{0}} moves", [moveCount])}
                            </Text>
                        </View>
                    )}

                    {/* Puzzle Grid - Always rendered, reference image overlays it */}
                    <View style={styles.puzzleContainer}>
                        {/* Placeholder while image or puzzle is preparing */}
                        {(!puzzleContentReady || (showReference && !referenceImageReady)) && (
                            <View style={[styles.puzzleGrid, { width: actualPuzzleSize, height: actualPuzzleSize }, styles.puzzleGridPlaceholder]}>
                                <PuzzleLoader
                                    pulseAnim={pulseAnim}
                                    glowAnim={glowAnim}
                                    compact
                                />
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
                            shouldRasterizeIOS={true}
                            renderToHardwareTextureAndroid={true}
                            pointerEvents={(showReference || isExpired || isSpectator) ? 'none' : 'auto'}
                        >
                            {piecesReady && pieces.length > 0 && pieces.length === gridDim * gridDim && pieces.map((val, currentIndex) => {
                                const isHovered = hoverTarget === currentIndex && draggingPiece;
                                const isDragging = draggingPiece && draggingPiece.currentIndex === currentIndex;

                                // Decide which piece index to show (placed piece or hover preview)
                                const renderPieceIndex = (devShowCorrect || devJiggle)
                                    ? currentIndex 
                                    : (val >= 0 ? val : (isHovered ? draggingPiece.originalIndex : -1));
                                // Every board slot keeps one SvgImage mounted, even while
                                // empty. Only its crop changes, so drops never create a new
                                // native image node or wait for another texture decode.
                                const texturePieceIndex = renderPieceIndex !== -1
                                    ? renderPieceIndex
                                    : currentIndex;

                                const slotRow = Math.floor(currentIndex / gridDim);
                                const slotCol = currentIndex % gridDim;
                                const originalRow = Math.floor(texturePieceIndex / gridDim);
                                const originalCol = texturePieceIndex % gridDim;
                                const isColliding = isHovered && checkHoverCollision(currentIndex);
                                const renderedPiecePath = renderPieceIndex !== -1
                                    ? piecePathCache[renderPieceIndex]?.path
                                    : null;
                                const renderedPieceEdgePaths = renderPieceIndex !== -1
                                    ? piecePathCache[renderPieceIndex]?.edgePaths
                                    : null;
                                const slotPiecePath = piecePathCache[currentIndex]?.path;
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
                                            <Defs>
                                                <ClipPath id={`clip-${currentIndex}`}>
                                                    <Path d={renderedPiecePath || slotPiecePath} />
                                                </ClipPath>
                                            </Defs>
                                            {renderedPiecePath && (
                                                <RaisedPieceEdges
                                                    path={renderedPiecePath}
                                                    edgePaths={renderedPieceEdgePaths}
                                                    hiddenEdges={sharedEdges}
                                                    includeBevel={false}
                                                />
                                            )}
                                            <SvgImage
                                                href={typeof puzzle.imageUrl === 'string' ? { uri: puzzle.imageUrl } : puzzle.imageUrl}
                                                x={tabSize - originalCol * pieceSize + imgOffsetX}
                                                y={tabSize - originalRow * pieceSize + imgOffsetY}
                                                width={scaledImgW}
                                                height={scaledImgH}
                                                clipPath={`url(#clip-${currentIndex})`}
                                                onLoad={() => handleBoardPieceImageLoad(currentIndex)}
                                                onError={() => handleBoardPieceImageError(currentIndex)}
                                            />
                                            {renderedPiecePath && isCorrectlyPlaced && !isSolved && (
                                                <Path
                                                    d={renderedPiecePath}
                                                    fill="none"
                                                    stroke="rgba(34, 197, 94, 0.9)"
                                                    strokeWidth={2.4}
                                                />
                                            )}
                                            {renderedPiecePath && !isSolved && (
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
                        {showReference && puzzleContentReady && (
                            <Animated.View style={[
                                styles.referenceOverlay,
                                { opacity: referenceImageReady ? referenceOpacity : 0 },
                            ]}>
                                <Text style={styles.referencePreviewLabel}>{translateUiText("Memorize this image 👀")}</Text>
                                <View style={[styles.referenceImageWrapper, { width: actualPuzzleSize, height: actualPuzzleSize }]}>
                                    <Image
                                        source={{
                                            uri: puzzle.imageUrl,
                                            cache: 'force-cache'
                                        }}
                                        style={styles.referencePreviewImage}
                                        resizeMode="cover"
                                        fadeDuration={0}
                                        onLoad={() => setReferenceImageReady(true)}
                                    />
                                    {referenceImageReady && (
                                        <View style={styles.countdownBadge}>
                                            <CountdownTimer duration={5} />
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.referencePreviewHint}>
                                    {isStarting ? translateUiText("Starting your timer...") : translateUiText("You’ll have 5 minutes to solve it")}
                                </Text>
                            </Animated.View>
                        )}
                    </View>

                    {/* Horizontal Tray of Unplaced Pieces */}
                    {!isSolved && !isExpired && imageLoaded && piecesReady && !showReference && (
                        <View style={styles.trayContainer}>
                            <Text style={styles.trayTitle}>{translateUiText("Remaining Pieces")}</Text>
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
                                    const trayPiecePath = piecePathCache[originalIndex]?.path || getPiecePath(originalRow, originalCol, gridDim, pieceSize, tabSize);
                                    
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
                                            shouldRasterizeIOS={true}
                                            renderToHardwareTextureAndroid={true}
                                            collapsable={false}
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
                                                shouldRasterizeIOS={true}
                                                renderToHardwareTextureAndroid={true}
                                                needsOffscreenAlphaCompositing={true}
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
                                                        href={typeof puzzle.imageUrl === 'string' ? { uri: puzzle.imageUrl } : puzzle.imageUrl}
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
                                                        stroke="rgba(255, 255, 255, 0.42)"
                                                        strokeWidth={1}
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
                            <Text style={styles.celebrateTitle}>{translateUiText("You made it whole ✨")}</Text>
                            <Text style={styles.celebrateSubtitle}>
                                {moveCount === 1
                                    ? translateUiTemplate("Every piece found its place in {{0}} move.", [moveCount])
                                    : translateUiTemplate("Every piece found its place in {{0}} moves.", [moveCount])}
                            </Text>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                activeOpacity={0.8}
                                style={styles.premiumActionButton}
                            >
                                <Text style={styles.premiumActionText}>{translateUiText("Done")}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                    {isExpired && (
                        <Animated.View style={[
                            styles.celebrationInline,
                            {
                                opacity: expiredOpacity,
                                transform: [{ scale: expiredScale }],
                            },
                        ]}>
                            <Text style={styles.celebrateTitle}>{translateUiText("Time’s up")}</Text>
                            <Text style={styles.celebrateSubtitle}>
                                {moveCount === 1
                                    ? translateUiTemplate("You made {{0}} move before the timer ended.", [moveCount])
                                    : translateUiTemplate("You made {{0}} moves before the timer ended.", [moveCount])}
                            </Text>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                activeOpacity={0.8}
                                style={styles.premiumActionButton}
                            >
                                <Text style={styles.premiumActionText}>{translateUiText("Done")}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}

                </SafeAreaView>
            </GradientBackground>
            {imageLoaded && piecesReady && (
                <DraggedPuzzlePiece
                    gridDim={gridDim}
                    pieceSize={pieceSize}
                    tabSize={tabSize}
                    imageUrl={puzzle.imageUrl}
                    imgOffsetX={imgOffsetX}
                    imgOffsetY={imgOffsetY}
                    scaledImgW={scaledImgW}
                    scaledImgH={scaledImgH}
                    dragPosition={dragPosition}
                    draggingPiece={draggingPiece}
                    dragVisualPieceIndex={dragVisualPieceIndex}
                    piecePathCache={piecePathCache}
                />
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
        paddingHorizontal: spacing.xl,
    },
    loaderContent: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    loaderContentCompact: {
        width: 'auto',
    },
    loaderMark: {
        width: 88,
        height: 88,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        padding: 10,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderWidth: 1,
        borderColor: '#E8D9FA',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
        elevation: 6,
    },
    loaderMarkCompact: {
        width: 68,
        height: 68,
        padding: 8,
        gap: 4,
        borderRadius: 20,
    },
    loaderPiece: {
        width: '46%',
        height: '46%',
        borderRadius: 8,
        backgroundColor: colors.primary,
    },
    loaderPieceLight: {
        backgroundColor: '#C9A7F4',
    },
    loaderPieceOffset: {
        backgroundColor: '#A66BE0',
        transform: [{ translateX: 3 }, { translateY: -3 }],
    },
    loadingText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 21,
        fontWeight: '800',
        color: colors.text,
        marginTop: spacing.xl,
        textAlign: 'center',
    },
    loadingTextCompact: {
        fontSize: 16,
        marginTop: spacing.md,
    },
    loadingSubtext: {
        fontFamily: fontFamily.medium,
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        textAlign: 'center',
    },
    loadingSubtextCompact: {
        fontSize: 12,
        marginTop: 3,
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
    solveTimer: {
        minWidth: 84,
        alignItems: 'center',
        backgroundColor: colors.primarySoft,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.primaryLight,
    },
    solveTimerWarning: {
        backgroundColor: '#FFF3CD',
        borderColor: '#F4B740',
    },
    solveTimerDanger: {
        backgroundColor: '#FFE2E2',
        borderColor: '#F05252',
    },
    solveTimerText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 15,
        fontWeight: '800',
        color: colors.primary,
        fontVariant: ['tabular-nums'],
    },
    solveTimerTextUrgent: {
        color: '#C53030',
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
    screenMessage: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
    },
    screenMessageWarning: {
        backgroundColor: '#FFF7D6',
        borderColor: '#E5A820',
    },
    screenMessageError: {
        backgroundColor: '#FFE8E8',
        borderColor: '#E05252',
    },
    screenMessageText: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '700',
        textAlign: 'center',
    },
    screenMessageTextWarning: {
        color: '#8A5700',
    },
    screenMessageTextError: {
        color: '#B42318',
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
        zIndex: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
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
    expiredModalOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 10, 30, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        zIndex: 1000,
        elevation: 100,
    },
    expiredModalCard: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#FFFFFF',
        borderRadius: 28,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        shadowColor: '#1A0B2E',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
        borderWidth: 1.5,
        borderColor: '#F3E8FF',
    },
    expiredIconBadge: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#FFF1F2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 1.5,
        borderColor: '#FFE4E6',
        shadowColor: '#F43F5E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
    },
    expiredEmoji: {
        fontSize: 38,
    },
    expiredTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 24,
        fontWeight: '800',
        color: '#1E1B4B',
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    expiredSubtitle: {
        fontFamily: fontFamily.medium,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        color: colors.textSecondary,
        marginBottom: spacing.lg,
        paddingHorizontal: spacing.xs,
    },
    expiredStatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xl,
        width: '100%',
    },
    expiredStatBadge: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: spacing.xl,
        backgroundColor: '#F8F5FF',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: '#E9D5FF',
        minWidth: 140,
    },
    expiredStatNumber: {
        fontFamily: fontFamily.extraBold,
        fontSize: 22,
        fontWeight: '800',
        color: colors.primary,
    },
    expiredStatLabel: {
        fontFamily: fontFamily.bold,
        fontSize: 11,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 2,
    },
    expiredPrimaryButton: {
        backgroundColor: colors.primary,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    expiredPrimaryButtonText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.bold,
        fontSize: 16,
        fontWeight: '700',
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
        left: 0,
        top: 0,
        zIndex: 9999,
        elevation: 99,
        overflow: 'visible',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
    },
    draggingOverlayVisible: {
        opacity: 1,
    },
    draggingOverlayHidden: {
        opacity: 0,
    },
});

export default JigsawPuzzleScreen;
