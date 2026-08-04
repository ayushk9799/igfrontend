import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    withSpring,
    cancelAnimation,
    interpolate,
    Extrapolation,
} from 'react-native-reanimated';
import { createSafeAudioPlayer } from '../../utils/safeAudioPlayer';
import { translateUiText } from '../../i18n/uiTranslation';

/**
 * VoiceBubble - Premium audio player for voice messages in chat
 * Features animated waveform, smooth transitions, and polished UI
 */
const VoiceBubble = ({ audioUri, isSent = false }) => {
    const audioPlayerRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState('0:00');
    const [duration, setDuration] = useState('0:00');
    const [progress, setProgress] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Animation values
    const playButtonScale = useSharedValue(1);
    const waveformOpacity = useSharedValue(0.4);
    const progressAnim = useSharedValue(0);

    // Hooks must be invoked deterministically; keep the stable collection in a ref.
    const bar0 = useSharedValue(1);
    const bar1 = useSharedValue(1);
    const bar2 = useSharedValue(1);
    const bar3 = useSharedValue(1);
    const bar4 = useSharedValue(1);
    const bar5 = useSharedValue(1);
    const bar6 = useSharedValue(1);
    const bar7 = useSharedValue(1);
    const bar8 = useSharedValue(1);
    const bar9 = useSharedValue(1);
    const bar10 = useSharedValue(1);
    const bar11 = useSharedValue(1);
    const bar12 = useSharedValue(1);
    const bar13 = useSharedValue(1);
    const bar14 = useSharedValue(1);
    const bar15 = useSharedValue(1);
    const barAnimations = useRef([
        bar0, bar1, bar2, bar3, bar4, bar5, bar6, bar7,
        bar8, bar9, bar10, bar11, bar12, bar13, bar14, bar15,
    ]).current;

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
            if (audioPlayerRef.current) {
                audioPlayerRef.current.stopPlayer().catch(() => { });
                audioPlayerRef.current.removePlayBackListener();
            }
            // Cancel all animations
            barAnimations.forEach(anim => cancelAnimation(anim));
        };
    }, [barAnimations]);

    // Stop playback when audioUri changes
    useEffect(() => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.stopPlayer().catch(() => { });
            audioPlayerRef.current.removePlayBackListener();
            setIsPlaying(false);
            setPlaybackPosition('0:00');
            setProgress(0);
            progressAnim.value = 0;
        }
    }, [audioUri, progressAnim]);

    // Animate waveform bars when playing
    useEffect(() => {
        const timers = [];
        if (isPlaying) {
            waveformOpacity.value = withTiming(1, { duration: 200 });
            // Animate each bar with different timing for organic feel
            barAnimations.forEach((anim, index) => {
                const delay = index * 30;
                const timer = setTimeout(() => {
                    anim.value = withRepeat(
                        withSequence(
                            withTiming(1.3, { duration: 200 + Math.random() * 100 }),
                            withTiming(0.7, { duration: 200 + Math.random() * 100 }),
                            withTiming(1, { duration: 150 })
                        ),
                        -1,
                        true
                    );
                }, delay);
                timers.push(timer);
            });
        } else {
            waveformOpacity.value = withTiming(0.5, { duration: 300 });
            barAnimations.forEach(anim => {
                cancelAnimation(anim);
                anim.value = withSpring(1, { damping: 15 });
            });
        }
        return () => timers.forEach(clearTimeout);
    }, [barAnimations, isPlaying, waveformOpacity]);

    const formatTime = useCallback((ms) => {
        if (!ms || isNaN(ms)) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, []);

    const handlePlayPause = async () => {
        if (!audioUri || !audioPlayerRef.current) return;

        // Button press animation
        playButtonScale.value = withSequence(
            withSpring(0.85, { damping: 10 }),
            withSpring(1, { damping: 8 })
        );

        try {
            if (isPlaying) {
                await audioPlayerRef.current.pausePlayer();
                setIsPlaying(false);
            } else {
                setIsLoading(true);

                await audioPlayerRef.current.startPlayer(audioUri);
                audioPlayerRef.current.setVolume(1.0);
                setIsLoading(false);

                audioPlayerRef.current.addPlayBackListener((e) => {
                    const pos = formatTime(e.currentPosition);
                    const dur = formatTime(e.duration);
                    setPlaybackPosition(pos);
                    setDuration(dur);
                    const prog = e.duration > 0 ? e.currentPosition / e.duration : 0;
                    setProgress(prog);
                    progressAnim.value = prog;

                    if (e.currentPosition >= e.duration) {
                        audioPlayerRef.current.stopPlayer();
                        audioPlayerRef.current.removePlayBackListener();
                        setIsPlaying(false);
                        setPlaybackPosition('0:00');
                        setProgress(0);
                        progressAnim.value = withTiming(0, { duration: 300 });
                    }
                });

                setIsPlaying(true);
            }
        } catch (error) {
            console.error('[VoiceBubble] Playback error:', error);
            setIsPlaying(false);
            setIsLoading(false);
        }
    };

    // Animated styles
    const playButtonAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: playButtonScale.value }],
    }));

    // Waveform pattern - more bars for smoother look
    const waveformHeights = [0.35, 0.55, 0.75, 0.5, 0.85, 0.65, 0.45, 0.9, 0.6, 0.8, 0.5, 0.7, 0.4, 0.65, 0.55, 0.45];

    // Create animated bar components
    const AnimatedBar = ({ index, baseHeight }) => {
        const animatedStyle = useAnimatedStyle(() => {
            const barProgress = (index + 1) / waveformHeights.length;
            const isActive = progressAnim.value >= barProgress;

            return {
                height: baseHeight * barAnimations[index].value,
                backgroundColor: isActive
                    ? (isSent ? 'rgba(99, 102, 241, 0.9)' : 'rgba(236, 72, 153, 0.9)')
                    : (isSent ? 'rgba(99, 102, 241, 0.35)' : 'rgba(236, 72, 153, 0.35)'),
                opacity: interpolate(
                    waveformOpacity.value,
                    [0.4, 1],
                    [0.6, 1],
                    Extrapolation.CLAMP
                ),
            };
        });

        return (
            <Animated.View
                style={[styles.waveformBar, animatedStyle]}
            />
        );
    };

    const accentColor = isSent ? '#6366F1' : '#EC4899';

    return (
        <View style={styles.container}>
            {/* Play/Pause Button */}
            <Animated.View style={playButtonAnimatedStyle}>
                <TouchableOpacity
                    onPress={handlePlayPause}
                    style={[
                        styles.playButton,
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
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
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
                <View style={styles.waveformContainer}>
                    {waveformHeights.map((height, idx) => (
                        <AnimatedBar
                            key={idx}
                            index={idx}
                            baseHeight={22 * height}
                        />
                    ))}
                </View>

                {/* Duration and progress info */}
                <View style={styles.timeRow}>
                    <Text style={[styles.durationText, { color: accentColor }]}>
                        {isPlaying ? playbackPosition : (duration !== '0:00' ? duration : '0:00')}
                    </Text>
                    {isPlaying && (
                        <View style={styles.nowPlayingIndicator}>
                            <View style={[styles.nowPlayingDot, { backgroundColor: accentColor }]} />
                            <Text style={[styles.nowPlayingText, { color: accentColor }]}>{translateUiText("Playing")}</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Voice message badge */}
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minWidth: 200,
        paddingVertical: 4,
    },
    playButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 0,
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
        gap: 6,
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2.5,
        height: 28,
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
    },
});

export default VoiceBubble;
