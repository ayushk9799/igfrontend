import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'react-native-camera-kit';
import * as ImagePicker from 'expo-image-picker';
import { FlipType, manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';

const normalizeUri = (value) => {
    if (!value) return null;
    return value.startsWith('file://') || value.startsWith('content://') ? value : `file://${value}`;
};

const getImageSize = (uri) => new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
});

const makeSquareAsset = async (uri, mirrorHorizontally = false) => {
    const normalizedUri = normalizeUri(uri);
    const { width, height } = await getImageSize(normalizedUri);
    const size = Math.min(width, height);
    const actions = [{
        crop: {
            originX: Math.max(0, (width - size) / 2),
            originY: Math.max(0, (height - size) / 2),
            width: size,
            height: size,
        },
    }];
    if (mirrorHorizontally) actions.push({ flip: FlipType.Horizontal });

    const result = await manipulateAsync(normalizedUri, actions, { compress: 0.9, format: SaveFormat.JPEG });

    return { uri: normalizeUri(result.uri), width: result.width, height: result.height };
};

const BackIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="m15 18-6-6 6-6" stroke="#3A2545" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const CouplePhotoCaptureScreen = ({ partnerName = 'Your partner', onBack, onSendPhoto, initialSource = 'camera' }) => {
    const cameraRef = useRef(null);
    const capturingRef = useRef(false);
    const [hasPermission, setHasPermission] = useState(null);
    const [cameraType, setCameraType] = useState('back');
    const [previewAsset, setPreviewAsset] = useState(null);
    const [isSending, setIsSending] = useState(false);

    const requestCamera = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        setHasPermission(permission.granted);
        return permission.granted;
    };

    useEffect(() => {
        if (initialSource !== 'camera') return;
        ImagePicker.getCameraPermissionsAsync()
            .then(permission => setHasPermission(permission.granted))
            .catch(() => setHasPermission(false));
    }, [initialSource]);

    const capture = async () => {
        if (capturingRef.current || !hasPermission) return;
        capturingRef.current = true;
        try {
            const result = await cameraRef.current?.capture();
            const source = result?.uri || result?.path;
            if (!source) throw new Error('No image captured');
            setPreviewAsset(await makeSquareAsset(source, cameraType === 'front'));
        } catch (error) {
            Alert.alert('Couldn’t take photo', error?.message || 'Please try again.');
        } finally {
            capturingRef.current = false;
        }
    };

    const chooseFromGallery = useCallback(async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Photo permission needed', 'Allow photo library access to choose a photo.');
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.9,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
                setPreviewAsset(await makeSquareAsset(result.assets[0].uri));
            }
        } catch (error) {
            Alert.alert('Couldn’t open photo', error?.message || 'Please try again.');
        }
    }, []);

    useEffect(() => {
        if (initialSource !== 'gallery') return;
        setHasPermission(false);
        chooseFromGallery();
    }, [chooseFromGallery, initialSource]);

    const send = async () => {
        if (!previewAsset || isSending) return;
        setIsSending(true);
        try {
            await onSendPhoto?.(previewAsset);
            onBack?.();
        } catch (error) {
            Alert.alert('Couldn’t send photo', error?.message || 'Please try again.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.screen}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={styles.backButton}><BackIcon /></TouchableOpacity>
                    <View style={styles.headerCopy}>
                        <Text style={styles.eyebrow}>PARTNER PHOTO</Text>
                        <Text style={styles.headerTitle}>A moment for {partnerName}</Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.content}>
                    <Text style={styles.title}>{previewAsset ? 'Love this one?' : 'Capture your moment'}</Text>
                    <Text style={styles.subtitle}>{previewAsset ? 'Send it when you’re ready.' : 'Keep it simple, real, and just for them.'}</Text>

                    <View style={styles.cameraShell}>
                        <LinearGradient colors={['#FF8FB8', '#C89CFF', '#8DD7FF']} style={styles.cameraBorder}>
                            <View style={styles.squareCamera}>
                                {previewAsset ? (
                                    <Image source={{ uri: previewAsset.uri }} style={styles.camera} resizeMode="cover" />
                                ) : hasPermission === true ? (
                                    <Camera
                                        ref={cameraRef}
                                        style={styles.camera}
                                        cameraType={cameraType}
                                        flashMode={cameraType === 'front' ? 'off' : 'auto'}
                                        resizeMode="cover"
                                    />
                                ) : hasPermission === false ? (
                                    <View style={styles.permissionState}>
                                        <Text style={styles.permissionTitle}>Camera access needed</Text>
                                        <Text style={styles.permissionBody}>Allow access, or choose a photo from your gallery.</Text>
                                        <TouchableOpacity onPress={requestCamera} style={styles.permissionButton}><Text style={styles.permissionButtonText}>Allow camera</Text></TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.permissionState}><ActivityIndicator color="#D94E86" size="large" /></View>
                                )}
                                <View pointerEvents="none" style={styles.cornerTopLeft} />
                                <View pointerEvents="none" style={styles.cornerTopRight} />
                                <View pointerEvents="none" style={styles.cornerBottomLeft} />
                                <View pointerEvents="none" style={styles.cornerBottomRight} />
                            </View>
                        </LinearGradient>
                    </View>

                    {previewAsset ? (
                        <View style={styles.previewActions}>
                            <TouchableOpacity disabled={isSending} onPress={() => setPreviewAsset(null)} activeOpacity={0.82} style={styles.retakeButton}>
                                <Text style={styles.retakeText}>Retake</Text>
                            </TouchableOpacity>
                            <TouchableOpacity disabled={isSending} onPress={send} activeOpacity={0.88} style={styles.sendButton}>
                                <LinearGradient colors={['#FF5E97', '#FFA1C9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sendGradient}>
                                    {isSending ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.8}
                                            style={styles.sendText}
                                        >
                                            Send to {partnerName}
                                        </Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.cameraControls}>
                            <TouchableOpacity onPress={chooseFromGallery} style={styles.sideControl}>
                                <Svg width={23} height={23} viewBox="0 0 24 24" fill="none">
                                    <Rect x="3" y="3" width="18" height="18" rx="3" stroke="#5D4265" strokeWidth={2} />
                                    <Circle cx="8.5" cy="8.5" r="1.5" fill="#5D4265" />
                                    <Path d="m4 17 5-5 4 4 3-3 4 4" stroke="#5D4265" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </TouchableOpacity>
                            <TouchableOpacity disabled={!hasPermission} onPress={capture} activeOpacity={0.82} style={styles.shutterOuter}>
                                <View style={styles.shutterInner} />
                            </TouchableOpacity>
                            <TouchableOpacity disabled={!hasPermission} onPress={() => setCameraType(value => value === 'back' ? 'front' : 'back')} style={styles.sideControl}>
                                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                    <Path d="M20 7v5h-5M4 17v-5h5M18.5 12A7 7 0 0 0 6.7 7M5.5 12a7 7 0 0 0 11.8 5" stroke="#5D4265" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
};

const cornerBase = { position: 'absolute', width: 28, height: 28, borderColor: 'rgba(255,255,255,0.9)' };

const styles = StyleSheet.create({
    screen: { flex: 1 },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
    backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#F7DDEA', elevation: 3, shadowColor: '#E482AA', shadowOpacity: 0.14, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } },
    headerCopy: { flex: 1, alignItems: 'center' },
    eyebrow: { color: '#D94E86', fontSize: 9, letterSpacing: 1.4, fontFamily: fontFamily.extraBold, fontWeight: fontWeight('800') },
    headerTitle: { color: '#39253F', fontSize: 15, marginTop: 2, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    headerSpacer: { width: 44 },
    content: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 32 },
    title: { color: '#2E1E3C', fontSize: 27, fontFamily: fontFamily.extraBold, fontWeight: fontWeight('800'), textAlign: 'center' },
    subtitle: { color: '#806E82', fontSize: 13, fontFamily: fontFamily.regular, textAlign: 'center', marginTop: 6, marginBottom: 24 },
    cameraShell: { width: '100%', maxWidth: 390, aspectRatio: 1 },
    cameraBorder: { flex: 1, borderRadius: 34, padding: 4, elevation: 9, shadowColor: '#D95C9A', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
    squareCamera: { flex: 1, borderRadius: 30, overflow: 'hidden', backgroundColor: '#2A1E30' },
    camera: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    permissionState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: '#FFF7FB' },
    permissionTitle: { color: '#39253F', fontSize: 18, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    permissionBody: { color: '#806E82', fontSize: 13, textAlign: 'center', marginTop: 7 },
    permissionButton: { marginTop: 18, backgroundColor: '#D94E86', paddingHorizontal: 19, paddingVertical: 11, borderRadius: 18 },
    permissionButtonText: { color: '#FFFFFF', fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    cornerTopLeft: { ...cornerBase, top: 16, left: 16, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
    cornerTopRight: { ...cornerBase, top: 16, right: 16, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
    cornerBottomLeft: { ...cornerBase, bottom: 16, left: 16, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 },
    cornerBottomRight: { ...cornerBase, bottom: 16, right: 16, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 },
    cameraControls: { width: '76%', maxWidth: 320, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28 },
    sideControl: { width: 50, height: 50, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.88)', borderWidth: 1, borderColor: '#F2DDE9', alignItems: 'center', justifyContent: 'center', elevation: 3 },
    shutterOuter: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#FFFFFF', borderWidth: 4, borderColor: '#F07EAA', alignItems: 'center', justifyContent: 'center', elevation: 6 },
    shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#E95D96' },
    previewActions: { width: '100%', maxWidth: 390, flexDirection: 'row', gap: 12, marginTop: 28 },
    retakeButton: { flex: 0.72, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FFD2E1', alignItems: 'center', justifyContent: 'center', shadowColor: '#D95C9A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 3 },
    retakeText: { color: '#D94E86', fontSize: 15, fontFamily: fontFamily.extraBold, fontWeight: fontWeight('800') },
    sendButton: { flex: 1.28, height: 52, borderRadius: 26, shadowColor: '#FF5E97', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 5 },
    sendGradient: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 26, overflow: 'hidden' },
    sendText: { color: '#FFFFFF', fontSize: 14, fontFamily: fontFamily.extraBold, fontWeight: fontWeight('800'), textAlign: 'center' },
});

export default CouplePhotoCaptureScreen;
