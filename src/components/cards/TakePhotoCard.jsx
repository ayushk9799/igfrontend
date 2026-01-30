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

/**
 * TakePhotoCard - Card for capturing or selecting photos
 */
const TakePhotoCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit, onSkip, isLastCard, onAnswerSubmit, isAnswered = false, previousAnswer = null }) => {
    const config = categoryConfig.takephoto;
    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);
    const [hasPermission, setHasPermission] = useState(Platform.OS === 'ios');
    const [previewUri, setPreviewUri] = useState(isAnswered ? previousAnswer : null);
    const [showCamera, setShowCamera] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Reset state when task changes, but preserve if already answered
        setPreviewUri(isAnswered ? previousAnswer : null);
        setShowCamera(false);
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

    const handleCapture = async () => {
        try {
            if (isProcessingRef.current) return;
            isProcessingRef.current = true;

            const data = await cameraRef.current?.capture();
            const source = data?.uri || (data?.path ? `file://${data.path}` : null);
            if (!source) {
                throw new Error('No image captured');
            }

            const cropResult = await ExpoImageCropTool.openCropperAsync({
                imageUri: source,
                shape: 'rectangle',
                format: 'jpeg',
                compressImageQuality: 0.9,
            });

            const out = typeof cropResult === 'string' ? cropResult : cropResult?.uri || cropResult?.path;
            if (!out) throw new Error('Cropping cancelled');
            const finalUri = out.startsWith('file://') ? out : `file://${out}`;

            setPreviewUri(finalUri);
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

            setPreviewUri(finalUri);
        } catch (e) {
            // ignore
        }
    };

    const handleRetake = () => {
        setPreviewUri(null);
    };

    const handleUsePhoto = async () => {
        if (!previewUri || isSubmitting) return;
        console.log('🎯 [TakePhotoCard] Using photo, submitting:', previewUri);
        setIsSubmitting(true);
        await onAnswerSubmit(index, previewUri);
        onSubmit(previewUri);
    };

    // Camera View
    if (showCamera && !previewUri) {
        return (
            <View style={styles.cameraContainer}>
                <Camera
                    ref={cameraRef}
                    style={styles.camera}
                    cameraType={'back'}
                    flashMode={'auto'}
                    focusMode={'on'}
                    zoomMode={'on'}
                />
                <View style={styles.cameraOverlay}>
                    <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.cameraBackBtn}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                </View>
                <View style={styles.cameraBottomBar}>
                    <TouchableOpacity onPress={handlePickFromGallery} style={styles.galleryBtn}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCapture} style={styles.captureBtn}>
                        <View style={styles.captureBtnInner} />
                    </TouchableOpacity>
                    <View style={{ width: 56 }} />
                </View>
            </View>
        );
    }

    return (
        <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
            {/* Already Answered Overlay */}
            {isAnswered && (
                <View style={styles.answeredOverlay}>
                    <View style={styles.answeredBadge}>
                        <Text style={styles.answeredEmoji}>📸</Text>
                        <Text style={styles.answeredTitle}>Photo Submitted</Text>
                        {previousAnswer && (
                            <Image
                                source={{ uri: previousAnswer }}
                                style={{ width: 120, height: 120, borderRadius: 12, marginVertical: 8 }}
                                resizeMode="cover"
                            />
                        )}
                        <Text style={styles.answeredHint}>Swipe to continue →</Text>
                    </View>
                </View>
            )}
            <View style={[styles.cardContent, isAnswered && { opacity: 0.3 }]}>
                <View style={styles.topRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
                        <Text>{config.emoji}</Text>
                        <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text>
                    </View>
                    <Text style={[styles.counterText, { color: 'white' }]}>{index + 1}/{totalCards}</Text>
                </View>

                <View style={styles.questionSection}>
                    <Text style={styles.questionText}>{task.taskstatement}</Text>
                </View>

                {previewUri ? (
                    <>
                        <View style={styles.photoPreviewContainer}>
                            <Image source={{ uri: previewUri }} style={styles.photoPreview} resizeMode="cover" />
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
                        <TouchableOpacity onPress={onSkip} style={photoStyles.skipButton}>
                            <Text style={photoStyles.skipText}>Skip</Text>
                        </TouchableOpacity>

                        {/* Camera Icon - Right */}
                        <TouchableOpacity onPress={handleOpenCamera} style={photoStyles.iconButton}>
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
});

export default TakePhotoCard;
