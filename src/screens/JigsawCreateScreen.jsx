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
import LinearGradient from 'react-native-linear-gradient';
import Svg, {
    Path,
    Circle,
    Rect,
    Defs,
    LinearGradient as SvgGradient,
    Stop,
    Text as SvgText,
} from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';

import { Camera } from 'react-native-camera-kit';
import {
    FlipType,
    ImageManipulator,
    SaveFormat,
} from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

import GradientBackground from '../components/GradientBackground';
import { colors, spacing } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';
import { usePuzzle } from '../hooks/usePuzzle';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_COMPACT_HEIGHT = SCREEN_HEIGHT < 760;
const JIGSAW_CARD_SIZE = Math.min(
    SCREEN_WIDTH - 48,
    IS_COMPACT_HEIGHT ? 280 : 340
);
const MAX_SEND_NAME_LENGTH = 13;
const PUZZLE_IMAGE_SIZE = 960;
const PUZZLE_IMAGE_QUALITY = 0.8;

const getCompactSendName = (name) => {
    const characters = Array.from(String(name || 'your partner').trim());
    if (characters.length <= MAX_SEND_NAME_LENGTH) return characters.join('');
    return `${characters.slice(0, MAX_SEND_NAME_LENGTH).join('').trimEnd()}…`;
};

const preparePuzzleImage = async (uri, mirrorHorizontally = false) => {
    const context = ImageManipulator.manipulate(uri);
    let sourceImage = null;
    let outputImage = null;

    try {
        // Native decoding resolves EXIF orientation before dimensions are read,
        // keeping the crop rectangle in the same coordinate system as the pixels.
        sourceImage = await context.renderAsync();
        const cropSize = Math.floor(Math.min(sourceImage.width, sourceImage.height));

        context.crop({
            originX: Math.floor((sourceImage.width - cropSize) / 2),
            originY: Math.floor((sourceImage.height - cropSize) / 2),
            width: cropSize,
            height: cropSize,
        });
        context.resize({
            width: PUZZLE_IMAGE_SIZE,
            height: PUZZLE_IMAGE_SIZE,
        });

        // Match the mirrored selfie view in the actual uploaded asset.
        if (mirrorHorizontally) {
            context.flip(FlipType.Horizontal);
        }

        outputImage = await context.renderAsync();
        return await outputImage.saveAsync({
            compress: PUZZLE_IMAGE_QUALITY,
            format: SaveFormat.JPEG,
        });
    } finally {
        outputImage?.release?.();
        sourceImage?.release?.();
        context.release?.();
    }
};

const GalleryIcon = () => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Rect x="3" y="3" width="18" height="18" rx="2.5" stroke="#FF5E97" strokeWidth={2} />
        <Path d="M4 17l5-5 4 4 3-3 4 4" stroke="#FF5E97" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="8.5" cy="8.5" r="1.5" fill="#FF5E97" />
    </Svg>
);

const CameraIcon = ({ color = '#FF5E97', size = 24 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M4 7h3l1.5-2h7L17 7h3a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Circle cx="12" cy="13" r="3" stroke={color} strokeWidth={2} />
    </Svg>
);

const FlipIcon = () => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M12 4V1L8 5l4 4V6a6 6 0 015.3 8.8l1.46 1.46A8 8 0 0012 4z" fill="#FF5E97" />
        <Path d="M12 18a6 6 0 01-5.3-8.8L5.24 7.74A8 8 0 0012 20v3l4-4-4-4v3z" fill="#FF5E97" />
    </Svg>
);

const ReplaceIcon = () => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path
            d="M20 7v5h-5M4 17v-5h5M18.4 9A7 7 0 006.7 6.7L4 9M5.6 15A7 7 0 0017.3 17.3L20 15"
            stroke="#FF5E97"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

