// Letter tab — the 3D "Letter Bird" animation, rendered natively with three.js on an expo-gl surface.
//
// Performance notes
// - Mesh + textures are decoded once (Skia) and cached in memory; re-opening the tab only rebuilds GL.
// - The GL surface renders at ~2x density (1.75x on Android) and is scaled up, instead of the full 3x
//   of modern phones: ~55% fewer pixels to shade, visually identical at this content.
// - The render loop stops completely while paused, when the app is backgrounded and when the tab unmounts.
// - Progress bar is driven by a Reanimated shared value (no React re-render per frame); React state only
//   changes when the story step changes.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    ActivityIndicator,
    AppState,
    PixelRatio,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
    FadeInDown,
    FadeOutUp,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pause, Play, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { fontFamily, fontWeight } from '../constants/fonts';
import { translateUiText } from '../i18n/uiTranslation';
import { getCachedLetterBirdAssets, loadLetterBirdAssets } from '../features/letterBird/letterBirdAssets';
import {
    createLetterBirdScene,
    LETTER_BIRD_END,
    LETTER_BIRD_STEPS,
    stepIndexAt,
} from '../features/letterBird/letterBirdScene';

const TARGET_DENSITY = Platform.OS === 'ios' ? 2 : 1.75;
const RENDER_SCALE = Math.min(1, TARGET_DENSITY / PixelRatio.get());
const SPEEDS = [1, 0.5, 0.25];
const HEADER_HEIGHT = 92;          // title + step caption
const CONTROLS_HEIGHT = 56;
const TAB_BAR_SPACE = 76;          // floating tab bar + gap

// three.js asks for a few WebGL-only pixelStorei flags that expo-gl does not implement (and logs about).
const IGNORED_PIXEL_STORE = new Set([0x9240, 0x9241, 0x9243]);

const nowMs = () => (global.performance?.now ? global.performance.now() : Date.now());
const tap = () => { Haptics.selectionAsync().catch(() => {}); };

