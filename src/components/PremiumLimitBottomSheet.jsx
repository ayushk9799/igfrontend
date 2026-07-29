import React, { useEffect, useRef, useState } from 'react';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
    BackHandler,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';
import { translateUiText } from '../i18n/uiTranslation';

const FEATURE_CONTENT = {
    wordle: {
        icon: '🔤',
        eyebrow: 'Wordle free limit',
        title: "You’ve used 3 free games",
        message: "Upgrade to Premium to keep creating and guessing words together.",
    },
    ticTacToe: {
        icon: '⭕',
        eyebrow: 'Tic-Tac-Toe free limit',
        title: "You’ve used 5 free games",
        message: "Upgrade to Premium for unlimited games with your partner.",
    },
    liveChat: {
        icon: '💬',
        eyebrow: 'Live Chat free limit',
        title: "Your 5 free minutes are used",
        message: "Upgrade to Premium to keep chatting live whenever you’re both here.",
    },
    drawTogether: {
        icon: '🎨',
        eyebrow: 'Draw Together free limit',
        title: "Your 3 free minutes are used",
        message: "Upgrade to Premium to keep drawing live with your partner.",
    },
};

const CloseIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
            d="M6 6l12 12M18 6L6 18"
            stroke="#4A3144"
            strokeWidth={2.4}
            strokeLinecap="round"
        />
    </Svg>
);

const PremiumLimitBottomSheet = ({
    visible,
    feature = 'liveChat',
    onClose,
    onUpgrade,
}) => {
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef(null);
    const hasPresentedRef = useRef(false);
    const [displayFeature, setDisplayFeature] = useState(feature);
    const content = FEATURE_CONTENT[displayFeature] || FEATURE_CONTENT.liveChat;

    const dismissSheet = () => {
        if (hasPresentedRef.current) {
            bottomSheetRef.current?.dismiss();
        }
    };

    const handleUpgrade = () => {
        dismissSheet();
        onUpgrade?.();
    };

    useEffect(() => {
        if (visible) {
            setDisplayFeature(feature);
            const animationFrame = requestAnimationFrame(() => {
                hasPresentedRef.current = true;
                bottomSheetRef.current?.present();
            });
            return () => cancelAnimationFrame(animationFrame);
        }

        if (hasPresentedRef.current) {
            dismissSheet();
        }
        return undefined;
    }, [feature, visible]);

    useEffect(() => {
        if (!visible) return undefined;

        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            dismissSheet();
            return true;
        });
        return () => subscription.remove();
    }, [visible]);

    const renderBackdrop = backdropProps => (
        <BottomSheetBackdrop
            {...backdropProps}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.48}
            pressBehavior="close"
            accessibilityLabel={translateUiText("Close premium limit message")}
        />
    );

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            enableDynamicSizing
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.sheetBackground}
            handleComponent={null}
            onDismiss={() => {
                hasPresentedRef.current = false;
                if (visible) onClose?.();
            }}
        >
            <BottomSheetView
                style={[
                    styles.sheet,
                    { paddingBottom: Math.max(insets.bottom, 16) + 14 },
                ]}
                accessibilityViewIsModal
            >
                <View style={styles.handle} />
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={dismissSheet}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText("Close premium limit message")}
                >
                    <CloseIcon />
                </TouchableOpacity>

                <View style={styles.iconCircle}>
                    <Text style={styles.iconText}>{content.icon}</Text>
                </View>
                <Text style={styles.eyebrow}>{translateUiText(content.eyebrow)}</Text>
                <Text style={styles.title}>{translateUiText(content.title)}</Text>
                <Text style={styles.message}>{translateUiText(content.message)}</Text>

                <TouchableOpacity
                    style={styles.upgradeButton}
                    onPress={handleUpgrade}
                    activeOpacity={0.84}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText("Upgrade to Premium")}
                >
                    <Text style={styles.upgradeButtonText}>{translateUiText("Upgrade to Premium")}</Text>
                </TouchableOpacity>
                <Text style={styles.coupleNote}>{translateUiText("One subscription unlocks Premium for both of you.")}</Text>
            </BottomSheetView>
        </BottomSheetModal>
    );
};

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: '#FFF9FC',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    sheet: {
        paddingHorizontal: 24,
        paddingTop: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F5D2E2',
        shadowColor: '#5C2945',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.16,
        shadowRadius: 22,
        elevation: 20,
    },
    handle: {
        width: 44,
        height: 5,
        borderRadius: 3,
        marginBottom: 18,
        backgroundColor: '#E7C6D5',
    },
    closeButton: {
        position: 'absolute',
        top: 18,
        right: 20,
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FCEAF2',
    },
    iconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFE1EC',
        borderWidth: 1.5,
        borderColor: '#F8C5D9',
    },
    iconText: { fontSize: 32 },
    eyebrow: {
        marginTop: 16,
        color: '#C4527E',
        fontSize: 12,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        fontFamily: fontFamily.bold,
    },
    title: {
        marginTop: 6,
        color: '#24162F',
        fontSize: 24,
        lineHeight: 30,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    message: {
        maxWidth: 340,
        marginTop: 10,
        color: '#74616F',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        fontFamily: fontFamily.medium,
    },
    upgradeButton: {
        alignSelf: 'stretch',
        minHeight: 54,
        marginTop: 24,
        borderRadius: 27,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF758F',
        shadowColor: '#D84F86',
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
        elevation: 5,
    },
    upgradeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: fontFamily.bold,
    },
    coupleNote: {
        marginTop: 12,
        color: '#9A8492',
        fontSize: 11,
        textAlign: 'center',
        fontFamily: fontFamily.medium,
    },
});

export default PremiumLimitBottomSheet;
