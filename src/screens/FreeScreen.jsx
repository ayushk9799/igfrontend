import React from 'react';
import {
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const ArrowRightIcon = () => (
    <Svg width={24} height={24} viewBox="0 0 28 28" fill="none">
        <Path d="M5 14h17M16 7l7 7-7 7" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const CloseIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
            d="M6 6l12 12M18 6L6 18"
            stroke={colors.text}
            strokeWidth={2.4}
            strokeLinecap="round"
        />
    </Svg>
);

const FreeScreen = ({ onContinue, onClose }) => {
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const isCompactHeight = height < 760;
    const mascotWidth = Math.min(width - 24, 350);
    const mascotHeight = mascotWidth * 0.8;

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            {onClose && (
                <TouchableOpacity
                    style={[styles.closeButton, { top: insets.top + 8 }]}
                    onPress={onClose}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText("Close premium offer")}
                >
                    <CloseIcon />
                </TouchableOpacity>
            )}
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + 4 },
                ]}
                showsVerticalScrollIndicator={false}
                bounces={false}
            >
                <View style={styles.brandContainer}>
                    <Image
                        source={require('../../assets/images/penguin-text-logo.png')}
                        style={[
                            styles.brandLogo,
                            isCompactHeight && styles.brandLogoCompact,
                        ]}
                        resizeMode="contain"
                    />
                </View>

                <View style={styles.mainContent}>
                    <View
                        style={[
                            styles.mascotContainer,
                            { width: mascotWidth, height: mascotHeight },
                        ]}
                    >
                        <Image
                            source={require('../../assets/images/premium-muscot.png')}
                            style={styles.mascotImage}
                            resizeMode="contain"
                        />
                    </View>

                    <View style={styles.freeContentSection}>
                        <LinearGradient
                            pointerEvents="none"
                            colors={['rgba(255, 247, 250, 0)', '#FFF7FA']}
                            style={styles.freeContentFade}
                        />

                        <View style={styles.offerContainer}>
                            <Text style={styles.offerTitle}>{translateUiText("We offer")}</Text>
                            <View style={styles.freeBadgeOuter}>
                                <LinearGradient
                                    colors={['#FF5E97', '#FFA1C9']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.freeBadge}
                                >
                                    <Text style={styles.freeBadgeText}>{translateUiText("7 Days Free")}</Text>
                                </LinearGradient>
                            </View>
                            <Text style={styles.offerSubtitle}>{translateUiTemplate("so every couple can get{{0}}closer with Penguin", ['\n'])}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: insets.bottom + 30 }] }>
                <LinearGradient
                    pointerEvents="none"
                    colors={[
                        'rgba(255, 247, 250, 0)',
                        'rgba(255, 247, 250, 0.35)',
                        '#FFF7FA',
                    ]}
                    locations={[0, 0.82, 1]}
                    style={styles.footerFade}
                />
                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={onContinue}
                    style={[
                        styles.continueButtonWrapper,
                        isCompactHeight && styles.continueButtonWrapperCompact,
                    ]}
                >
                    <LinearGradient
                        colors={['#FF5E97', '#FFA1C9']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.continueButton}
                    >
                        <Text
                            style={[
                                styles.continueButtonText,
                                isCompactHeight && styles.continueButtonTextCompact,
                            ]}
                        >{translateUiText("Continue")}</Text>
                        <View style={styles.continueArrow}>
                            <ArrowRightIcon />
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        zIndex: 10,
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: '#F4CCDD',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        paddingHorizontal: 22,
        paddingBottom: 12,
    },
    brandContainer: {
        alignSelf: 'flex-start',
        marginLeft: -2,
        marginBottom: 2,
    },
    brandLogo: {
        width: 140,
        height: 42,
    },
    brandLogoCompact: {
        width: 120,
        height: 36,
    },
    mainContent: {
        flex: 1,
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mascotContainer: {
        position: 'relative',
        maxWidth: 350,
        maxHeight: 280,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -12,
        zIndex: 2,
    },
    mascotImage: {
        width: '95.7%',
        height: '98.6%',
        zIndex: 2,
    },
    freeContentSection: {
        position: 'relative',
        zIndex: 3,
        alignSelf: 'stretch',
        marginTop: -56,
        marginHorizontal: -22,
        paddingHorizontal: 22,
        paddingTop: 0,
        paddingBottom: 18,
        backgroundColor: '#FFF7FA',
    },
    freeContentFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: -56,
        height: 56,
    },
    offerContainer: {
        alignItems: 'center',
        marginTop: 0,
    },
    offerTitle: {
        color: colors.text,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 22,
        marginBottom: 8,
    },
    freeBadgeOuter: {
        width: 170,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#FFD2E1',
        overflow: 'hidden',
    },
    freeBadge: {
        width: '100%',
        height: 40,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    freeBadgeText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 22,
        letterSpacing: 0.2,
    },
    offerSubtitle: {
        color: colors.text,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 22,
        lineHeight: 28,
        textAlign: 'center',
        marginTop: 12,
    },
    footer: {
        position: 'relative',
        zIndex: 5,
        paddingTop: 12,
        paddingHorizontal: 24,
        backgroundColor: '#FFF7FA',
    },
    footerFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: -64,
        height: 64,
    },
    continueButtonWrapper: {
        width: '100%',
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 5,
    },
    continueButtonWrapperCompact: {
        height: 44,
    },
    continueButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButtonText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 15,
    },
    continueButtonTextCompact: {
        fontSize: 14,
    },
    continueArrow: {
        position: 'absolute',
        right: 20,
    },
});

export default FreeScreen;
