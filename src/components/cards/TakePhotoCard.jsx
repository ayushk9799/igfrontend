import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Image,
    Platform,
    PermissionsAndroid,
    Alert,
    ActivityIndicator,
    Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import ExpoImageCropTool from 'expo-image-crop-tool';
import { Camera } from 'react-native-camera-kit';

import { categoryConfig } from './categoryConfig';
import { cardStyles as styles } from './cardStyles';
import { colors } from '../../theme';
import { uploadImageToS3 } from '../../utils/uploadApi';
import { fontFamily } from '../../constants/fonts';


/**
 * TakePhotoCard - Card for capturing or selecting photos
 */
const TakePhotoCard = React.memo(({ task, index, displayIndex, totalCards, partnerName, userName, hasPartner = false, onLinkPartner, onSubmit, onSkip, isLastCard, onAnswerSubmit, isAnswered = false, previousAnswer = null, autoAdvanceOnSubmit = true, isLocked = false, onNavigateToPremium = () => { } }) => {
    const config = categoryConfig.takephoto;
    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);
    const lastTaskIdRef = useRef(task._id);
    const [previewUri, setPreviewUri] = useState(isAnswered ? previousAnswer : null);
    const [showCamera, setShowCamera] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cameraType, setCameraType] = useState('back');
    const [justSubmitted, setJustSubmitted] = useState(false);
    const cameraAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(cameraAnim, {
            toValue: showCamera ? 1 : 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [cameraAnim, showCamera]);

    useEffect(() => {
        // Reset state only when task ID actually changes
        if (lastTaskIdRef.current !== task._id) {
            lastTaskIdRef.current = task._id;
            setPreviewUri(isAnswered ? previousAnswer : null);
            setShowCamera(false);
        }
    }, [task._id, isAnswered, previousAnswer]);

    const requestCameraPermission = async () => {
        try {
            if (Platform.OS === 'ios') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                const granted = status === 'granted';
                if (!granted) {
                    Alert.alert('Camera Needed', 'Camera access is needed to take a photo.');
                    return false;
                }
                return true;
            }

            if (Platform.OS === 'android') {
                const result = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA
                );
                const granted = result === PermissionsAndroid.RESULTS.GRANTED;
                if (!granted) {
                    Alert.alert('Camera Needed', 'Camera access is needed to take a photo.');
                    return false;
                }
                return true;
            }
            return true;
        } catch (e) {
            return false;
        }
    };

    const handleOpenCamera = async () => {
        const granted = await requestCameraPermission();
        if (granted) {
            setShowCamera(true);
        }
    };

    const toggleCamera = () => {
        setCameraType(prev => prev === 'back' ? 'front' : 'back');
    };

    const handleCapture = async () => {
        try {
            if (isProcessingRef.current) return;
            isProcessingRef.current = true;

            const data = await cameraRef.current?.capture();
            const source = data?.uri || (data?.path ? `file://${data.path}` : null);
            if (!source) {
                throw new Error('No image captured');
            }

            const finalUri = source.startsWith('file://') ? source : `file://${source}`;

            // No cropper for camera - store with front camera flag for display mirroring
            setPreviewUri({
                uri: finalUri,
                isFrontCamera: cameraType === 'front'
            });
            setShowCamera(false);
        } catch (e) {
            // ignore
        } finally {
            isProcessingRef.current = false;
        }
    };

    const handlePickFromGallery = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Photo Library Needed', 'Photo library access is needed to choose a photo.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 1,
            });

            if (result.cancelled || result.canceled) return;
            const asset = result.assets ? result.assets[0] : result;
            const sourceUri = asset?.uri;
            if (!sourceUri) return;

            const cropResult = await ExpoImageCropTool.openCropperAsync({
                imageUri: sourceUri,
                shape: 'rectangle',
                format: 'jpeg',
                compressImageQuality: 0.9,
            });

            const out = typeof cropResult === 'string' ? cropResult : cropResult?.uri || cropResult?.path;
            if (!out) return;
            const finalUri = out.startsWith('file://') ? out : `file://${out}`;

            setPreviewUri({ uri: finalUri, isFrontCamera: false });
        } catch (e) {
            // ignore
        }
    };

    const handleRetake = () => {
        setPreviewUri(null);
    };

    const handleUsePhoto = async () => {
        if (!previewUri || isSubmitting) return;

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

        // Extract URI from object or string
        const imageUri = typeof previewUri === 'string' ? previewUri : previewUri?.uri;
        if (!imageUri) return;

        setIsSubmitting(true);

        try {
            // Upload to S3 first
            const s3Url = await uploadImageToS3(imageUri, 'daily-photos');

            await onAnswerSubmit(task.originalIndex ?? index, s3Url, 'photo');
            setJustSubmitted(true);
            // Only auto-advance if the parent screen doesn't filter answered tasks
            if (autoAdvanceOnSubmit && onSubmit) {
                // Delay swipe to show "Submitted" text first
                setTimeout(() => onSubmit(s3Url), 600);
            }
        } catch (error) {
            console.error('🎯 [TakePhotoCard] Upload failed:', error);
            Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
            setIsSubmitting(false);
        }
    };

    // Animated interpolations for crossfade
    const cardOpacity = cameraAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
    const cardScale = cameraAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] });
    const camOpacity = cameraAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const camScale = cameraAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] });

    return (
        <LinearGradient colors={['#F3EAFF', '#FCF8FF']} style={photoStyles.cardInner}>
            {/* Card Content - fades out when camera opens */}
            <Animated.View style={[photoStyles.cardContent, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}
                pointerEvents={showCamera ? 'none' : 'auto'}
            >
                <View style={photoStyles.topRow}>
                    <View style={photoStyles.categoryBadge}>
                        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                            <Path d="M4 7h3.2L9 4.5h6L16.8 7H20a2 2 0 012 2v9a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2Z" fill="#8B5CF6" />
                            <Path d="M12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7Z" fill="#FFFFFF" opacity={0.9} />
                        </Svg>
                        <Text style={photoStyles.categoryText}>{config.label}</Text>
                    </View>
                    <Text style={photoStyles.counterText}>{displayIndex || index + 1} / {totalCards}</Text>
                </View>

                <View style={photoStyles.questionSection}>
                    {(isAnswered || justSubmitted) && <Text style={styles.submittedText}>Submitted ✓</Text>}
                    <Text style={photoStyles.questionText}>{task.taskstatement}</Text>
                </View>

                {previewUri ? (
                    <>
                        <View style={styles.cameraBoxContainer}>
                            <Image
                                source={{ uri: typeof previewUri === 'string' ? previewUri : previewUri?.uri }}
                                style={[
                                    styles.previewInCameraBox,
                                    previewUri?.isFrontCamera && { transform: [{ scaleX: -1 }] }
                                ]}
                                resizeMode="cover"
                            />
                        </View>
                        <View style={styles.photoActionsRow}>
                            <TouchableOpacity onPress={handleRetake} style={[styles.photoActionBtn, { backgroundColor: colors.borderLight }]}>
                                <Text style={{ color: colors.text, fontWeight: '600', fontFamily: fontFamily.bold }}>Retake</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleUsePhoto}
                                style={[styles.photoActionBtn, { backgroundColor: config.color }]}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={{ color: '#fff', fontWeight: '700', fontFamily: fontFamily.bold }}>Use Photo ✨</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <>
                        <View style={photoStyles.illustrationFrame}>
                            <Image
                                source={require('../../../assets/daily-cards/takephoto.png')}
                                style={photoStyles.photoArtwork}
                                resizeMode="contain"
                            />
                        </View>
                        <View style={photoStyles.bottomBar}>
                        {/* Gallery Icon - Left */}
                        <TouchableOpacity onPress={handlePickFromGallery} style={photoStyles.iconButton}>
                            <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
                                <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </TouchableOpacity>

                        {/* Skip - Center */}
                        <TouchableOpacity onPress={isLocked ? onNavigateToPremium : onSkip} style={photoStyles.skipButton}>
                            <Text style={photoStyles.skipText}>Skip</Text>
                        </TouchableOpacity>

                        {/* Camera Icon - Right */}
                        <TouchableOpacity onPress={isLocked ? onNavigateToPremium : handleOpenCamera} style={photoStyles.iconButton}>
                            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </TouchableOpacity>
                        </View>

                        <View style={photoStyles.swipeHint}>
                            <Text style={photoStyles.swipeText}>Swipe to see next</Text>
                            <View style={photoStyles.swipeDot}>
                                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                                    <Path d="M9 18L15 12L9 6" stroke="#8B5CF6" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </View>
                        </View>
                    </>
                )}
            </Animated.View>

            {/* Camera Overlay - fades in when camera opens */}
            {showCamera && !previewUri && (
                <Animated.View style={[cameraStyles.cameraOverlay, { opacity: camOpacity, transform: [{ scale: camScale }] }]}>
                    {/* Header with back button */}
                    <View style={photoStyles.topRow}>
                        <TouchableOpacity onPress={() => setShowCamera(false)} style={cameraStyles.backButton}>
                            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                <Path d="M15 18l-6-6 6-6" stroke="#8B5CF6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </TouchableOpacity>
                        <Text style={cameraStyles.cameraTitle}>Take a Photo</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Camera Box */}
                    <View style={cameraStyles.cameraArea}>
                        <View style={cameraStyles.cameraBox}>
                            <Camera
                                ref={cameraRef}
                                style={cameraStyles.cameraFill}
                                cameraType={cameraType}
                                flashMode={cameraType === 'front' ? 'off' : 'auto'}
                                focusMode={'on'}
                                zoomMode={'on'}
                            />
                        </View>
                    </View>

                    {/* Bottom Controls */}
                    <View style={cameraStyles.controlsRow}>
                        <TouchableOpacity onPress={handlePickFromGallery} style={cameraStyles.controlBtn}>
                            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="#8B5CF6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleCapture} style={cameraStyles.captureBtn}>
                            <View style={cameraStyles.captureBtnInner} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={toggleCamera} style={cameraStyles.controlBtn}>
                            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                <Path d="M1 4v6h6" stroke="#8B5CF6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="#8B5CF6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            )}
        </LinearGradient>
    );
});

