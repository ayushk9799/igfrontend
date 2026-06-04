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
import { fontFamily } from '../../constants/fonts';
import { spacing } from '../../theme';
import { uploadAudioToS3 } from '../../utils/uploadApi';

const WAVEFORM_BAR_HEIGHTS = [
    0.38, 0.64, 0.46, 0.82, 0.58, 0.94, 0.52, 0.74,
    0.42, 0.88, 0.68, 0.50, 0.78, 0.56, 0.92, 0.48,
    0.70, 0.40, 0.84, 0.60,
];

/**
 * VoiceRecordCard - Card for recording voice messages
 * Uses react-native-audio-recorder-player v3.6.0 (non-Expo)
 */
const VoiceRecordCard = React.memo(({
    task,
    index,
    displayIndex,
    totalCards,
    partnerName,
    userName,
    hasPartner = false,
    onLinkPartner,
    onSubmit,
    onSkip,
    isLastCard,
    onAnswerSubmit,
    isAnswered = false,
    previousAnswer = null,
    autoAdvanceOnSubmit = true,
    isLocked = false,
    onNavigateToPremium = () => { },
}) => {
    const config = categoryConfig.voicerecord;
    const lastTaskIdRef = useRef(task._id);

    // Create audio recorder player instance
    const audioRecorderPlayerRef = useRef(null);

    // Initialize the audio recorder player on mount
    useEffect(() => {
        try {
            const player = new AudioRecorderPlayer();
            audioRecorderPlayerRef.current = player;
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
    const [isPlaying, setIsPlaying] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState('00:00');
    const [playbackProgress, setPlaybackProgress] = useState(0);

    // Animation for pulsing mic when recording
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0.6);

    useEffect(() => {
        // Reset state only when task ID changes
        if (lastTaskIdRef.current !== task._id) {
            lastTaskIdRef.current = task._id;
            setRecordingUri(isAnswered ? previousAnswer : null);
            setRecordingDuration('00:00');
            setIsRecording(false);
            setIsPlaying(false);
            setPlaybackPosition('00:00');
            setPlaybackProgress(0);
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
    }, [isRecording, pulseOpacity, pulseScale]);

    const pulseAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    const requestPermissions = async () => {
        try {
            if (Platform.OS === 'android') {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
                );
                setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
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
                Alert.alert('Microphone Needed', 'Microphone access is needed to record voice messages.');
                if (Platform.OS === 'android') {
                    requestPermissions();
                }
                return;
            }

            try {
                await cleanupPlayback();
                await cleanupRecording();


                if (!audioRecorderPlayerRef.current) {
                    console.error('AudioRecorderPlayer not initialized');
                    return;
                }

                // Set audio mode for recording
                audioRecorderPlayerRef.current.setSubscriptionDuration(0.1); // Update every 100ms

                // On Android, pass undefined to let the native module use the app's cache directory
                const path = Platform.select({
                    ios: `voice_${Date.now()}.m4a`,
                    android: undefined,
                });

                await audioRecorderPlayerRef.current.startRecorder(path);

                audioRecorderPlayerRef.current.addRecordBackListener((e) => {
                    const duration = audioRecorderPlayerRef.current.mmssss(Math.floor(e.currentPosition));
                    setRecordingDuration(duration.slice(0, 5)); // MM:SS format
                });

                setIsRecording(true);
                setRecordingUri(null);
            } catch (error) {
                setHasPermission(false);
                Alert.alert('Microphone Needed', 'Microphone access is needed to record voice messages.');
            }
        }
    };

    const handleStopRecording = async () => {
        if (!isRecording) return;

        try {
            if (!audioRecorderPlayerRef.current) return;
            const uri = await audioRecorderPlayerRef.current.stopRecorder();
            audioRecorderPlayerRef.current.removeRecordBackListener();

            setIsRecording(false);
            if (uri) {
                setRecordingUri(uri);
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

                await audioRecorderPlayerRef.current.startPlayer(recordingUri);
                audioRecorderPlayerRef.current.setVolume(1.0);

                audioRecorderPlayerRef.current.addPlayBackListener((e) => {
                    const position = audioRecorderPlayerRef.current.mmssss(Math.floor(e.currentPosition));
                    setPlaybackPosition(position.slice(0, 5));
                    setPlaybackProgress(e.duration ? Math.min(e.currentPosition / e.duration, 1) : 0);

                    if (e.currentPosition >= e.duration) {
                        audioRecorderPlayerRef.current.stopPlayer();
                        audioRecorderPlayerRef.current.removePlayBackListener();
                        setIsPlaying(false);
                        setPlaybackPosition('00:00');
                        setPlaybackProgress(0);
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
        setPlaybackPosition('00:00');
        setPlaybackProgress(0);
    };

    const handleSubmit = async () => {
        if (!recordingUri || isSubmitting) return;

        // Block if locked (premium restriction)
        if (isLocked) {
            onNavigateToPremium?.();
            return;
        }

        // Block submission if no partner linked
        if (!hasPartner) {
            onLinkPartner?.();
            return;
        }

        setIsSubmitting(true);

        try {
            const s3Url = await uploadAudioToS3(recordingUri, 'voice-recordings');

            await onAnswerSubmit(task.originalIndex ?? index, s3Url, 'voice');
            // Only auto-advance if the parent screen doesn't filter answered tasks
            if (autoAdvanceOnSubmit && onSubmit) {
                // Delay swipe to show completion state first
                setTimeout(() => onSubmit(s3Url), 600);
            }
        } catch (error) {
            console.error('🎙️ [VoiceRecordCard] Upload failed:', error);
            Alert.alert('Upload Failed', 'Could not upload voice recording. Please try again.');
            setIsSubmitting(false);
        }
    };

    const getWaveformBarStyle = (height, isPlayed) => ({
        height: 36 * height,
        backgroundColor: isPlaying && isPlayed ? '#F64D7E' : '#F9A2BD',
        opacity: isPlaying && !isPlayed ? 0.55 : 1,
    });

    return (
        <LinearGradient colors={['#FFF0F6', '#FFF9FB']} style={voiceStyles.cardInner}>
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

            <View style={[voiceStyles.cardContent, isAnswered && voiceStyles.answeredContent]}>
                {/* Header */}
                <View style={voiceStyles.topRow}>
                    <View style={voiceStyles.categoryBadge}>
                        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                            <Path d="M12 2a4 4 0 00-4 4v6a4 4 0 008 0V6a4 4 0 00-4-4z" fill="#F64D7E" />
                            <Path d="M19 11a7 7 0 01-14 0M12 18v4M8 22h8" stroke="#F64D7E" strokeWidth={2.4} strokeLinecap="round" />
                        </Svg>
                        <Text style={voiceStyles.categoryText}>{config.label}</Text>
                    </View>
                    <Text style={voiceStyles.counterText}>{displayIndex || index + 1} / {totalCards}</Text>
                </View>

                {/* Question */}
                <View style={voiceStyles.questionSection}>
                    <Text style={voiceStyles.questionText}>{task.taskstatement}</Text>
                </View>

                {/* Recording UI */}
                <View style={[
                    voiceStyles.recordingContainer,
                    recordingUri && voiceStyles.previewRecordingContainer
                ]}>
                    {!recordingUri ? (
                        // Recording Mode
                        <>
                            <TouchableOpacity
                                onPress={handleToggleRecording}
                                activeOpacity={0.82}
                            >
                                <Animated.Image
                                    source={require('../../../assets/daily-cards/voice.png')}
                                    style={[
                                        voiceStyles.voiceArtwork,
                                        isRecording && pulseAnimatedStyle
                                    ]}
                                    resizeMode="contain"
                                />
                            </TouchableOpacity>

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
                                        {WAVEFORM_BAR_HEIGHTS.map((height, idx) => {
                                            const isPlayed = playbackProgress > idx / WAVEFORM_BAR_HEIGHTS.length;

                                            return (
                                                <View
                                                    key={idx}
                                                    style={[
                                                        voiceStyles.waveformBar,
                                                        getWaveformBarStyle(height, isPlayed)
                                                    ]}
                                                />
                                            );
                                        })}
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
                                            stroke="#B62D59"
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
                                                <Text style={voiceStyles.submitText}>✓  Submit</Text>
                                            </>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>

                {!recordingUri && !isRecording && (
                    <View style={voiceStyles.bottomActions}>
                        <TouchableOpacity onPress={isLocked ? onNavigateToPremium : onSkip} style={voiceStyles.skipButton}>
                            <Text style={voiceStyles.skipText}>Skip</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleSubmit}
                            style={[voiceStyles.idleSubmitButton, !recordingUri && voiceStyles.idleSubmitDisabled]}
                            disabled={!recordingUri}
                        >
                            <Text style={voiceStyles.idleSubmitText}>✓  Submit</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={voiceStyles.swipeHint}>
                    <Text style={voiceStyles.swipeText}>Swipe to see next</Text>
                    <View style={voiceStyles.swipeDot}>
                        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                            <Path d="M9 18L15 12L9 6" stroke="#F64D7E" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </View>
                </View>


            </View>
        </LinearGradient>
    );
});

const voiceStyles = StyleSheet.create({
    cardInner: {
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FFB6CA',
        shadowColor: '#F78AAA',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 22,
        elevation: 10,
        marginRight: 10,
    },
    cardContent: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    answeredContent: {
        opacity: 0.3,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        backgroundColor: 'rgba(255,255,255,0.82)',
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFD6E2',
    },
    categoryText: {
        color: '#F64D7E',
        fontWeight: '800',
        fontSize: 14,
        fontFamily: fontFamily.bold,
    },
    counterText: {
        color: '#8B1642',
        fontWeight: '800',
        fontSize: 16,
        fontFamily: fontFamily.bold,
    },
    questionSection: {
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
    },
    questionText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#8B1642',
        lineHeight: 33,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
    },
    recordingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    previewRecordingContainer: {
        justifyContent: 'space-between',
        paddingTop: spacing['2xl'],
        paddingBottom: spacing.xs,
    },
    voiceArtwork: {
        width: 238,
        height: 162,
        alignSelf: 'center',
    },
    instructionText: {
        color: '#8B1642',
        fontSize: 16,
        marginTop: spacing.xs,
        fontWeight: '500',
        fontFamily: fontFamily.medium,
    },
    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.md,
        backgroundColor: '#FFE3EC',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFD1DF',
    },
    recordingDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF4444',
        marginRight: spacing.sm,
    },
    timerText: {
        color: '#8B1642',
        fontSize: 18,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
        fontFamily: fontFamily.bold,
    },
    previewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.74)',
        borderRadius: 24,
        padding: spacing.lg,
        paddingHorizontal: spacing.lg,
        width: '100%',
        borderWidth: 1,
        borderColor: '#FFD1DF',
        shadowColor: '#F78AAA',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 5,
    },
    playButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F64D7E',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    playButtonActive: {
        backgroundColor: '#D93668',
        borderColor: '#FFFFFF',
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
        height: 46,
        paddingHorizontal: spacing.xs,
    },
    waveformBar: {
        width: 5,
        minHeight: 8,
        borderRadius: 3,
        marginHorizontal: 1.5,
    },
    durationText: {
        color: '#8B1642',
        fontSize: 14,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
        textAlign: 'center',
        marginTop: spacing.xs,
        fontFamily: fontFamily.bold,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.xs,
    },
    discardButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: '#FFE3EC',
        borderWidth: 1,
        borderColor: '#FFD1DF',
        gap: spacing.sm,
    },
    discardText: {
        color: '#B62D59',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: fontFamily.bold,
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
        backgroundColor: '#F64D7E',
        borderRadius: 16,
        minHeight: 52,
    },
    submitText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        letterSpacing: 0.5,
        fontFamily: fontFamily.bold,
    },
    bottomActions: {
        marginTop: 'auto',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    skipButton: {
        paddingVertical: 12,
        paddingHorizontal: spacing.lg,
        borderRadius: 22,
        backgroundColor: '#FFE3EC',
        borderWidth: 1,
        borderColor: '#FFD1DF',
    },
    skipText: {
        color: '#B62D59',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: fontFamily.medium,
    },
    idleSubmitButton: {
        paddingVertical: 14,
        paddingHorizontal: 28,
        borderRadius: 25,
        backgroundColor: '#F64D7E',
        shadowColor: '#F64D7E',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 14,
        elevation: 8,
    },
    idleSubmitDisabled: {
        opacity: 0.55,
    },
    idleSubmitText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        fontFamily: fontFamily.bold,
    },
    swipeHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingTop: spacing.sm,
    },
    swipeText: {
        color: '#A88996',
        fontSize: 12,
        fontWeight: '700',
        fontFamily: fontFamily.medium,
    },
    swipeDot: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFDDE8',
    },

});

export default VoiceRecordCard;