const JigsawCreateScreen = ({ navigation, route, onLinkPartner }) => {
    const { partnerId, partnerName } = route.params || {};
    const compactPartnerName = getCompactSendName(partnerName);
    const { createPuzzle } = usePuzzle();

    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);

    const [hasPermission, setHasPermission] = useState(false);
    const [previewUri, setPreviewUri] = useState(null);
    const [showCamera, setShowCamera] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isPreparingImage, setIsPreparingImage] = useState(false);
    const [cameraType, setCameraType] = useState('back');
    const [screenMessage, setScreenMessage] = useState(null);

    const [isCameraInitialized, setIsCameraInitialized] = useState(false);
    const preparedUriRef = useRef(null);

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

    useEffect(() => () => {
        if (preparedUriRef.current) {
            FileSystem.deleteAsync(preparedUriRef.current, { idempotent: true }).catch(() => {});
        }
    }, []);

    const replacePreparedPreview = (preparedImage) => {
        const previousUri = preparedUriRef.current;
        preparedUriRef.current = preparedImage.uri;
        setPreviewUri({
            uri: preparedImage.uri,
            width: preparedImage.width,
            height: preparedImage.height,
        });

        if (previousUri && previousUri !== preparedImage.uri) {
            FileSystem.deleteAsync(previousUri, { idempotent: true }).catch(() => {});
        }
    };

    const clearPreparedPreview = () => {
        const previousUri = preparedUriRef.current;
        preparedUriRef.current = null;
        setPreviewUri(null);
        if (previousUri) {
            FileSystem.deleteAsync(previousUri, { idempotent: true }).catch(() => {});
        }
    };

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
        if (isPreparingImage) return;
        const granted = hasPermission || (await requestCameraPermission());
        if (granted) {
            clearPreparedPreview();
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
        let capturedUri = null;

        try {
            const data = await cameraRef.current?.capture();
            const source = data?.uri || (data?.path ? `file://${data.path}` : null);
            if (!source) throw new Error('No image captured');

            capturedUri = source.startsWith('file://') ? source : `file://${source}`;
            setShowCamera(false);
            setIsPreparingImage(true);

            const preparedImage = await preparePuzzleImage(
                capturedUri,
                cameraType === 'front'
            );
            replacePreparedPreview(preparedImage);
        } catch (e) {
            setScreenMessage({ tone: 'error', text: translateUiText("Could not capture the photo. Please try again.") });
        } finally {
            if (capturedUri && capturedUri !== preparedUriRef.current) {
                FileSystem.deleteAsync(capturedUri, { idempotent: true }).catch(() => {});
            }
            setIsPreparingImage(false);
            isProcessingRef.current = false;
        }
    };

    const handlePickFromGallery = async () => {
        if (isPreparingImage) return;
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
            setShowCamera(false);
            setIsPreparingImage(true);

            const preparedImage = await preparePuzzleImage(finalUri);
            replacePreparedPreview(preparedImage);
        } catch (e) {
            setScreenMessage({
                tone: 'error',
                text: translateUiText("Could not prepare the photo. Please try again."),
            });
        } finally {
            setIsPreparingImage(false);
        }
    };

    const handleSendPuzzle = async () => {
        if (!previewUri?.uri || isSending || isPreparingImage) return;
        setIsSending(true);

        try {
            const result = await createPuzzle(
                {
                    uri: previewUri.uri,
                    fileName: `puzzle_${Date.now()}.jpg`,
                    mimeType: 'image/jpeg',
                },
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
                    <View style={styles.titleBlock}>
                        <Text style={styles.titlePrimary}>{translateUiText("Make a memory")}</Text>
                        <Svg
                            height={IS_COMPACT_HEIGHT ? 40 : 46}
                            width={SCREEN_WIDTH - 40}
                            style={styles.gradientTitle}
                        >
                            <Defs>
                                <SvgGradient id="jigsawTitleGradient" x1="0" y1="0" x2="1" y2="0">
                                    <Stop offset="0" stopColor="#FF435F" />
                                    <Stop offset="0.52" stopColor="#D34AA2" />
                                    <Stop offset="1" stopColor="#6756D8" />
                                </SvgGradient>
                            </Defs>
                            <SvgText
                                fill="url(#jigsawTitleGradient)"
                                fontFamily={fontFamily.extraBold}
                                fontSize={IS_COMPACT_HEIGHT ? 24 : 28}
                                fontWeight={fontWeight('700')}
                                textAnchor="middle"
                                x={(SCREEN_WIDTH - 40) / 2}
                                y={IS_COMPACT_HEIGHT ? 29 : 34}
                            >
                                {translateUiText("into a puzzle.")}
                            </SvgText>
                        </Svg>
                        <View style={styles.titleDivider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerHeart}>♡</Text>
                            <View style={styles.dividerLine} />
                        </View>
                    </View>

                    <Text style={styles.cardLabelText}>{translateUiText("Puzzle photo")}</Text>

                    {/* Camera / Preview Box */}
                    <View style={styles.cardContainer}>
                        <View
                            style={[
                                styles.dashedBox,
                                (showCamera || previewUri) && styles.dashedBoxMedia,
                            ]}
                        >
                            {isPreparingImage ? (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#FF5E97" />
                                </View>
                            ) : showCamera && !previewUri ? (
                                isCameraInitialized && hasPermission ? (
                                    <View style={styles.cameraWrapper}>
                                        <Camera
                                            ref={cameraRef}
                                            style={styles.camera}
                                            cameraType={cameraType}
                                            flashMode={cameraType === 'front' ? 'off' : 'auto'}
                                            resizeMode="cover"
                                        />
                                    </View>
                                ) : !hasPermission && isCameraInitialized ? (
                                    <View style={styles.loadingContainer}>
                                        <Text style={styles.cameraPermissionText}>{translateUiText("Camera access is needed to take puzzle photos")}</Text>
                                        <TouchableOpacity
                                            onPress={requestCameraPermission}
                                            style={styles.grantCameraButton}
                                            activeOpacity={0.85}
                                        >
                                            <LinearGradient
                                                colors={['#FF5E97', '#FFA1C9']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.grantCameraGradient}
                                            >
                                                <CameraIcon color="#FFFFFF" />
                                                <Text style={styles.grantCameraText}>{translateUiText("Continue")}</Text>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="large" color="#FF5E97" />
                                    </View>
                                )
                            ) : previewUri ? (
                                <>
                                    <Image
                                        source={{ uri: typeof previewUri === 'string' ? previewUri : previewUri?.uri }}
                                        style={styles.previewImage}
                                        resizeMode="cover"
                                    />
                                    <View style={styles.gridOverlay}>
                                        {[...Array(25)].map((_, i) => (
                                            <View key={i} style={styles.gridCell} />
                                        ))}
                                    </View>
                                </>
                            ) : (
                                <View style={styles.pickPhotoContainer}>
                                    <Animated.View style={{ transform: [{ translateY: puzzleFloat }] }}>
                                        <Image
                                            source={require('../../assets/images/jigsaw-puzzle-empty.png')}
                                            style={styles.puzzleEmptyImage}
                                            resizeMode="contain"
                                        />
                                    </Animated.View>
                                    <Text style={styles.pickPhotoTitle}>{translateUiText("Choose a puzzle photo")}</Text>
                                    <Text style={styles.pickPhotoSubtitle}>{translateUiText("Use your camera or pick one from your gallery.")}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Avatar-style camera controls */}
                    <View style={styles.controlsRow}>
                        <View style={styles.controlItem}>
                            <TouchableOpacity
                                onPress={handlePickFromGallery}
                                style={styles.smallCircleButton}
                                activeOpacity={0.82}
                            >
                                <GalleryIcon />
                            </TouchableOpacity>
                            <Text style={styles.controlLabel}>{translateUiText("Gallery")}</Text>
                        </View>

                        <View style={styles.controlItem}>
                            <TouchableOpacity
                                onPress={showCamera && !previewUri ? handleCapture : handleOpenCamera}
                                style={styles.captureRing}
                                activeOpacity={0.88}
                            >
                                <LinearGradient
                                    colors={['#FFB5D0', '#FF8FAB', '#FF5E97']}
                                    style={styles.captureRingGradient}
                                >
                                    <View style={styles.captureInnerCircle}>
                                        {!showCamera && <CameraIcon color="#FF5E97" size={27} />}
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.controlItem}>
                            <TouchableOpacity
                                style={styles.smallCircleButton}
                                activeOpacity={0.82}
                                onPress={
                                    showCamera
                                        ? toggleCamera
                                        : handleOpenCamera
                                }
                            >
                                {previewUri ? (
                                    <ReplaceIcon />
                                ) : showCamera ? (
                                    <FlipIcon />
                                ) : (
                                    <CameraIcon color="#FF5E97" />
                                )}
                            </TouchableOpacity>
                            <Text style={styles.controlLabel}>
                                {previewUri
                                    ? translateUiText("Retake")
                                    : showCamera
                                        ? translateUiText("Flip")
                                        : translateUiText("Camera")}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Footer with Send Button */}
                <View style={styles.footer}>
                    {partnerId ? (
                        <TouchableOpacity
                            onPress={handleSendPuzzle}
                            activeOpacity={0.8}
                            disabled={!previewUri || isPreparingImage || isSending}
                            style={[
                                styles.premiumActionButton,
                                (!previewUri || isPreparingImage || isSending) && styles.premiumActionButtonDisabled,
                            ]}
                        >
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.premiumActionGradient}
                            >
                                {isSending ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Text
                                            style={styles.premiumActionText}
                                            numberOfLines={1}
                                        >
                                            {translateUiTemplate("Send to {{0}}", [compactPartnerName])}
                                        </Text>
                                        <Text style={styles.premiumActionIcon}>🧩</Text>
                                    </>
                                )}
                            </LinearGradient>
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
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.premiumActionGradient}
                            >
                                <Text style={styles.premiumActionText}>{translateUiText("Link Partner to Send")}</Text>
                                <Text style={styles.premiumActionIcon}>🔗</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        </GradientBackground>
    );
};

