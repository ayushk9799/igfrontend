import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    NativeModules,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSequence,
    withSpring,
} from 'react-native-reanimated';
import { createSafeAudioPlayer } from '../../utils/safeAudioPlayer';
import { translateUiText } from '../../i18n/uiTranslation';

// Global reference to the currently playing VoiceBubble stop callback
let currentActiveVoiceBubble = null;

/**
 * VoiceBubble - Premium audio player for voice messages in chat
 * Features animated waveform, smooth transitions, and polished UI
 */
const VoiceBubble = ({ audioUri, isSent = false, style, compact = false, accentColor: customAccentColor }) => {
    const audioPlayerRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState('0:00');
    const [duration, setDuration] = useState('0:00');
    const [progress, setProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Animation values
    const playButtonScale = useSharedValue(1);
    const progressAnim = useSharedValue(0);

    const stopSelf = useCallback(() => {
        try {
            audioPlayerRef.current?.stopPlayer().catch(() => {});
            audioPlayerRef.current?.removePlayBackListener();
        } catch (_) {}
        setIsPlaying(false);
        setIsPaused(false);
        setPlaybackPosition('0:00');
        setProgress(0);
        progressAnim.value = withTiming(0, { duration: 200 });
    }, [progressAnim]);

    // Initialize audio player
    useEffect(() => {
        audioPlayerRef.current = createSafeAudioPlayer();
        if (audioPlayerRef.current) {
            try {
                audioPlayerRef.current.setSubscriptionDuration(0.05); // 50ms updates for smooth progress
            } catch (error) {
                console.warn('[VoiceBubble] Failed to set subscription duration:', error);
            }
        }

        return () => {
            if (currentActiveVoiceBubble === stopSelf) {
                currentActiveVoiceBubble = null;
            }
            if (audioPlayerRef.current) {
                audioPlayerRef.current.stopPlayer().catch(() => {});
                audioPlayerRef.current.removePlayBackListener();
            }
        };
    }, [stopSelf]);

    // Stop playback when audioUri changes
    useEffect(() => {
        stopSelf();
    }, [audioUri, stopSelf]);

    const formatTime = useCallback((ms) => {
        if (!ms || isNaN(ms)) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    const startPlaybackFresh = async () => {
        // 1. If another voice bubble is currently active on screen, stop it first
        if (currentActiveVoiceBubble && currentActiveVoiceBubble !== stopSelf) {
            try { currentActiveVoiceBubble(); } catch (_) {}
        }
        currentActiveVoiceBubble = stopSelf;

        // 2. On Android, force release any lingering native MediaPlayer
        try {
            await NativeModules.RNAudioRecorderPlayer?.stopPlayer();
        } catch (_) {}

        setIsLoading(true);
        try {
            await audioPlayerRef.current.startPlayer(audioUri);
            audioPlayerRef.current.setVolume(1.0);
            setIsLoading(false);
            setIsPlaying(true);
            setIsPaused(false);

            audioPlayerRef.current.addPlayBackListener((e) => {
                const pos = formatTime(e.currentPosition);
                const dur = formatTime(e.duration);
                setPlaybackPosition(pos);
                setDuration(dur);
                const prog = e.duration > 0 ? Math.min(e.currentPosition / e.duration, 1) : 0;
                setProgress(prog);
                progressAnim.value = prog;

                if (e.currentPosition >= e.duration) {
                    audioPlayerRef.current?.stopPlayer().catch(() => {});
                    audioPlayerRef.current?.removePlayBackListener();
                    setIsPlaying(false);
                    setIsPaused(false);
                    if (currentActiveVoiceBubble === stopSelf) {
                        currentActiveVoiceBubble = null;
                    }
                    setPlaybackPosition('0:00');
                    setProgress(0);
                    progressAnim.value = withTiming(0, { duration: 300 });
                }
            });
        } catch (err) {
            // If Android rejected with "Player is already running", force stop native player and retry once
            if (String(err?.message || err).toLowerCase().includes('already running')) {
                try {
                    await NativeModules.RNAudioRecorderPlayer?.stopPlayer();
                    await audioPlayerRef.current.startPlayer(audioUri);
                    audioPlayerRef.current.setVolume(1.0);
                    setIsLoading(false);
                    setIsPlaying(true);
                    setIsPaused(false);
                    return;
                } catch (retryErr) {
                    console.error('[VoiceBubble] Retry playback error:', retryErr);
                }
            }
            throw err;
        }
    };

    const handlePlayPause = async () => {
        if (!audioUri || !audioPlayerRef.current) return;

        // Button press animation
        playButtonScale.value = withSequence(
            withSpring(0.85, { damping: 10 }),
            withSpring(1, { damping: 8 })
        );

        try {
            if (isPlaying) {
                // Currently playing -> pause
                await audioPlayerRef.current.pausePlayer();
                setIsPlaying(false);
                setIsPaused(true);
            } else if (isPaused) {
                // Paused -> try to resume
                try {
                    await audioPlayerRef.current.resumePlayer();
                    setIsPlaying(true);
                    setIsPaused(false);
                } catch (resumeErr) {
                    // Resume failed (e.g. native player state was lost) -> start fresh
                    await startPlaybackFresh();
                }
            } else {
                // Not playing and not paused -> start fresh
                await startPlaybackFresh();
            }
        } catch (error) {
            console.error('[VoiceBubble] Playback error:', error);
            setIsPlaying(false);
            setIsPaused(false);
            setIsLoading(false);
        }
    };

    // Animated styles
    const playButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: playButtonScale.value }],
    }));

    // Waveform pattern - 20 bars for smooth full-width progress
    const waveformHeights = [
        0.35, 0.55, 0.75, 0.5, 0.85, 0.65, 0.45, 0.9, 0.6, 0.8,
        0.5, 0.7, 0.4, 0.65, 0.85, 0.55, 0.75, 0.9, 0.6, 0.4
    ];

    const accentColor = customAccentColor || (isSent ? '#6366F1' : '#EC4899');
    const inactiveColor = customAccentColor
        ? (customAccentColor + '35')
        : (isSent ? 'rgba(99, 102, 241, 0.3)' : 'rgba(236, 72, 153, 0.3)');

    // Clean progress-driven waveform bar
    const AnimatedBar = ({ index, totalBars, baseHeight }) => {
        const animatedStyle = useAnimatedStyle(() => {
            const barThreshold = index / totalBars;
            const isPlayed = progressAnim.value >= barThreshold;

            return {
                height: baseHeight,
                backgroundColor: isPlayed ? accentColor : inactiveColor,
            };
        });

        return (
            <Animated.View
                style={[styles.waveformBar, animatedStyle]}
            />
        );
    };

    return (
        <View style={[styles.container, compact && styles.containerCompact, style]}>
            {/* Play/Pause Button */}
            <Animated.View style={playButtonAnimatedStyle}>
                <TouchableOpacity
                    onPress={handlePlayPause}
                    style={[
                        styles.playButton,
                        compact && styles.playButtonCompact,
                        { backgroundColor: accentColor },
                        isPlaying && styles.playButtonActive
                    ]}
                    activeOpacity={0.85}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <View style={styles.loadingDots}>
                            <View style={[styles.loadingDot, { opacity: 0.4 }]} />
                            <View style={[styles.loadingDot, { opacity: 0.7 }]} />
                            <View style={[styles.loadingDot, { opacity: 1 }]} />
                        </View>
                    ) : (
                        <Svg width={compact ? 12 : 16} height={compact ? 12 : 16} viewBox="0 0 24 24" fill="none">
                            {isPlaying ? (
                                <>
                                    <Path d="M6 4h4v16H6V4z" fill="#FFFFFF" />
                                    <Path d="M14 4h4v16h-4V4z" fill="#FFFFFF" />
                                </>
                            ) : (
                                <Path d="M8 5v14l11-7L8 5z" fill="#FFFFFF" />
                            )}
                        </Svg>
                    )}
                </TouchableOpacity>
            </Animated.View>

            {/* Waveform and Duration */}
            <View style={styles.waveformSection}>
                <View style={[styles.waveformContainer, compact && styles.waveformContainerCompact]}>
                    {waveformHeights.map((height, idx) => (
                        <AnimatedBar
                            key={idx}
                            index={idx}
                            totalBars={waveformHeights.length}
                            baseHeight={compact ? 15 * height : 22 * height}
                        />
                    ))}
                </View>

                {/* Timing info: Realtime elapsed when playing, Total duration when stopped/paused */}
                <View style={styles.timeRow}>
                    <Text style={[styles.durationText, compact && styles.durationTextCompact, { color: accentColor }]}>
                        {isPlaying ? playbackPosition : (duration !== '0:00' ? duration : '0:00')}
                    </Text>
                </View>
            </View>

            {/* Voice message badge */}
            {!compact && (
                <View style={[styles.voiceBadge, { backgroundColor: accentColor + '15' }]}>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                        <Path
                            d="M12 1a4 4 0 00-4 4v6a4 4 0 008 0V5a4 4 0 00-4-4z"
                            fill={accentColor}
                        />
                        <Path
                            d="M19 10v1a7 7 0 01-14 0v-1M12 18.5V23M8 23h8"
                            stroke={accentColor}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
        maxWidth: '100%',
        paddingVertical: 4,
    },
    containerCompact: {
        gap: 8,
        paddingVertical: 1,
    },
    playButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 0,
    },
    playButtonCompact: {
        width: 30,
        height: 30,
        borderRadius: 15,
    },
    playButtonActive: {
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    loadingDots: {
        flexDirection: 'row',
        gap: 3,
    },
    loadingDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFFFFF',
    },
    waveformSection: {
        flex: 1,
        minWidth: 0,
        gap: 4,
    },
    waveformContainer: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 28,
        overflow: 'hidden',
    },
    waveformContainerCompact: {
        height: 18,
    },
    waveformBar: {
        width: 3,
        borderRadius: 2,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    durationText: {
        fontSize: 12,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    durationTextCompact: {
        fontSize: 10,
    },
    nowPlayingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    nowPlayingDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    nowPlayingText: {
        fontSize: 10,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    voiceBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
});

export default VoiceBubble;
