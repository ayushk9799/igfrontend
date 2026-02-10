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


/**
 * TakePhotoCard - Card for capturing or selecting photos
 */
const TakePhotoCard = React.memo(({ task, index, totalCards, partnerName, userName, hasPartner = false, onLinkPartner, onSubmit, onSkip, isLastCard, onAnswerSubmit, isAnswered = false, previousAnswer = null, autoAdvanceOnSubmit = true, isLocked = false, onNavigateToPremium = () => { } }) => {
    const config = categoryConfig.takephoto;
    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);
    const lastTaskIdRef = useRef(task._id);
    const [hasPermission, setHasPermission] = useState(Platform.OS === 'ios');
    const [previewUri, setPreviewUri] = useState(isAnswered ? previousAnswer : null);
    const [showCamera, setShowCamera] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cameraType, setCameraType] = useState('back');
    const [justSubmitted, setJustSubmitted] = useState(false);

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
            if (Platform.OS === 'android') {
                const result = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA
                );
                const granted = result === PermissionsAndroid.RESULTS.GRANTED;
                setHasPermission(granted);
                if (!granted) {
                    Alert.alert('Permission required', 'Please allow Camera access to take a photo.');
                    return false;
                }
                return true;
            }
            return true;
        } catch (e) {
            setHasPermission(false);
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
                Alert.alert('Permission required', 'Please allow gallery access to select a photo.');
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

        console.log('🎯 [TakePhotoCard] Using photo, uploading to S3...');
        setIsSubmitting(true);

        try {
            // Upload to S3 first
            const s3Url = await uploadImageToS3(imageUri, 'daily-photos');
            console.log('🎯 [TakePhotoCard] S3 upload complete:', s3Url);

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

    // Camera View
    if (showCamera && !previewUri) {
        return (
            <View style={styles.cameraContainer}>
                {/* Header with back button */}
                <View style={styles.cameraOverlay}>
                    <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.cameraBackBtn}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                </View>

                {/* Camera Box - Square with centered 16:9 camera */}
                <View style={photoStyles.cameraContentArea}>
                    <View style={styles.cameraBoxContainer}>
                        <Camera
                            ref={cameraRef}
                            style={styles.camera}
                            cameraType={cameraType}
                            flashMode={cameraType === 'front' ? 'off' : 'auto'}
                            focusMode={'on'}
                            zoomMode={'on'}
                        />
                    </View>
                </View>

                {/* Bottom Controls */}
                <View style={styles.cameraBottomBar}>
                    <TouchableOpacity onPress={handlePickFromGallery} style={styles.galleryBtn}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCapture} style={styles.captureBtn}>
                        <View style={styles.captureBtnInner} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleCamera} style={styles.galleryBtn}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path d="M1 4v6h6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }



    return (
        <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
            <View style={styles.cardContent}>
                <View style={styles.topRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
                        <Text style={styles.categoryText}>{config.label}</Text>
                    </View>
                </View>

                <View style={styles.questionSection}>
                    {(isAnswered || justSubmitted) && <Text style={styles.submittedText}>Submitted ✓</Text>}
                    <Text style={styles.questionText}>{task.taskstatement}</Text>
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
                                <Text style={{ color: colors.text, fontWeight: '600' }}>Retake</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleUsePhoto}
                                style={[styles.photoActionBtn, { backgroundColor: config.color }]}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={{ color: '#fff', fontWeight: '700' }}>Use Photo ✨</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
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
                )}


            </View>
        </LinearGradient>
    );
});

import { StyleSheet } from 'react-native';
import { spacing } from '../../theme';

const photoStyles = StyleSheet.create({
    bottomBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginTop: 'auto',
    },
    iconButton: {
        width: 72,
        height: 72,
        borderRadius: 34,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'center',
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
    cameraContentArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },

});

export default TakePhotoCard;
