import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Platform,
    Animated,
    StatusBar,
    AppState,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { createSafeAudioPlayer } from '../utils/safeAudioPlayer';

import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import GradientBackground from '../components/GradientBackground';
import { usePuzzle } from '../hooks/usePuzzle';
import * as Haptics from 'expo-haptics';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';
import { getUser } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import {
    runOnJS,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { usePuzzleTexture } from '../hooks/usePuzzleTexture';
import {
    buildPieceGeometry,
    checkSlotOverlap,
} from '../features/jigsaw/pieceGeometry';
import {
    getTrayContentWidth,
    JigsawBoardCanvas,
    JigsawDraggedPiece,
    JigsawPieceGestureTarget,
    JigsawTrayCanvas,
    TRAY_ITEM_GAP,
} from '../components/jigsaw/JigsawSkiaRenderer';

const PUZZLE_DURATION_MS = 5 * 60 * 1000;
const SHOW_DEV_NUMBERS = false; // Set to false to hide dev tools in production
const TRAY_PIECE_HEIGHT = 110;
const TRAY_CANVAS_CHUNK_SIZE = 25;


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

const helperNormalizePieces = (rawPieces, gridSize) => {
    if (!rawPieces || !Array.isArray(rawPieces)) return [];
    const dim = gridSize?.rows || 5;
    const targetLength = dim * dim;
    let loadedPieces = [...rawPieces];
    if (loadedPieces.length < targetLength) {
        loadedPieces = [...loadedPieces, ...Array(targetLength - loadedPieces.length).fill(null)];
    } else if (loadedPieces.length > targetLength) {
        loadedPieces = loadedPieces.slice(0, targetLength);
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
        initialData?.pieces ? helperNormalizePieces(initialData.pieces, initialData.gridSize) : []
    ), [initialData?.pieces, initialData?.gridSize]);

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
            const norm = helperNormalizePieces(initialData.pieces, initialData.gridSize);
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
    const dragX = useSharedValue(0);
    const dragY = useSharedValue(0);
    const dragOriginX = useSharedValue(0);
    const dragOriginY = useSharedValue(0);
    const [gridPosition, setGridPosition] = useState({ x: 0, y: 0 });
    const [imageLoaded, setImageLoaded] = useState(false);
    const [piecesReady, setPiecesReady] = useState(false); // Delay piece rendering
    const [puzzleContentReady, setPuzzleContentReady] = useState(false);
    const [referenceImageReady, setReferenceImageReady] = useState(false);
    const [devShowCorrect, setDevShowCorrect] = useState(false);
    const [devJiggle, setDevJiggle] = useState(false);
    const hasRequestedGameReviewRef = useRef(false);
    // Natural pixel dimensions of the puzzle image (loaded asynchronously)
    const [imageNaturalSize, setImageNaturalSize] = useState({ width: 1, height: 1 });
    const {
        image: puzzleTexture,
        localUri: puzzleTextureUri,
        status: puzzleTextureStatus,
        error: puzzleTextureError,
        retry: retryPuzzleTexture,
    } = usePuzzleTexture(activePuzzleId, puzzle?.imageUrl);

    useEffect(() => {
        setReferenceImageReady(false);
    }, [puzzle?.imageUrl]);

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
    const piecePathCache = React.useMemo(
        () => buildPieceGeometry(gridDim, pieceSize, tabSize),
        [gridDim, pieceSize, tabSize]
    );
    const visibleTrayPieces = React.useMemo(() => (
        devShowCorrect
            ? []
            : trayOrder.filter(originalIndex => pieces.includes(-originalIndex - 1))
    ), [devShowCorrect, pieces, trayOrder]);
    const trayCanvasWidth = getTrayContentWidth(
        visibleTrayPieces.length,
        TRAY_PIECE_HEIGHT
    );
    const trayChunks = React.useMemo(() => {
        const chunks = [];
        for (
            let start = 0;
            start < visibleTrayPieces.length;
            start += TRAY_CANVAS_CHUNK_SIZE
        ) {
            chunks.push(visibleTrayPieces.slice(
                start,
                start + TRAY_CANVAS_CHUNK_SIZE
            ));
        }
        return chunks;
    }, [visibleTrayPieces]);

    const gridRef = useRef(null);

    // Animation refs
    const celebrateScale = useRef(new Animated.Value(0)).current;
    const celebrateOpacity = useRef(new Animated.Value(0)).current;
    const referenceOpacity = useRef(new Animated.Value(1)).current;
    const expiredScale = useRef(new Animated.Value(0.85)).current;
    const expiredOpacity = useRef(new Animated.Value(0)).current;

    const { socket } = useSocketContext();
    const currentUser = getUser();
    const currentUserId = currentUser?.id || currentUser?._id;
    const isCreator = puzzle?.creatorId
        ? (puzzle.creatorId._id || puzzle.creatorId) === currentUserId
        : false;
    const isSolver = puzzle?.partnerId
        ? (puzzle.partnerId._id || puzzle.partnerId) === currentUserId
        : false;
    const isSpectator = isCreator;
    const usesFiveMinuteTimer = puzzle?.timerMode === 'five_minute';

    // Keep the latest board state available to gesture callbacks.
    const piecesRef = useRef(pieces);
    useEffect(() => {
        piecesRef.current = pieces;
    }, [pieces]);
    const interactionLockedRef = useRef(isSpectator || isSolved || isExpired || showReference);
    useEffect(() => {
        interactionLockedRef.current = isSpectator || isSolved || isExpired || showReference;
    }, [isExpired, isSolved, showReference, isSpectator]);

    // Grid position ref
    const gridPositionRef = useRef(gridPosition);
    useEffect(() => {
        gridPositionRef.current = gridPosition;
    }, [gridPosition]);

    const gridMetricsRef = useRef({ gridDim, pieceSize, actualPuzzleSize });
    useEffect(() => {
        gridMetricsRef.current = { gridDim, pieceSize, actualPuzzleSize };
    }, [gridDim, pieceSize, actualPuzzleSize]);

    const dropHandoffFrameRef = useRef(null);

    useEffect(() => () => {
        if (dropHandoffFrameRef.current !== null) {
            cancelAnimationFrame(dropHandoffFrameRef.current);
        }
    }, []);

    const trayScrollViewRef = useRef(null);
    const audioPlayerRef = useRef(null);
    const jigsawSoundUriRef = useRef(null);
    const jigsawSoundPlayingRef = useRef(false);
    const jigsawSoundTimeoutRef = useRef(null);
    const moveQueueRef = useRef(Promise.resolve());

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

    // Load puzzle data
    useEffect(() => {
        let isMounted = true;
        const targetId = activePuzzleId;
        if (!targetId) return;

        getPuzzle(targetId).then((result) => {
            if (result.success && isMounted) {
                const loadedPuzzle = result.data;
                const loadedPieces = helperNormalizePieces(loadedPuzzle.pieces, loadedPuzzle.gridSize);
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

    // Gameplay is enabled only after the single local texture has been decoded
    // by Skia. No individual puzzle piece performs image loading.
    useEffect(() => {
        const ready = Boolean(puzzleTexture && pieces.length > 0);
        setImageLoaded(ready);
        setPiecesReady(ready);
        setPuzzleContentReady(ready);

        if (ready) {
            setImageNaturalSize({
                width: puzzleTexture.width(),
                height: puzzleTexture.height(),
            });
            setScreenMessage(current => (
                current?.source === 'texture' ? null : current
            ));
        }
    }, [pieces.length, puzzleTexture]);

    useEffect(() => {
        if (puzzleTextureStatus !== 'error') return;
        setScreenMessage({
            tone: 'error',
            source: 'texture',
            text: translateUiText("Couldn’t prepare the puzzle image. Tap retry to try again."),
        });
    }, [puzzleTextureError, puzzleTextureStatus]);

    const expireLocally = useCallback(() => {
        setRemainingMs(0);
        setIsSolved(false);
        setIsExpired(true);
        setDraggingPiece(null);
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
            || !isSolver
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
                setExpiresAt(result.data.expiresAt || null);
                setRemainingMs(result.data.expiresAt
                    ? Math.max(0, new Date(result.data.expiresAt).getTime() - Date.now())
                    : 0);
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
        isSolver,
        startPuzzle,
    ]);

    const handleBack = useCallback(() => {
        if (isSpectator) {
            navigation.goBack();
            return;
        }

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
    }, [isExpired, isSolved, isSpectator, leaveWarningShown, navigation, puzzle?.status, remainingMs]);

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
        if (!socket) return undefined;
        const targetId = puzzleId || puzzle?._id;
        if (!targetId) return undefined;

        const handleSocketUpdate = (eventData) => {
            const updated = eventData?.puzzle;
            const currentTargetId = String(targetId);
            if (
                eventData?.puzzleId
                && String(eventData.puzzleId) === currentTargetId
                && updated
            ) {
                setPuzzle(updated);
                if (updated.pieces && Array.isArray(updated.pieces)) {
                    const normalizedPieces = helperNormalizePieces(
                        updated.pieces,
                        updated.gridSize
                    );
                    setPieces(normalizedPieces);
                    setTrayOrder(normalizedPieces
                        .filter(value => value !== null && value < 0)
                        .map(value => -value - 1));
                }
                if (updated.moveCount !== undefined) {
                    setMoveCount(updated.moveCount);
                }
                if (updated.expiresAt) {
                    setExpiresAt(updated.expiresAt);
                    setRemainingMs(Math.max(
                        0,
                        new Date(updated.expiresAt).getTime() - Date.now()
                    ));
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
    }, [expireLocally, playCelebration, puzzle?._id, puzzleId, socket]);

    // Setter live view must also work when the solver is on an older client
    // that only persists moves through REST and does not share live socket
    // capabilities. Polling is a read-only fallback; sockets still provide
    // the faster path when both clients support them.
    useEffect(() => {
        if (
            !isSpectator
            || !activePuzzleId
            || !['pending', 'in_progress'].includes(puzzle?.status)
        ) {
            return undefined;
        }

        let cancelled = false;
        let requestInFlight = false;

        const refreshSpectatorView = async () => {
            if (requestInFlight) return;
            requestInFlight = true;
            const result = await getPuzzle(activePuzzleId);
            requestInFlight = false;

            if (cancelled || !result?.success || !result.data) return;

            const updated = result.data;
            const updatedPieces = helperNormalizePieces(updated.pieces, updated.gridSize);
            setPuzzle(updated);
            setPieces(updatedPieces);
            setTrayOrder(updatedPieces
                .filter(value => value !== null && value < 0)
                .map(value => -value - 1));
            setMoveCount(updated.moveCount || 0);
            setExpiresAt(updated.expiresAt || null);
            setRemainingMs(updated.expiresAt
                ? Math.max(0, new Date(updated.expiresAt).getTime() - Date.now())
                : 0);
            setShowReference(updated.status === 'pending');

            if (updated.status === 'solved') {
                setIsSolved(true);
                playCelebration();
            } else if (updated.status === 'expired') {
                expireLocally();
            }
        };

        refreshSpectatorView();
        const pollingTimer = setInterval(refreshSpectatorView, 1000);

        return () => {
            cancelled = true;
            clearInterval(pollingTimer);
        };
    }, [
        activePuzzleId,
        expireLocally,
        getPuzzle,
        isSpectator,
        playCelebration,
        puzzle?.status,
    ]);

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

    const clearActiveDrag = useCallback(() => {
        if (dropHandoffFrameRef.current !== null) {
            cancelAnimationFrame(dropHandoffFrameRef.current);
            dropHandoffFrameRef.current = null;
        }
        setDraggingPiece(null);
    }, []);

    const finishSuccessfulDrop = useCallback((targetSlot) => {
        const {
            gridDim: currentGridDim,
            pieceSize: currentPieceSize,
        } = gridMetricsRef.current;
        const measuredGridPosition = gridPositionRef.current;
        const targetRow = Math.floor(targetSlot / currentGridDim);
        const targetCol = targetSlot % currentGridDim;

        dragX.value = measuredGridPosition.x + (targetCol + 0.5) * currentPieceSize;
        dragY.value = measuredGridPosition.y + (targetRow + 0.5) * currentPieceSize;

        if (dropHandoffFrameRef.current !== null) {
            cancelAnimationFrame(dropHandoffFrameRef.current);
        }
        dropHandoffFrameRef.current = requestAnimationFrame(() => {
            setDraggingPiece(null);
            dropHandoffFrameRef.current = null;
        });
    }, [dragX, dragY]);

    const animateDragBack = useCallback(() => {
        const springConfig = {
            damping: 24,
            mass: 0.7,
            stiffness: 280,
        };
        dragX.value = withSpring(dragOriginX.value, springConfig);
        dragY.value = withSpring(dragOriginY.value, springConfig, (finished) => {
            if (finished) {
                runOnJS(clearActiveDrag)();
            }
        });
    }, [clearActiveDrag, dragOriginX, dragOriginY, dragX, dragY]);

    const handleDragStart = useCallback((originalIndex, sourceSlot, pageX, pageY) => {
        if (interactionLockedRef.current || !puzzleTexture) return;
        measureGridPosition();
        dragX.value = pageX;
        dragY.value = pageY;
        setDraggingPiece({
            originalIndex,
            currentIndex: sourceSlot,
        });
    }, [dragX, dragY, measureGridPosition, puzzleTexture]);

    const handleDragEnd = useCallback((originalIndex, sourceSlot, pageX, pageY) => {
        if (interactionLockedRef.current) {
            clearActiveDrag();
            return;
        }

        const targetSlot = getTargetPosition(pageX, pageY);
        const boardSlot = piecesRef.current.indexOf(originalIndex);
        const traySlot = piecesRef.current.indexOf(-originalIndex - 1);
        const currentSlot = boardSlot !== -1
            ? boardSlot
            : (traySlot !== -1 ? traySlot : sourceSlot);

        if (targetSlot !== -1 && currentSlot !== -1) {
            const success = handlePieceSwap(currentSlot, targetSlot);
            if (success) {
                finishSuccessfulDrop(targetSlot);
                return;
            }

            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            } catch (e) {}
            animateDragBack();
            return;
        }

        if (currentSlot !== -1) {
            const slotValue = piecesRef.current[currentSlot];
            if (slotValue >= 0) {
                const currentPieces = [...piecesRef.current];
                currentPieces[currentSlot] = -slotValue - 1;
                setPieces(currentPieces);
                setMoveCount(previous => previous + 1);
                setTrayOrder(previous => [
                    slotValue,
                    ...previous.filter(index => index !== slotValue),
                ]);
                setTimeout(() => {
                    trayScrollViewRef.current?.scrollTo({ x: 0, animated: true });
                }, 100);
                persistMove(currentSlot, -1, currentPieces);
                clearActiveDrag();
                try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch (e) {}
                return;
            }
        }

        animateDragBack();
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {}
    }, [
        animateDragBack,
        clearActiveDrag,
        finishSuccessfulDrop,
        getTargetPosition,
        handlePieceSwap,
        persistMove,
    ]);

    const handleDragCancel = useCallback(() => {
        clearActiveDrag();
    }, [clearActiveDrag]);

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
                            {!showReference && !isSolved && !isExpired && expiresAt && (
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
                                {puzzleTextureStatus === 'error' ? (
                                    <View style={styles.textureError}>
                                        <Text style={styles.textureErrorText}>
                                            {translateUiText("Couldn’t prepare the puzzle image.")}
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.textureRetryButton}
                                            onPress={retryPuzzleTexture}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.textureRetryText}>{translateUiText("Retry")}</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <PuzzleLoader
                                        pulseAnim={pulseAnim}
                                        glowAnim={glowAnim}
                                        compact
                                    />
                                )}
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
                            pointerEvents={(showReference || isSolved || isExpired || isSpectator) ? 'none' : 'auto'}
                        >
                            <View
                                style={styles.puzzleGridFrame}
                                pointerEvents="none"
                            />
                            {piecesReady
                                && puzzleTexture
                                && pieces.length > 0
                                && pieces.length === gridDim * gridDim
                                && (
                                    <>
                                        <JigsawBoardCanvas
                                            image={puzzleTexture}
                                            pieces={pieces}
                                            geometry={piecePathCache}
                                            gridDim={gridDim}
                                            pieceSize={pieceSize}
                                            tabSize={tabSize}
                                            actualPuzzleSize={actualPuzzleSize}
                                            scaledImgW={scaledImgW}
                                            scaledImgH={scaledImgH}
                                            imgOffsetX={imgOffsetX}
                                            imgOffsetY={imgOffsetY}
                                            activeSourceSlot={draggingPiece?.currentIndex ?? -1}
                                            isSolved={isSolved}
                                            showCorrect={devShowCorrect || devJiggle}
                                        />
                                        {pieces.map((value, slotIndex) => {
                                            if (value < 0 || devShowCorrect || devJiggle) return null;
                                            const row = Math.floor(slotIndex / gridDim);
                                            const col = slotIndex % gridDim;
                                            return (
                                                <JigsawPieceGestureTarget
                                                    key={`board-hit-${slotIndex}-${value}`}
                                                    originalIndex={value}
                                                    sourceSlot={slotIndex}
                                                    isTray={false}
                                                    enabled={!showReference && !isSolved && !isExpired && !isSpectator}
                                                    style={{
                                                        left: col * pieceSize - tabSize,
                                                        top: row * pieceSize - tabSize,
                                                        width: pieceSize + 2 * tabSize,
                                                        height: pieceSize + 2 * tabSize,
                                                        zIndex: slotIndex + 1,
                                                    }}
                                                    dragX={dragX}
                                                    dragY={dragY}
                                                    dragOriginX={dragOriginX}
                                                    dragOriginY={dragOriginY}
                                                    onDragStart={handleDragStart}
                                                    onDragEnd={handleDragEnd}
                                                    onDragCancel={handleDragCancel}
                                                />
                                            );
                                        })}
                                    </>
                                )}
                        </View>

                        {/* Reference image overlay - shown on top during countdown */}
                        {showReference && puzzleContentReady && (
                            <Animated.View style={[
                                styles.referenceOverlay,
                                { opacity: referenceImageReady ? referenceOpacity : 0 },
                            ]}>
                                <Text style={styles.referencePreviewLabel}>
                                    {isSpectator
                                        ? translateUiText("Your puzzle preview 🧩")
                                        : translateUiText("Memorize this image 👀")}
                                </Text>
                                <View style={[styles.referenceImageWrapper, { width: actualPuzzleSize, height: actualPuzzleSize }]}>
                                    <Image
                                        source={{
                                            uri: puzzleTextureUri || puzzle.imageUrl,
                                            cache: 'force-cache',
                                        }}
                                        style={styles.referencePreviewImage}
                                        resizeMode="cover"
                                        fadeDuration={0}
                                        onLoad={() => setReferenceImageReady(true)}
                                    />
                                    {referenceImageReady && !isSpectator && (
                                        <View style={styles.countdownBadge}>
                                            <CountdownTimer duration={5} />
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.referencePreviewHint}>
                                    {isSpectator
                                        ? translateUiText("Puzzle waiting")
                                        : isStarting
                                            ? (usesFiveMinuteTimer
                                                ? translateUiText("Starting your timer...")
                                                : translateUiText("Building your puzzle"))
                                            : (usesFiveMinuteTimer
                                                ? translateUiText("You’ll have 5 minutes to solve it")
                                                : translateUiText("Take your time — there’s no time limit."))}
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
                                contentContainerStyle={styles.trayContentSkia}
                            >
                                <View
                                    style={{
                                        width: trayCanvasWidth,
                                        height: TRAY_PIECE_HEIGHT,
                                        flexDirection: 'row',
                                    }}
                                    collapsable={false}
                                >
                                    {trayChunks.map((chunk, chunkIndex) => (
                                        <View
                                            key={`tray-chunk-${chunkIndex}`}
                                            style={{
                                                width: getTrayContentWidth(
                                                    chunk.length,
                                                    TRAY_PIECE_HEIGHT
                                                ),
                                                height: TRAY_PIECE_HEIGHT,
                                                marginRight: chunkIndex < trayChunks.length - 1
                                                    ? TRAY_ITEM_GAP
                                                    : 0,
                                            }}
                                            collapsable={false}
                                        >
                                            <JigsawTrayCanvas
                                                image={puzzleTexture}
                                                pieceIndices={chunk}
                                                geometry={piecePathCache}
                                                activeOriginalIndex={draggingPiece?.originalIndex ?? -1}
                                                gridDim={gridDim}
                                                pieceSize={pieceSize}
                                                tabSize={tabSize}
                                                scaledImgW={scaledImgW}
                                                scaledImgH={scaledImgH}
                                                imgOffsetX={imgOffsetX}
                                                imgOffsetY={imgOffsetY}
                                                itemSize={TRAY_PIECE_HEIGHT}
                                            />
                                            {chunk.map((originalIndex, itemIndex) => (
                                                <JigsawPieceGestureTarget
                                                    key={`tray-hit-${originalIndex}`}
                                                    originalIndex={originalIndex}
                                                    sourceSlot={pieces.indexOf(-originalIndex - 1)}
                                                    isTray
                                                    enabled={!isExpired && !isSpectator}
                                                    style={{
                                                        left: itemIndex * (TRAY_PIECE_HEIGHT + TRAY_ITEM_GAP),
                                                        top: 0,
                                                        width: TRAY_PIECE_HEIGHT,
                                                        height: TRAY_PIECE_HEIGHT,
                                                        zIndex: itemIndex + 1,
                                                    }}
                                                    dragX={dragX}
                                                    dragY={dragY}
                                                    dragOriginX={dragOriginX}
                                                    dragOriginY={dragOriginY}
                                                    onDragStart={handleDragStart}
                                                    onDragEnd={handleDragEnd}
                                                    onDragCancel={handleDragCancel}
                                                />
                                            ))}
                                        </View>
                                    ))}
                                </View>
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
            {puzzleTexture && draggingPiece && (
                <JigsawDraggedPiece
                    image={puzzleTexture}
                    originalIndex={draggingPiece.originalIndex}
                    geometry={piecePathCache}
                    gridDim={gridDim}
                    pieceSize={pieceSize}
                    tabSize={tabSize}
                    imgOffsetX={imgOffsetX}
                    imgOffsetY={imgOffsetY}
                    scaledImgW={scaledImgW}
                    scaledImgH={scaledImgH}
                    dragX={dragX}
                    dragY={dragY}
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
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
        overflow: 'visible',
    },
    puzzleGridFrame: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.borderLight,
    },
    puzzleGridPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
        top: 0,
        zIndex: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.borderLight,
    },
    textureError: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    textureErrorText: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        lineHeight: 20,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.md,
    },
    textureRetryButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    textureRetryText: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        color: '#FFFFFF',
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
    trayContentSkia: {
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
    },
});

export default JigsawPuzzleScreen;