const PuzzlePieceIcon = ({ size = 40, color = colors.primary }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M20 11V7a2 2 0 00-2-2h-3.5a2.5 2.5 0 110-5 2.5 2.5 0 110 5H11a2 2 0 00-2 2v3.5a2.5 2.5 0 11-5 0 2.5 2.5 0 115 0V14a2 2 0 002 2h3.5a2.5 2.5 0 110 5 2.5 2.5 0 110-5H18a2 2 0 002-2v-3z" fill={color} opacity={0.6} />
    </Svg>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: IS_COMPACT_HEIGHT ? 4 : 10,
        paddingBottom: 8,
        zIndex: 5,
    },
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
    headerTitle: {
        fontSize: 20,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#050E3E',
    },
    headerSpacer: { width: 44 },
    content: {
        flex: 1,
        minHeight: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleBlock: {
        alignItems: 'center',
    },
    titlePrimary: {
        color: '#050E3E',
        fontFamily: fontFamily.extraBold,
        fontSize: IS_COMPACT_HEIGHT ? 24 : 28,
        fontWeight: fontWeight('800'),
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    gradientTitle: {
        marginTop: -7,
    },
    titleDivider: {
        marginTop: 0,
        marginBottom: IS_COMPACT_HEIGHT ? 6 : 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    dividerLine: {
        width: 58,
        height: 2,
        borderRadius: 1,
        backgroundColor: 'rgba(255, 143, 171, 0.34)',
    },
    dividerHeart: {
        color: '#FF6B82',
        fontFamily: fontFamily.regular,
        fontSize: 16,
        lineHeight: 18,
    },
    cardLabelText: {
        marginBottom: IS_COMPACT_HEIGHT ? 6 : 10,
        color: '#FF5E97',
        fontFamily: fontFamily.bold,
        fontSize: 12,
        fontWeight: fontWeight('700'),
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    messageArea: {
        alignSelf: 'center',
        maxWidth: SCREEN_WIDTH - 64,
        marginHorizontal: 32,
        marginBottom: IS_COMPACT_HEIGHT ? 4 : 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.94)',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
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

    cardContainer: {
        width: JIGSAW_CARD_SIZE,
        height: JIGSAW_CARD_SIZE,
        borderRadius: 34,
        backgroundColor: '#FFFFFF',
        padding: 10,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
        elevation: 6,
    },
    dashedBox: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#FFD1E3',
        borderRadius: 24,
    },
    dashedBoxMedia: {
        borderWidth: 0,
    },
    cameraWrapper: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 22,
    },
    camera: {
        flex: 1,
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    cameraPermissionText: {
        color: '#7380A1',
        fontFamily: fontFamily.medium,
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 14,
        paddingHorizontal: 24,
    },
    grantCameraButton: {
        width: '76%',
        height: 46,
        borderRadius: 23,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4,
    },
    grantCameraGradient: {
        flex: 1,
        borderRadius: 23,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    grantCameraText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 15,
    },
    previewImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    pickPhotoContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    puzzleEmptyImage: {
        width: IS_COMPACT_HEIGHT ? 150 : 180,
        height: IS_COMPACT_HEIGHT ? 150 : 180,
        marginBottom: IS_COMPACT_HEIGHT ? -18 : -22,
    },
    pickPhotoTitle: {
        color: '#050E3E',
        fontFamily: fontFamily.bold,
        fontSize: IS_COMPACT_HEIGHT ? 17 : 19,
        fontWeight: fontWeight('700'),
        textAlign: 'center',
    },
    pickPhotoSubtitle: {
        color: '#7380A1',
        fontFamily: fontFamily.medium,
        fontSize: IS_COMPACT_HEIGHT ? 12 : 13,
        lineHeight: 18,
        textAlign: 'center',
        marginTop: 5,
    },

    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: IS_COMPACT_HEIGHT ? 24 : 30,
        marginTop: IS_COMPACT_HEIGHT ? 10 : 16,
        marginBottom: IS_COMPACT_HEIGHT ? 4 : 8,
    },
    controlItem: {
        width: 72,
        alignItems: 'center',
    },
    smallCircleButton: {
        width: IS_COMPACT_HEIGHT ? 52 : 58,
        height: IS_COMPACT_HEIGHT ? 52 : 58,
        borderRadius: IS_COMPACT_HEIGHT ? 26 : 29,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
        marginBottom: 6,
    },
    controlLabel: {
        color: '#7380A1',
        fontFamily: fontFamily.bold,
        fontSize: 12,
        fontWeight: fontWeight('600'),
        textAlign: 'center',
    },
    captureRing: {
        width: IS_COMPACT_HEIGHT ? 70 : 80,
        height: IS_COMPACT_HEIGHT ? 70 : 80,
        borderRadius: IS_COMPACT_HEIGHT ? 35 : 40,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 5,
        marginBottom: 18,
    },
    captureRingGradient: {
        flex: 1,
        borderRadius: IS_COMPACT_HEIGHT ? 35 : 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureInnerCircle: {
        width: IS_COMPACT_HEIGHT ? 56 : 64,
        height: IS_COMPACT_HEIGHT ? 56 : 64,
        borderRadius: IS_COMPACT_HEIGHT ? 28 : 32,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Footer / Send
    footer: {
        width: '100%',
        marginTop: 0,
        paddingHorizontal: 24,
        paddingBottom: IS_COMPACT_HEIGHT ? 10 : spacing.xl,
    },
    premiumActionButton: {
        minHeight: 48,
        borderRadius: 24,
        width: '100%',
        ...Platform.select({
            ios: {
                shadowColor: '#FF5E97',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
            },
            android: {
                elevation: 5,
            },
        }),
    },
    premiumActionGradient: {
        minHeight: 48,
        alignSelf: 'stretch',
        paddingHorizontal: 20,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    premiumActionButtonDisabled: {
        opacity: 0.5,
    },
    premiumActionText: {
        minWidth: 0,
        flexShrink: 1,
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'center',
    },
    premiumActionIcon: {
        flexShrink: 0,
        color: '#FFFFFF',
        fontSize: 16,
    },


    // Grid Overlay
    gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', flexWrap: 'wrap' },
    gridCell: { width: '20%', height: '20%', borderWidth: 1, borderColor: 'rgba(46, 30, 60, 0.12)' },

    // Floating pieces
    floatingPiece: { position: 'absolute', opacity: 0.3 },
    piece1: { top: 120, left: 20 },
    piece2: { top: 200, right: 30 },
    piece3: { bottom: 150, left: 50 },
});

export default JigsawCreateScreen;
