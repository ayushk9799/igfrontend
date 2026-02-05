import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Platform,
    PermissionsAndroid,
    Alert,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    cancelAnimation,
} from 'react-native-reanimated';

import { categoryConfig } from './categoryConfig';
import { cardStyles as styles } from './cardStyles';
import { colors, spacing } from '../../theme';
import { uploadAudioToS3 } from '../../utils/uploadApi';

/**
 * VoiceRecordCard - Card for recording voice messages
 * Uses react-native-audio-recorder-player v3.6.0 (non-Expo)
 */
const VoiceRecordCard = React.memo(({
    task,
    index,
    totalCards,
    partnerName,
    userName,
    onSubmit,
    onSkip,
    isLastCard,
    onAnswerSubmit,
    isAnswered = false,
    previousAnswer = null
}) => {
    const config = categoryConfig.voicerecord;
    const lastTaskIdRef = useRef(task._id);

    // Create audio recorder player instance
    const audioRecorderPlayerRef = useRef(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);

    // Initialize the audio recorder player on mount
    useEffect(() => {
        try {
            console.log('🎙️ [VoiceRecordCard] Initializing AudioRecorderPlayer...');
            const player = new AudioRecorderPlayer();
            console.log('🎙️ [VoiceRecordCard] AudioRecorderPlayer instance:', player);
            console.log('🎙️ [VoiceRecordCard] startRecorder method:', typeof player?.startRecorder);
            audioRecorderPlayerRef.current = player;
            setIsPlayerReady(true);
        } catch (error) {
            console.error('🎙️ [VoiceRecordCard] Failed to initialize AudioRecorderPlayer:', error);
        }

        return () => {
            if (audioRecorderPlayerRef.current) {
                audioRecorderPlayerRef.current.stopRecorder().catch(() => { });
                audioRecorderPlayerRef.current.stopPlayer().catch(() => { });
                audioRecorderPlayerRef.current.removeRecordBackListener();
                audioRecorderPlayerRef.current.removePlayBackListener();
            }
        };
    }, []);

    const [hasPermission, setHasPermission] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingUri, setRecordingUri] = useState(null);
    const [recordingDuration, setRecordingDuration] = useState('00:00');
    const [recordingDurationMs, setRecordingDurationMs] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState('00:00');

    // Animation for pulsing mic when recording
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.6);

    useEffect(() => {
        // Reset state only when task ID changes
        if (lastTaskIdRef.current !== task._id) {
            lastTaskIdRef.current = task._id;
            setRecordingUri(isAnswered ? previousAnswer : null);
            setRecordingDuration('00:00');
            setRecordingDurationMs(0);
            setIsRecording(false);
            setIsPlaying(false);
        }
    }, [task._id, isAnswered, previousAnswer]);

    useEffect(() => {
        requestPermissions();
        return () => {
            // Cleanup on unmount
            cleanupRecording();
            cleanupPlayback();
        };
    }, []);

    useEffect(() => {
        if (isRecording) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.2, { duration: 500 }),
                    withTiming(1, { duration: 500 })
                ),
                -1,
                true
            );
            pulseOpacity.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 500 }),
                    withTiming(0.6, { duration: 500 })
                ),
                -1,
                true
            );
        } else {
            cancelAnimation(pulseScale);
            cancelAnimation(pulseOpacity);
            pulseScale.value = withTiming(1, { duration: 200 });
            pulseOpacity.value = withTiming(0.6, { duration: 200 });
        }
    }, [isRecording]);

    const pulseAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    const requestPermissions = async () => {
        try {
            if (Platform.OS === 'android') {
                const grants = await PermissionsAndroid.requestMultiple([
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                ]);
                const granted =
                    grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED;
                setHasPermission(granted);
            } else {
                // iOS handles permissions automatically when recording starts
                setHasPermission(true);
            }
        } catch (e) {
            console.error('Permission error:', e);
            setHasPermission(false);
        }
    };

    const cleanupRecording = async () => {
        try {
            if (audioRecorderPlayerRef.current) {
                await audioRecorderPlayerRef.current.stopRecorder();
                audioRecorderPlayerRef.current.removeRecordBackListener();
            }
        } catch (e) { /* ignore */ }
    };

    const cleanupPlayback = async () => {
        try {
            if (audioRecorderPlayerRef.current) {
                await audioRecorderPlayerRef.current.stopPlayer();
                audioRecorderPlayerRef.current.removePlayBackListener();
            }
        } catch (e) { /* ignore */ }
    };

    const handleToggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            await handleStopRecording();
        } else {
            // Start recording
            if (!hasPermission) {
                Alert.alert('Permission Required', 'Please allow microphone access to record voice messages.');
                requestPermissions();
                return;
            }

            try {
                await cleanupPlayback();
                await cleanupRecording();

                console.log('🎙️ [VoiceRecordCard] Starting recording...');

                if (!audioRecorderPlayerRef.current) {
                    console.error('AudioRecorderPlayer not initialized');
                    return;
                }

                // Set audio mode for recording
                audioRecorderPlayerRef.current.setSubscriptionDuration(0.1); // Update every 100ms

                const path = Platform.select({
                    ios: `voice_${Date.now()}.m4a`,
                    android: `sdcard/voice_${Date.now()}.mp4`,
                });

                const uri = await audioRecorderPlayerRef.current.startRecorder(path);
                console.log('🎙️ [VoiceRecordCard] Recording to:', uri);

                audioRecorderPlayerRef.current.addRecordBackListener((e) => {
                    const duration = audioRecorderPlayerRef.current.mmssss(Math.floor(e.currentPosition));
                    setRecordingDuration(duration.slice(0, 5)); // MM:SS format
                    setRecordingDurationMs(e.currentPosition);
                });

                setIsRecording(true);
                setRecordingUri(null);
            } catch (error) {
                console.error('Failed to start recording:', error);
                Alert.alert('Error', 'Failed to start recording. Please try again.');
            }
        }
    };

    const handleStopRecording = async () => {
        if (!isRecording) return;

        try {
            console.log('🎙️ [VoiceRecordCard] Stopping recording...');
            if (!audioRecorderPlayerRef.current) return;
            const uri = await audioRecorderPlayerRef.current.stopRecorder();
            audioRecorderPlayerRef.current.removeRecordBackListener();

            setIsRecording(false);
            if (uri) {
                setRecordingUri(uri);
                console.log('🎙️ [VoiceRecordCard] Recording saved:', uri);
            }
        } catch (error) {
            console.error('Failed to stop recording:', error);
            setIsRecording(false);
        }
    };

    const handlePlayPause = async () => {
        if (!recordingUri) return;

        try {
            if (!audioRecorderPlayerRef.current) return;

            if (isPlaying) {
                await audioRecorderPlayerRef.current.pausePlayer();
                setIsPlaying(false);
            } else {
                console.log('▶️ [VoiceRecordCard] Playing:', recordingUri);

                await audioRecorderPlayerRef.current.startPlayer(recordingUri);
                audioRecorderPlayerRef.current.setVolume(1.0);

                audioRecorderPlayerRef.current.addPlayBackListener((e) => {
                    const position = audioRecorderPlayerRef.current.mmssss(Math.floor(e.currentPosition));
                    setPlaybackPosition(position.slice(0, 5));

                    if (e.currentPosition >= e.duration) {
                        audioRecorderPlayerRef.current.stopPlayer();
                        audioRecorderPlayerRef.current.removePlayBackListener();
                        setIsPlaying(false);
                        setPlaybackPosition('00:00');
                    }
                });

                setIsPlaying(true);
            }
        } catch (error) {
            console.error('Playback error:', error);
            setIsPlaying(false);
        }
    };

    const handleDiscard = async () => {
        await cleanupPlayback();
        setRecordingUri(null);
        setRecordingDuration('00:00');
        setRecordingDurationMs(0);
        setPlaybackPosition('00:00');
    };

    const handleSubmit = async () => {
        if (!recordingUri || isSubmitting) return;

        setIsSubmitting(true);
        console.log('🎙️ [VoiceRecordCard] Uploading voice recording...');

        try {
            const s3Url = await uploadAudioToS3(recordingUri, 'voice-recordings');
            console.log('🎙️ [VoiceRecordCard] Upload complete:', s3Url);

            await onAnswerSubmit(index, s3Url, 'voice');
            onSubmit(s3Url);
        } catch (error) {
            console.error('🎙️ [VoiceRecordCard] Upload failed:', error);
            Alert.alert('Upload Failed', 'Could not upload voice recording. Please try again.');
            setIsSubmitting(false);
        }
    };

    return (
        <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
            {/* Already Answered Overlay */}
            {isAnswered && (
                <View style={styles.answeredOverlay}>
                    <View style={styles.answeredBadge}>
                        <Text style={styles.answeredEmoji}>🎙️</Text>
                        <Text style={styles.answeredTitle}>Voice Message Sent</Text>
                        <Text style={styles.answeredHint}>Swipe to continue →</Text>
                    </View>
                </View>
            )}

            <View style={[styles.cardContent, isAnswered && { opacity: 0.3 }]}>
                {/* Header */}
                <View style={styles.topRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
                        <Text style={styles.categoryText}>{config.label}</Text>
                    </View>
                    <Text style={[styles.counterText, { color: 'white' }]}>{index + 1}/{totalCards}</Text>
                </View>

                {/* Question */}
                <View style={styles.questionSection}>
                    <Text style={styles.questionText}>{task.taskstatement}</Text>
                </View>

                {/* Recording UI */}
                <View style={voiceStyles.recordingContainer}>
                    {!recordingUri ? (
                        // Recording Mode
                        <>
                            <Animated.View style={[voiceStyles.pulseCircle, pulseAnimatedStyle]}>
                                <TouchableOpacity
                                    onPress={handleToggleRecording}
                                    style={[
                                        voiceStyles.micButton,
                                        isRecording && voiceStyles.micButtonRecording
                                    ]}
                                    activeOpacity={0.8}
                                >
                                    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M12 1a4 4 0 00-4 4v6a4 4 0 008 0V5a4 4 0 00-4-4z"
                                            fill={isRecording ? '#FF4444' : '#FFFFFF'}
                                        />
                                        <Path
                                            d="M19 10v1a7 7 0 01-14 0v-1M12 18.5V23M8 23h8"
                                            stroke={isRecording ? '#FF4444' : '#FFFFFF'}
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </Svg>
                                </TouchableOpacity>
                            </Animated.View>

                            <Text style={voiceStyles.instructionText}>
                                {isRecording ? 'Tap to stop' : 'Tap to record'}
                            </Text>

                            {isRecording && (
                                <View style={voiceStyles.timerContainer}>
                                    <View style={voiceStyles.recordingDot} />
                                    <Text style={voiceStyles.timerText}>{recordingDuration}</Text>
                                </View>
                            )}
                        </>
                    ) : (
                        // Preview Mode
                        <>
                            <View style={voiceStyles.previewContainer}>
                                {/* Play/Pause Button */}
                                <TouchableOpacity
                                    onPress={handlePlayPause}
                                    style={[
                                        voiceStyles.playButton,
                                        isPlaying && voiceStyles.playButtonActive
                                    ]}
                                >
                                    <View style={voiceStyles.playButtonInner}>
                                        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                                            {isPlaying ? (
                                                <>
                                                    <Path d="M6 4h4v16H6V4z" fill="#FFFFFF" />
                                                    <Path d="M14 4h4v16h-4V4z" fill="#FFFFFF" />
                                                </>
                                            ) : (
                                                <Path d="M8 5v14l11-7L8 5z" fill="#FFFFFF" />
                                            )}
                                        </Svg>
                                    </View>
                                </TouchableOpacity>

                                {/* Waveform Visualization */}
                                <View style={voiceStyles.waveformContainer}>
                                    <View style={voiceStyles.waveformBars}>
                                        {[0.3, 0.6, 0.8, 0.5, 0.9, 0.7, 0.4, 0.85, 0.6, 0.75, 0.5, 0.9].map((height, idx) => (
                                            <Animated.View
                                                key={idx}
                                                style={[
                                                    voiceStyles.waveformBar,
                                                    {
                                                        height: 30 * height,
                                                        backgroundColor: isPlaying
                                                            ? `rgba(255, 255, 255, ${0.4 + height * 0.6})`
                                                            : 'rgba(255, 255, 255, 0.4)'
                                                    }
                                                ]}
                                            />
                                        ))}
                                    </View>
                                    <Text style={voiceStyles.durationText}>
                                        {isPlaying ? playbackPosition : recordingDuration}
                                    </Text>
                                </View>
                            </View>

                            {/* Action Buttons */}
                            <View style={voiceStyles.actionsRow}>
                                <TouchableOpacity
                                    onPress={handleDiscard}
                                    style={voiceStyles.discardButton}
                                    activeOpacity={0.7}
                                >
                                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                            stroke="rgba(255,255,255,0.8)"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </Svg>
                                    <Text style={voiceStyles.discardText}>Discard</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    style={voiceStyles.submitButton}
                                    disabled={isSubmitting}
                                    activeOpacity={0.85}
                                >
                                    <View style={voiceStyles.submitButtonInner}>
                                        {isSubmitting ? (
                                            <ActivityIndicator color="#fff" size="small" />
                                        ) : (
                                            <>
                                                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                                    <Path
                                                        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                                                        stroke="#FFFFFF"
                                                        strokeWidth={2}
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                    />
                                                </Svg>
                                                <Text style={voiceStyles.submitText}>Send</Text>
                                            </>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>

                {/* Skip Button */}
                {!isLastCard && !recordingUri && !isRecording && (
                    <View style={voiceStyles.skipContainer}>
                        <TouchableOpacity onPress={onSkip} style={voiceStyles.skipButton}>
                            <Text style={voiceStyles.skipText}>Skip</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </LinearGradient>
    );
});

const voiceStyles = StyleSheet.create({
    recordingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    pulseCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    micButton: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    micButtonRecording: {
        backgroundColor: 'rgba(255, 68, 68, 0.3)',
        borderColor: '#FF4444',
    },
    instructionText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 16,
        marginTop: spacing.lg,
        fontWeight: '500',
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF4444',
        marginRight: spacing.sm,
    },
    timerText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    previewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        borderRadius: 24,
        padding: spacing.lg,
        paddingHorizontal: spacing.lg,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    playButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    playButtonActive: {
        backgroundColor: 'rgba(255, 100, 100, 0.3)',
        borderColor: 'rgba(255, 150, 150, 0.5)',
    },
    playButtonInner: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    waveformContainer: {
        flex: 1,
        marginLeft: spacing.md,
        justifyContent: 'center',
    },
    waveformBars: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 40,
        paddingHorizontal: spacing.sm,
    },
    waveformBar: {
        width: 4,
        borderRadius: 2,
        marginHorizontal: 2,
    },
    durationText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
        textAlign: 'center',
        marginTop: spacing.xs,
    },
    actionsRow: {
        flexDirection: 'row',
        marginTop: spacing.xl,
        gap: spacing.md,
        width: '100%',
    },
    discardButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        gap: spacing.sm,
    },
    discardText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 16,
        fontWeight: '600',
    },
    submitButton: {
        flex: 1.3,
        borderRadius: 16,
        overflow: 'hidden',
    },
    submitButtonInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
        backgroundColor: '#000000',
        borderRadius: 16,
        minHeight: 52,
    },
    submitText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    skipContainer: {
        marginTop: 'auto',
        alignItems: 'center',
    },
    skipButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    skipText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 16,
        fontWeight: '500',
    },
});

export default VoiceRecordCard;