import { StyleSheet } from 'react-native';
import { spacing } from '../../theme';

const photoStyles = StyleSheet.create({
    cardInner: {
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#D8C4FF',
        shadowColor: '#B48CFF',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.20,
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
        borderColor: '#E8DBFF',
    },
    categoryText: {
        color: '#8B5CF6',
        fontWeight: '800',
        fontSize: 14,
        fontFamily: fontFamily.bold,
    },
    counterText: {
        color: '#17204D',
        fontWeight: '800',
        fontSize: 16,
        fontFamily: fontFamily.bold,
    },
    questionSection: {
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        marginTop: spacing.xl,
        marginBottom: spacing.lg,
    },
    questionText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#14245A',
        lineHeight: 33,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
    },
    illustrationFrame: {
        alignSelf: 'center',
        width: '84%',
        aspectRatio: 1.08,
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoArtwork: {
        width: '100%',
        height: '100%',
    },
    bottomBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
        marginTop: 'auto',
    },
    iconButton: {
        width: 72,
        height: 72,
        borderRadius: 34,
        backgroundColor: '#8B5CF6',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.20,
        shadowRadius: 14,
        elevation: 7,
    },
    skipButton: {
        paddingVertical: 12,
        paddingHorizontal: spacing.lg,
        borderRadius: 22,
        backgroundColor: '#F0E7FF',
        borderWidth: 1,
        borderColor: '#E3D4FF',
    },
    skipText: {
        color: '#8B5CF6',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: fontFamily.medium,
    },
    cameraContentArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    swipeHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingTop: spacing.xs,
    },
    swipeText: {
        color: '#9B90A6',
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
        backgroundColor: '#EFE2FF',
    },

});

const cameraStyles = StyleSheet.create({
    cameraOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8DBFF',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 8,
        elevation: 3,
    },
    cameraTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#14245A',
        fontFamily: fontFamily.extraBold,
    },
    cameraArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    cameraBox: {
        width: '100%',
        aspectRatio: 0.82,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.85)',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 8,
    },
    cameraFill: {
        flex: 1,
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.md,
    },
    controlBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.90)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E8DBFF',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4,
    },
    captureBtn: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#8B5CF6',
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.20,
        shadowRadius: 14,
        elevation: 6,
    },
    captureBtnInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#8B5CF6',
    },
});

export default TakePhotoCard;
