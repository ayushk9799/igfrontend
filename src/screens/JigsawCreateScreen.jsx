import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Platform,
    PermissionsAndroid,
    ActivityIndicator,
    Animated,
    Dimensions,
    InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';

import { Camera } from 'react-native-camera-kit';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { usePuzzle } from '../hooks/usePuzzle';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JigsawCreateScreen = ({ navigation, route, onLinkPartner }) => {
    const { partnerId, partnerName } = route.params || {};
    const { createPuzzle } = usePuzzle();

    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);

    const [hasPermission, setHasPermission] = useState(false);
    const [previewUri, setPreviewUri] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [cameraType, setCameraType] = useState('back');
    const [screenMessage, setScreenMessage] = useState(null);

    const [isCameraInitialized, setIsCameraInitialized] = useState(false);

    // Animations
    const puzzleFloat = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const piece1Rotate = useRef(new Animated.Value(0)).current;
    const piece2Rotate = useRef(new Animated.Value(0)).current;
    const piece3Rotate = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setIsCameraInitialized(true);
            checkCameraPermission();
        });

        return () => task.cancel();
    }, []);

    // Animation Effect
    useEffect(() => {
        if (showCamera && !previewUri) return;

        Animated.loop(
            Animated.sequence([
                Animated.timing(puzzleFloat, { toValue: -10, duration: 1500, useNativeDriver: true }),
                Animated.timing(puzzleFloat, { toValue: 0, duration: 1500, useNativeDriver: true }),
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        ).start();

        Animated.loop(Animated.timing(piece1Rotate, { toValue: 1, duration: 8000, useNativeDriver: true })).start();
        Animated.loop(Animated.timing(piece2Rotate, { toValue: -1, duration: 10000, useNativeDriver: true })).start();
        Animated.loop(Animated.timing(piece3Rotate, { toValue: 1, duration: 6000, useNativeDriver: true })).start();
    }, [showCamera, previewUri, piece1Rotate, piece2Rotate, piece3Rotate, pulseAnim, puzzleFloat]);

    const checkCameraPermission = async () => {
        if (Platform.OS === 'ios') {
            const { status } = await ImagePicker.getCameraPermissionsAsync();
            setHasPermission(status === 'granted');
            return;
        }
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        setHasPermission(granted);
    };

    const requestCameraPermission = async () => {
        if (Platform.OS === 'ios') {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            const granted = status === 'granted';
            setHasPermission(granted);
            if (!granted) {
                setScreenMessage({
                    tone: 'warning',
                    text: translateUiText("Camera access is needed for photos. You can still choose one from Gallery."),
                });
            }
            return granted;
        }
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(granted);
        if (!granted) {
            setScreenMessage({
                tone: 'warning',
                text: translateUiText("Camera access is needed for photos. You can still choose one from Gallery."),
            });
        }
        return granted;
    };

    const handleOpenCamera = async () => {
        const granted = hasPermission || (await requestCameraPermission());
        if (granted) {
            setPreviewUri(null);
            setShowCamera(true);
        }
    };

    const toggleCamera = () => {
        if (!showCamera) {
            handleOpenCamera();
            return;
        }
        setCameraType(prev => prev === 'back' ? 'front' : 'back');
    };

    const handleCapture = async () => {
        if (!showCamera) {
            handleOpenCamera();
            return;
        }
        if (!hasPermission) {
            handleOpenCamera();
            return;
        }
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
            const data = await cameraRef.current?.capture();
            const source = data?.uri || (data?.path ? `file://${data.path}` : null);
            if (!source) throw new Error('No image captured');

            const finalUri = source.startsWith('file://') ? source : `file://${source}`;

            setPreviewUri({
                uri: finalUri,
                isFrontCamera: cameraType === 'front'
            });

            setShowCamera(false);
        } catch (e) {
            setScreenMessage({ tone: 'error', text: translateUiText("Could not capture the photo. Please try again.") });
        } finally {
            isProcessingRef.current = false;
        }
    };

    const handlePickFromGallery = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                setScreenMessage({
                    tone: 'warning',
                    text: translateUiText("Photo library access is needed to choose a puzzle photo."),
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

            const finalUri = sourceUri.startsWith('file://') ? sourceUri : `file://${sourceUri}`;
            setPreviewUri({ uri: finalUri, isFrontCamera: false });
            setShowCamera(false);
        } catch (e) {
        }
    };

    const handleCropImage = async () => {
        const uri = typeof previewUri === 'string' ? previewUri : previewUri?.uri;
        if (!uri) return null;

        try {
            // Get image dimensions to perform center crop
            const { width, height } = await new Promise((resolve, reject) => {
                Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), (err) => reject(err));
            });

            const size = Math.min(width, height);
            const originX = (width - size) / 2;
            const originY = (height - size) / 2;

            const cropResult = await manipulateAsync(
                uri,
                [{ crop: { originX, originY, width: size, height: size } }],
                { compress: 0.9, format: SaveFormat.JPEG }
            );

            const finalUri = cropResult.uri.startsWith('file://') ? cropResult.uri : `file://${cropResult.uri}`;
            setPreviewUri({ uri: finalUri, isFrontCamera: previewUri?.isFrontCamera || false });
            return finalUri;
        } catch (e) {
            // If crop fails, return the original URI as a fallback
            return uri.startsWith('file://') ? uri : `file://${uri}`;
        }
    };

    const handleSendPuzzle = async () => {
        if (!previewUri || isSending) return;
        setIsSending(true);

        try {
            const croppedUri = await handleCropImage();
            if (!croppedUri) {
                setIsSending(false);
                return;
            }

            const result = await createPuzzle(
                { uri: croppedUri, fileName: `puzzle_${Date.now()}.jpg` },
                partnerId
            );

            if (result.success) {
                requestReviewForMoment(REVIEW_MOMENTS.PUZZLE_SENT);
                setScreenMessage({
                    tone: 'success',
                    text: translateUiTemplate("Puzzle sent — {{0}} can solve it now.", [
                        partnerName || translateUiText("your partner"),
                    ]),
                });
                setTimeout(() => navigation.goBack(), 1200);
            } else {
                setScreenMessage({
                    tone: 'error',
                    text: translateUiText("Failed to send the puzzle. Please try again."),
                });
            }
        } catch (error) {
            setScreenMessage({
                tone: 'error',
                text: translateUiText("Failed to send the puzzle. Please try again."),
            });
        }
        setIsSending(false);
    };

    const piece1Spin = piece1Rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const piece2Spin = piece2Rotate.interpolate({ inputRange: [-1, 0], outputRange: ['-360deg', '0deg'] });
    const piece3Spin = piece3Rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <GradientBackground variant="light" showOrbs={true} showParticles={true}>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{translateUiText("Create Puzzle")}</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <Animated.View style={[styles.floatingPiece, styles.piece1, { transform: [{ rotate: piece1Spin }] }]}>
                    <PuzzlePieceIcon size={60} color={colors.primaryLight} />
                </Animated.View>
                <Animated.View style={[styles.floatingPiece, styles.piece2, { transform: [{ rotate: piece2Spin }] }]}>
                    <PuzzlePieceIcon size={45} color={colors.secondaryLight} />
                </Animated.View>
                <Animated.View style={[styles.floatingPiece, styles.piece3, { transform: [{ rotate: piece3Spin }] }]}>
                    <PuzzlePieceIcon size={50} color={colors.accent} />
                </Animated.View>

                <View style={styles.content}>
                    <Text style={styles.title}>{translateUiText("Send a Puzzle!")}</Text>
                    <Text style={styles.subtitle}>
                        {previewUri ? translateUiText("Your puzzle preview 🧩") : translateUiTemplate("Pick a photo and challenge {{0}} to solve it", [partnerName || 'your partner'])}
                    </Text>
                    {screenMessage && (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => setScreenMessage(null)}
                            style={styles.messageArea}
                        >
                            <Text style={[
                                styles.messageText,
                                screenMessage.tone === 'success' && styles.messageSuccess,
                                screenMessage.tone === 'warning' && styles.messageWarning,
                                screenMessage.tone === 'error' && styles.messageError,
                            ]}>
                                {screenMessage.text}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Camera / Preview Box */}
                    <View style={styles.cameraBoxContainer}>
                        {showCamera && !previewUri ? (
                            isCameraInitialized && hasPermission ? (
                                <Camera
                                    ref={cameraRef}
                                    style={styles.camera}
                                    cameraType={cameraType}
                                    flashMode={cameraType === 'front' ? 'off' : 'auto'}
                                />
                            ) : !hasPermission && isCameraInitialized ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={styles.cameraPermissionText}>{translateUiText("Camera access is needed to take puzzle photos")}</Text>
                                    <TouchableOpacity
                                        onPress={requestCameraPermission}
                                        style={styles.grantCameraButton}
                                    >
                                        <Text style={styles.grantCameraText}>{translateUiText("Continue")}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                </View>
                            )
                        ) : previewUri ? (
                            <Image
                                source={{ uri: typeof previewUri === 'string' ? previewUri : previewUri?.uri }}
                                style={[
                                    styles.previewImage,
                                    (previewUri?.isFrontCamera) && { transform: [{ scaleX: -1 }] }
                                ]}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.pickPhotoContainer}>
                                <Animated.View style={{ transform: [{ translateY: puzzleFloat }] }}>
                                    <BigPuzzleIcon />
                                </Animated.View>
                                <Text style={styles.pickPhotoTitle}>{translateUiText("Choose a puzzle photo")}</Text>
                                <Text style={styles.pickPhotoSubtitle}>{translateUiText("Use your camera or pick one from your gallery.")}</Text>
                            </View>
                        )}
                        {/* Grid Overlay on Preview */}
                        {previewUri && (
                            <View style={styles.gridOverlay}>
                                {[...Array(25)].map((_, i) => (
                                    <View key={i} style={styles.gridCell} />
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Controls Row */}
                    <View style={styles.controlsRow}>
                        {!previewUri && showCamera ? (
                            <>
                                <TouchableOpacity onPress={handlePickFromGallery} style={styles.controlBtnSecondary}>
                                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                        <Rect x="3" y="3" width="18" height="18" rx="2" stroke={colors.text} strokeWidth={2} />
                                        <Path d="M3 15l5-5 4 4 3-3 6 6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                        <Circle cx="8.5" cy="8.5" r="1.5" fill={colors.text} />
                                    </Svg>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleCapture} style={styles.controlBtnPrimary}>
                                    <View style={styles.captureInner} />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={toggleCamera} style={styles.controlBtnSecondary}>
                                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                        <Path d="M1 4v6h6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                        <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                    </Svg>
                                </TouchableOpacity>
                            </>
                        ) : !previewUri ? (
                            <>
                                <TouchableOpacity onPress={handlePickFromGallery} style={styles.optionButton}>
                                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                        <Rect x="3" y="3" width="18" height="18" rx="2" stroke={colors.text} strokeWidth={2} />
                                        <Path d="M3 15l5-5 4 4 3-3 6 6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                        <Circle cx="8.5" cy="8.5" r="1.5" fill={colors.text} />
                                    </Svg>
                                    <Text style={styles.optionButtonText}>{translateUiText("Gallery")}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleOpenCamera} style={[styles.optionButton, styles.optionButtonPrimary]}>
                                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                        <Path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                        <Circle cx="12" cy="13" r="3" stroke="#FFFFFF" strokeWidth={2} />
                                    </Svg>
                                    <Text style={[styles.optionButtonText, styles.optionButtonPrimaryText]}>{translateUiText("Camera")}</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity onPress={handleOpenCamera} style={styles.controlBtnText}>
                                <Text style={styles.retakeText}>{translateUiText("Retake Photo")}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Footer with Send Button */}
                <View style={styles.footer}>
                    {partnerId ? (
                        <TouchableOpacity
                            onPress={handleSendPuzzle}
                            activeOpacity={0.8}
                            disabled={!previewUri || isSending}
                            style={[
                                styles.premiumActionButton,
                                (!previewUri || isSending) && styles.premiumActionButtonDisabled,
                            ]}
                        >
                            {isSending ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.premiumActionText}>{translateUiTemplate("Send to {{0}} 🧩", [partnerName])}</Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => {
                                if (onLinkPartner) {
                                    onLinkPartner();
                                } else {
                                    navigation.goBack();
                                }
                            }}
                            activeOpacity={0.8}
                            style={styles.premiumActionButton}
                        >
                            <Text style={styles.premiumActionText}>{translateUiText("Link Partner to Send 🔗")}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        </GradientBackground>
    );
};

// Icons components ... (PuzzlePieceIcon, BigPuzzleIcon) remain the same
const PuzzlePieceIcon = ({ size = 40, color = colors.primary }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M20 11V7a2 2 0 00-2-2h-3.5a2.5 2.5 0 110-5 2.5 2.5 0 110 5H11a2 2 0 00-2 2v3.5a2.5 2.5 0 11-5 0 2.5 2.5 0 115 0V14a2 2 0 002 2h3.5a2.5 2.5 0 110 5 2.5 2.5 0 110-5H18a2 2 0 002-2v-3z" fill={color} opacity={0.6} />
    </Svg>
);

const BigPuzzleIcon = () => (
    <View style={styles.bigPuzzleContainer}>
        <Svg width={120} height={120} viewBox="0 0 100 100" fill="none">
            <Path d="M10 10 H40 V20 C40 25, 45 30, 50 30 C55 30, 60 25, 60 20 V10 H90 V40 H80 C75 40, 70 45, 70 50 C70 55, 75 60, 80 60 H90 V90 H60 V80 C60 75, 55 70, 50 70 C45 70, 40 75, 40 80 V90 H10 V60 H20 C25 60, 30 55, 30 50 C30 45, 25 40, 20 40 H10 Z" fill={colors.primary} stroke={colors.primaryLight} strokeWidth="2" />
        </Svg>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
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
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    headerSpacer: { width: 40 },
    content: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    title: { color: colors.text, fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: spacing.xs },
    subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, paddingHorizontal: spacing.sm },
    messageArea: {
        marginTop: -spacing.md,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.sm,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
        fontWeight: '800',
        textAlign: 'center',
    },
    messageSuccess: {
        color: '#16803A',
    },
    messageWarning: {
        color: '#9A6200',
    },
    messageError: {
        color: '#C03434',
    },

    // Camera Box
    cameraBoxContainer: {
        width: '100%',
        aspectRatio: 1, // Square
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    camera: {
        position: 'absolute',
        top: '-38.5%', // Center 16:9 camera in 1:1 box
        left: 0,
        width: '100%',
        height: '177%',
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    cameraPermissionText: {
        color: colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xl,
    },
    grantCameraButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
    },
    grantCameraText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 15,
    },
    previewImage: { flex: 1 },
    pickPhotoContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    pickPhotoTitle: {
        color: colors.text,
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: spacing.md,
    },
    pickPhotoSubtitle: {
        color: colors.textSecondary,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginTop: spacing.xs,
    },

    // Controls
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xl,
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
    },
    controlBtnSecondary: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#FAE8FF',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    controlBtnPrimary: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255, 117, 143, 0.25)', // Primary glow
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    captureInner: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: colors.primary,
    },
    controlBtnText: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: '#FAE8FF',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    retakeText: {
        color: colors.text,
        fontWeight: '600',
        fontSize: 16,
    },
    optionButton: {
        minWidth: 132,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        borderWidth: 1,
        borderColor: '#FAE8FF',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    optionButtonPrimary: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    optionButtonText: {
        color: colors.text,
        fontWeight: '700',
        fontSize: 15,
    },
    optionButtonPrimaryText: {
        color: '#FFFFFF',
    },

    // Footer / Send
    footer: {
        width: '100%',
        marginTop: 0,
        paddingBottom: spacing['2xl'],
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
    premiumActionButtonDisabled: {
        opacity: 0.5,
    },
    premiumActionText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },


    // Grid Overlay
    gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', flexWrap: 'wrap' },
    gridCell: { width: '20%', height: '20%', borderWidth: 1, borderColor: 'rgba(46, 30, 60, 0.12)' },

    // Floating pieces
    floatingPiece: { position: 'absolute', opacity: 0.3 },
    piece1: { top: 120, left: 20 },
    piece2: { top: 200, right: 30 },
    piece3: { bottom: 150, left: 50 },
    uploadSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
    bigPuzzleContainer: { marginBottom: spacing.xl },
    optionsRow: { flexDirection: 'row', gap: spacing.lg },
    optionBtn: { borderRadius: borderRadius.xl, overflow: 'hidden', shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
    optionGradient: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    optionText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    previewSection: { flex: 1, alignItems: 'center', paddingTop: spacing.xl },
    previewTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
    previewContainer: { width: SCREEN_WIDTH - 80, height: SCREEN_WIDTH - 80, borderRadius: borderRadius.lg, overflow: 'hidden', position: 'relative' },
    previewActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
    retakeBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.borderLight, borderRadius: borderRadius.lg },
    retakeBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
    sendBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: borderRadius.lg, minWidth: 160, alignItems: 'center' },
    sendBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    previewHint: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.md },
});

export default JigsawCreateScreen;