export default function LetterScreen() {
    const insets = useSafeAreaInsets();
    const [assets, setAssets] = useState(getCachedLetterBirdAssets);
    const [error, setError] = useState(null);
    const [size, setSize] = useState(null);
    const [ready, setReady] = useState(false);
    const [playing, setPlaying] = useState(true);
    const [speedIndex, setSpeedIndex] = useState(0);
    const [stepIndex, setStepIndex] = useState(0);
    const [trackWidth, setTrackWidth] = useState(0);

    const engine = useRef(null);       // { gl, renderer, api, raf, last }
    const timeRef = useRef(0);
    const playingRef = useRef(true);
    const speedRef = useRef(1);
    const appActiveRef = useRef(AppState.currentState === 'active');
    const stepRef = useRef(0);

    const progress = useSharedValue(0);
    const reveal = useSharedValue(0);

    const bottomOffset = (Platform.OS === 'android'
        ? Math.max(insets.bottom, 12)
        : (insets.bottom > 0 ? Math.max(insets.bottom - 18, 12) : 12)) + TAB_BAR_SPACE;
    const chromeTop = insets.top + HEADER_HEIGHT;
    const chromeBottom = bottomOffset + CONTROLS_HEIGHT + 8;

    // ------------------------------------------------------------ assets
    useEffect(() => {
        if (assets) return undefined;
        let alive = true;
        loadLetterBirdAssets()
            .then((a) => { if (alive) setAssets(a); })
            .catch((e) => { console.warn('[LetterScreen] failed to load assets', e); if (alive) setError(e); });
        return () => { alive = false; };
    }, [assets]);

    // ------------------------------------------------------------ drawing + loop
    const drawAt = useCallback((t) => {
        const e = engine.current;
        if (!e) return;
        e.api.update(t);
        e.renderer.render(e.api.scene, e.api.camera);
        e.gl.endFrameEXP();
        progress.value = t / LETTER_BIRD_END;
        const idx = stepIndexAt(t);
        if (idx !== stepRef.current) {
            stepRef.current = idx;
            setStepIndex(idx);
        }
    }, [progress]);

    const frame = useCallback(() => {
        const e = engine.current;
        if (!e || !e.running) return;
        const now = nowMs();
        const dt = Math.min(0.05, (now - e.last) / 1000);
        e.last = now;
        timeRef.current = (timeRef.current + dt * speedRef.current) % LETTER_BIRD_END;
        drawAt(timeRef.current);
        e.raf = requestAnimationFrame(frame);
    }, [drawAt]);

    const syncLoop = useCallback(() => {
        const e = engine.current;
        if (!e) return;
        const shouldRun = playingRef.current && appActiveRef.current;
        if (shouldRun && !e.running) {
            e.running = true;
            e.last = nowMs();
            e.raf = requestAnimationFrame(frame);
        } else if (!shouldRun && e.running) {
            e.running = false;
            if (e.raf != null) cancelAnimationFrame(e.raf);
            e.raf = null;
        }
    }, [frame]);

    const onContextCreate = useCallback((gl) => {
        if (!assets || !size) return;
        const previous = engine.current;   // surface re-created after a size change
        if (previous) {
            previous.running = false;
            if (previous.raf != null) cancelAnimationFrame(previous.raf);
            previous.api.dispose();
            previous.renderer.dispose();
            engine.current = null;
        }
        const nativePixelStorei = gl.pixelStorei.bind(gl);
        gl.pixelStorei = (pname, value) => {
            if (!IGNORED_PIXEL_STORE.has(pname)) nativePixelStorei(pname, value);
        };

        const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
        const canvas = {
            width: W, height: H, clientWidth: W, clientHeight: H, style: {},
            addEventListener: () => {}, removeEventListener: () => {}, getContext: () => gl,
        };
        const renderer = new THREE.WebGLRenderer({
            canvas, context: gl, antialias: false, alpha: false, stencil: false,
            powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(1);
        renderer.setSize(W, H, false);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const api = createLetterBirdScene(assets);
        const k = H / size.height;   // points -> drawing-buffer pixels
        api.setViewport(W, H, chromeTop * k, chromeBottom * k);

        engine.current = { gl, renderer, api, raf: null, last: 0, running: false };
        // first frame compiles every shader; do it while the surface is still hidden
        renderer.compile(api.scene, api.camera);
        drawAt(timeRef.current);
        setReady(true);
        reveal.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) });
        syncLoop();
    }, [assets, size, chromeTop, chromeBottom, drawAt, reveal, syncLoop]);

    // tear down on unmount
    useEffect(() => () => {
        const e = engine.current;
        engine.current = null;
        if (!e) return;
        e.running = false;
        if (e.raf != null) cancelAnimationFrame(e.raf);
        e.api.dispose();
        e.renderer.dispose();
    }, []);

    // pause while the app is in the background
    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            appActiveRef.current = state === 'active';
            syncLoop();
        });
        return () => sub.remove();
    }, [syncLoop]);

    // respect Reduce Motion: start paused on the "picks it up" moment
    useEffect(() => {
        AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
            if (!reduce) return;
            playingRef.current = false;
            setPlaying(false);
            timeRef.current = 3.6;
            syncLoop();
            drawAt(3.6);
        }).catch(() => {});
    }, [drawAt, syncLoop]);

    // ------------------------------------------------------------ controls
    const togglePlay = useCallback(() => {
        tap();
        const next = !playingRef.current;
        playingRef.current = next;
        setPlaying(next);
        syncLoop();
    }, [syncLoop]);

    const seek = useCallback((t) => {
        timeRef.current = Math.max(0, Math.min(LETTER_BIRD_END - 0.001, t));
        if (!engine.current?.running) drawAt(timeRef.current);
    }, [drawAt]);

    const replay = useCallback(() => {
        tap();
        seek(0);
        if (!playingRef.current) {
            playingRef.current = true;
            setPlaying(true);
            syncLoop();
        }
    }, [seek, syncLoop]);

    const cycleSpeed = useCallback(() => {
        tap();
        setSpeedIndex((i) => {
            const next = (i + 1) % SPEEDS.length;
            speedRef.current = SPEEDS[next];
            return next;
        });
    }, []);

    const onTrackPress = useCallback((evt) => {
        if (!trackWidth) return;
        tap();
        seek((evt.nativeEvent.locationX / trackWidth) * LETTER_BIRD_END);
    }, [seek, trackWidth]);

    // ------------------------------------------------------------ styles driven on the UI thread
    const progressStyle = useAnimatedStyle(() => ({ width: `${Math.min(100, progress.value * 100)}%` }));
    const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));
    const placeholderStyle = useAnimatedStyle(() => ({ opacity: 1 - reveal.value }));

    const glFrame = useMemo(() => {
        if (!size) return null;
        const w = Math.round(size.width * RENDER_SCALE), h = Math.round(size.height * RENDER_SCALE);
        return {
            position: 'absolute', width: w, height: h,
            left: (size.width - w) / 2, top: (size.height - h) / 2,
            transform: [{ scale: 1 / RENDER_SCALE }],
        };
    }, [size]);

    const onLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
            ? prev : { width, height }));
    }, []);

    const stepLabel = LETTER_BIRD_STEPS[stepIndex][1];
    const glKey = size ? `${Math.round(size.width)}x${Math.round(size.height)}` : 'none';

    return (
        <View style={styles.container} onLayout={onLayout}>
            {/* sky placeholder while loading (same colours as the scene) */}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, placeholderStyle]}>
                <LinearGradient colors={['#DCEBFF', '#FFF6EA']} locations={[0, 0.78]} style={StyleSheet.absoluteFill} />
                <View style={styles.loading}>
                    {error ? (
                        <Text style={styles.loadingText}>{translateUiText("Couldn't load the letter. Please reopen this tab.")}</Text>
                    ) : (
                        <>
                            <ActivityIndicator color="#2D6EE6" />
                            <Text style={styles.loadingText}>{translateUiText('A little bird is on its way…')}</Text>
                        </>
                    )}
                </View>
            </Animated.View>

            {assets && size ? (
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, revealStyle]}>
                    <GLView key={glKey} style={glFrame} msaaSamples={4} onContextCreate={onContextCreate} />
                </Animated.View>
            ) : null}

            {/* header */}
            <View pointerEvents="none" style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <Text style={styles.title}>{translateUiText('Letter')}</Text>
                <View style={styles.captionRow}>
                    {ready ? (
                        <Animated.View
                            key={stepIndex}
                            entering={FadeInDown.duration(260)}
                            exiting={FadeOutUp.duration(180)}
                            style={styles.caption}
                        >
                            <Text style={styles.captionNum}>{stepIndex + 1}</Text>
                            <Text style={styles.captionText}>{translateUiText(stepLabel)}</Text>
                        </Animated.View>
                    ) : null}
                </View>
            </View>

            {/* controls */}
            <View style={[styles.controls, { bottom: bottomOffset }]} pointerEvents={ready ? 'auto' : 'none'}>
                <Pressable
                    onPress={togglePlay}
                    style={({ pressed }) => [styles.roundBtn, styles.playBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText(playing ? 'Pause' : 'Play')}
                    hitSlop={6}
                >
                    {playing ? <Pause size={18} color="#FFFFFF" fill="#FFFFFF" /> : <Play size={18} color="#FFFFFF" fill="#FFFFFF" />}
                </Pressable>

                <Pressable
                    style={styles.trackHit}
                    onPress={onTrackPress}
                    onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
                    accessibilityRole="adjustable"
                    accessibilityLabel={translateUiText('Animation timeline')}
                >
                    <View style={styles.track}>
                        <Animated.View style={[styles.trackFill, progressStyle]} />
                    </View>
                    {LETTER_BIRD_STEPS.map(([at], i) => (
                        <View
                            key={at}
                            pointerEvents="none"
                            style={[
                                styles.tick,
                                { left: `${(at / LETTER_BIRD_END) * 100}%` },
                                i <= stepIndex && styles.tickOn,
                            ]}
                        />
                    ))}
                </Pressable>

                <Pressable
                    onPress={cycleSpeed}
                    style={({ pressed }) => [styles.pillBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText('Playback speed')}
                    hitSlop={6}
                >
                    <Text style={styles.pillText}>{`${SPEEDS[speedIndex]}×`}</Text>
                </Pressable>

                <Pressable
                    onPress={replay}
                    style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText('Replay')}
                    hitSlop={6}
                >
                    <RotateCcw size={18} color="#26304A" />
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#EEF3FB',
        overflow: 'hidden',
    },
    loading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 32,
    },
    loadingText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        fontSize: 14,
        color: '#5A6584',
        textAlign: 'center',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: 26,
        fontWeight: fontWeight('800'),
        color: '#202B5E',
        letterSpacing: -0.5,
    },
    captionRow: {
        height: 36,
        marginTop: 8,
        flexDirection: 'row',
    },
    caption: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 8,
        paddingLeft: 5,
        paddingRight: 12,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.78)',
        shadowColor: '#1E326E',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    captionNum: {
        width: 22,
        height: 22,
        borderRadius: 11,
        overflow: 'hidden',
        textAlign: 'center',
        lineHeight: 22,
        fontSize: 12,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#FFFFFF',
        backgroundColor: '#2D6EE6',
    },
    captionText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        fontSize: 14,
        color: '#26304A',
    },
    controls: {
        position: 'absolute',
        left: 18,
        right: 18,
        height: CONTROLS_HEIGHT,
        borderRadius: CONTROLS_HEIGHT / 2,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(255,255,255,0.86)',
        shadowColor: '#1E326E',
        shadowOpacity: 0.1,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
    },
    roundBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E2E7F2',
    },
    playBtn: {
        backgroundColor: '#2D6EE6',
    },
    pillBtn: {
        height: 32,
        minWidth: 46,
        paddingHorizontal: 10,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E2E7F2',
    },
    pillText: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 13,
        color: '#26304A',
        fontVariant: ['tabular-nums'],
    },
    pressed: {
        opacity: 0.75,
        transform: [{ scale: 0.95 }],
    },
    trackHit: {
        flex: 1,
        height: 40,
        justifyContent: 'center',
    },
    track: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D9DEEA',
        overflow: 'hidden',
    },
    trackFill: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#2D6EE6',
    },
    tick: {
        position: 'absolute',
        top: 17,
        width: 6,
        height: 6,
        marginLeft: -3,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#C3CADB',
    },
    tickOn: {
        borderColor: '#2D6EE6',
    },
});
