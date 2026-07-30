import React, { useCallback, useEffect, useRef } from 'react';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily, fontWeight } from '../constants/fonts';
import { translateUiText } from '../i18n/uiTranslation';

const TUTORIALS = {
    ios: {
        lock: {
            video: require('../../assets/videos/lockscreen_ios.mp4'),
            width: 480,
            height: 1040,
            title: 'Add a Lock Screen Widget',
            subtitle: 'Follow the video to add Penguin to your iPhone Lock Screen.',
        },
        home: {
            video: require('../../assets/videos/home-screen-widget-tutorial_ios.mp4'),
            width: 480,
            height: 1040,
            title: 'Add a Home Screen Widget',
            subtitle: 'Follow the video to add Penguin to your iPhone Home Screen.',
        },
    },
    android: {
        home: {
            video: require('../../assets/videos/android-widget-tutorial.mp4'),
            width: 480,
            height: 1066,
            title: 'Add a Home Screen Widget',
            subtitle: 'Follow the video to add Penguin to your Android Home Screen.',
        },
    },
};

const WidgetInstructionsBottomSheet = ({ visible, tutorialType = 'lock', onClose }) => {
    const insets = useSafeAreaInsets();
    const { height: screenHeight, width: screenWidth } = useWindowDimensions();
    const bottomSheetRef = useRef(null);
    const hasPresentedRef = useRef(false);
    const onCloseRef = useRef(onClose);
    const platformTutorials = TUTORIALS[Platform.OS] || TUTORIALS.ios;
    const tutorial = platformTutorials[tutorialType] || platformTutorials.home || platformTutorials.lock;

    const player = useVideoPlayer(tutorial.video, videoPlayer => {
        videoPlayer.loop = true;
        videoPlayer.muted = true;
    });

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    const requestClose = useCallback(() => {
        bottomSheetRef.current?.dismiss();
    }, []);

    useEffect(() => {
        if (visible) {
            const animationFrame = requestAnimationFrame(() => {
                hasPresentedRef.current = true;
                bottomSheetRef.current?.present();
                player.currentTime = 0;
                player.play();
            });

            return () => cancelAnimationFrame(animationFrame);
        }

        player.pause();
        if (hasPresentedRef.current) {
            requestClose();
        }
        return undefined;
    }, [player, requestClose, visible]);

    const renderBackdrop = useCallback(backdropProps => (
        <BottomSheetBackdrop
            {...backdropProps}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.55}
            pressBehavior="close"
        />
    ), []);

    const availableVideoHeight = Math.max(330, screenHeight - Math.max(insets.top, 16) - 190);
    const videoWidth = Math.min(screenWidth - 72, availableVideoHeight * (tutorial.width / tutorial.height));
    const videoHeight = videoWidth * (tutorial.height / tutorial.width);

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            enableDynamicSizing
            enablePanDownToClose
            stackBehavior="push"
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.sheetBackground}
            handleComponent={null}
            onDismiss={() => {
                player.pause();
                hasPresentedRef.current = false;
                if (visible) onCloseRef.current?.();
            }}
        >
            <BottomSheetView
                accessibilityViewIsModal
                style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}
            >
                <View style={styles.handle} />
                <Text style={styles.title}>{translateUiText(tutorial.title)}</Text>
                <Text style={styles.subtitle}>
                    {translateUiText(tutorial.subtitle)}
                </Text>

                <View style={[styles.videoFrame, { width: videoWidth, height: videoHeight }]}>
                    <VideoView
                        player={player}
                        style={StyleSheet.absoluteFill}
                        contentFit="contain"
                        nativeControls={false}
                        allowsFullscreen={false}
                        allowsPictureInPicture={false}
                    />
                </View>

                <TouchableOpacity
                    accessibilityRole="button"
                    activeOpacity={0.86}
                    onPress={requestClose}
                    style={styles.okButton}
                >
                    <LinearGradient colors={['#FF699C', '#A66DE1']} style={styles.okGradient}>
                        <Text style={styles.okButtonText}>{translateUiText('OK')}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </BottomSheetView>
        </BottomSheetModal>
    );
};

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: '#FFFCFE',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    sheet: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    handle: {
        width: 42,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#D7D0D8',
        marginBottom: 14,
    },
    title: {
        color: '#2E1E3C',
        fontSize: 19,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('800'),
        textAlign: 'center',
    },
    subtitle: {
        color: '#6E5E77',
        fontSize: 13,
        lineHeight: 18,
        fontFamily: fontFamily.regular,
        textAlign: 'center',
        marginTop: 3,
        marginBottom: 12,
    },
    videoFrame: {
        alignSelf: 'center',
        overflow: 'hidden',
        borderRadius: 20,
        backgroundColor: '#110E13',
        borderWidth: 1,
        borderColor: '#E7DDEB',
    },
    okButton: {
        width: '100%',
        height: 52,
        borderRadius: 17,
        overflow: 'hidden',
        marginTop: 14,
    },
    okGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    okButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
});

export default WidgetInstructionsBottomSheet;
