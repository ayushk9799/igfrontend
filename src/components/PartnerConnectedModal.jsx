import React from 'react';
import {
    Image,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { fontFamily, fontWeight } from '../constants/fonts';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const ProfileCircle = ({ name, avatar, accent }) => {
    const initial = name?.trim()?.charAt(0)?.toUpperCase() || '?';

    return (
        <View style={[styles.avatarBorder, { borderColor: accent }]}>
            {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} resizeMode="cover" />
            ) : (
                <LinearGradient colors={['#FFE3EF', '#FFD0E4']} style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>{initial}</Text>
                </LinearGradient>
            )}
        </View>
    );
};

const PartnerConnectedModal = ({
    visible,
    userName,
    userAvatar,
    partnerName,
    partnerAvatar,
    onClose,
}) => {
    const displayPartnerName = partnerName?.trim() || 'Your partner';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.cardSurface}>
                        <LinearGradient
                            pointerEvents="none"
                            colors={['#FFE1EE', '#FFF6FA', '#FFFFFF']}
                            locations={[0, 0.54, 1]}
                            style={StyleSheet.absoluteFillObject}
                        />
                        <View style={[styles.glow, styles.glowLeft]} />
                        <View style={[styles.glow, styles.glowRight]} />
                        <Text style={[styles.decorativeHeart, styles.heartOne]}>♥</Text>
                        <Text style={[styles.decorativeHeart, styles.heartTwo]}>♥</Text>
                        <Text style={[styles.decorativeHeart, styles.heartThree]}>♥</Text>

                        <View style={styles.connectedBadge}>
                            <Text style={styles.connectedBadgeText}>{translateUiText("A PERFECT MATCH")}</Text>
                        </View>

                        <View style={styles.profilesRow}>
                            <ProfileCircle
                                name={userName}
                                avatar={userAvatar}
                                accent="#FFB0CE"
                            />
                            <View style={styles.heartConnector}>
                                <LinearGradient
                                    colors={['#FF4F8B', '#FF83B4']}
                                    style={styles.heartCircle}
                                >
                                    <Text style={styles.connectorHeart}>♥</Text>
                                </LinearGradient>
                            </View>
                            <ProfileCircle
                                name={displayPartnerName}
                                avatar={partnerAvatar}
                                accent="#FF6EA5"
                            />
                        </View>

                        <Text style={styles.title}>{translateUiText("You’re connected!")}</Text>
                        <Text style={styles.message}>
                            {translateUiTemplate("{{0}} is now your partner on Penguin Couple.", [displayPartnerName])}
                        </Text>

                        <View style={styles.journeyPill}>
                            <Text style={styles.journeyHeart}>💕</Text>
                            <Text style={styles.journeyText}>{translateUiText("Your couple journey starts here")}</Text>
                        </View>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={translateUiText("Start together")}
                            onPress={onClose}
                            style={({ pressed }) => [styles.buttonWrap, pressed && styles.buttonPressed]}
                        >
                            <LinearGradient
                                colors={['#FF4F8B', '#FF83B4']}
                                start={{ x: 0, y: 0.5 }}
                                end={{ x: 1, y: 0.5 }}
                                style={styles.button}
                            >
                                <Text style={styles.buttonText}>{translateUiText("Start Together")}</Text>
                                <Text style={styles.buttonArrow}>→</Text>
                            </LinearGradient>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: 'rgba(45, 20, 37, 0.58)',
    },
    card: {
        width: '100%',
        maxWidth: 390,
        borderRadius: 32,
        backgroundColor: '#FFE1EE',
        shadowColor: '#3C1C31',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.28,
        shadowRadius: 28,
        elevation: 0,
    },
    cardSurface: {
        width: '100%',
        alignSelf: 'stretch',
        alignItems: 'center',
        overflow: 'hidden',
        borderRadius: 32,
        paddingHorizontal: 24,
        paddingTop: 26,
        paddingBottom: 22,
    },
    glow: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(255, 105, 161, 0.12)',
    },
    glowLeft: {
        left: -85,
        top: 15,
    },
    glowRight: {
        right: -80,
        top: -70,
    },
    decorativeHeart: {
        position: 'absolute',
        color: '#FF78A9',
    },
    heartOne: {
        left: 33,
        top: 95,
        fontSize: 17,
        transform: [{ rotate: '-15deg' }],
    },
    heartTwo: {
        right: 34,
        top: 82,
        fontSize: 20,
        transform: [{ rotate: '12deg' }],
    },
    heartThree: {
        right: 57,
        top: 147,
        fontSize: 10,
        opacity: 0.65,
    },
    connectedBadge: {
        borderRadius: 20,
        paddingHorizontal: 13,
        paddingVertical: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.82)',
    },
    connectedBadgeText: {
        color: '#E84E86',
        fontSize: 10,
        letterSpacing: 1.25,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    profilesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 21,
        marginBottom: 20,
    },
    avatarBorder: {
        width: 91,
        height: 91,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 46,
        borderWidth: 4,
        backgroundColor: '#FFFFFF',
        shadowColor: '#D44678',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 10,
        elevation: 0,
    },
    avatar: {
        width: 79,
        height: 79,
        borderRadius: 40,
    },
    avatarFallback: {
        width: 79,
        height: 79,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 40,
    },
    avatarInitial: {
        color: '#DA477E',
        fontSize: 31,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    heartConnector: {
        zIndex: 2,
        marginHorizontal: -7,
    },
    heartCircle: {
        width: 47,
        height: 47,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 24,
        borderWidth: 4,
        borderColor: '#FFF3F8',
        shadowColor: '#FF4F8B',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.25,
        shadowRadius: 9,
        elevation: 0,
    },
    connectorHeart: {
        color: '#FFFFFF',
        fontSize: 21,
        marginTop: -1,
    },
    title: {
        color: '#2F2030',
        fontSize: 28,
        lineHeight: 34,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        textAlign: 'center',
        alignSelf: 'stretch',
    },
    message: {
        alignSelf: 'stretch',
        color: '#746573',
        fontSize: 14.5,
        lineHeight: 21,
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        textAlign: 'center',
        marginTop: 8,
    },
    partnerName: {
        color: '#3B2939',
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    journeyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        borderRadius: 16,
        paddingVertical: 11,
        paddingHorizontal: 12,
        marginTop: 18,
        backgroundColor: '#FFF0F6',
    },
    journeyHeart: {
        fontSize: 17,
        marginRight: 8,
    },
    journeyText: {
        flexShrink: 1,
        color: '#4A3343',
        fontSize: 13,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        textAlign: 'center',
    },
    buttonWrap: {
        alignSelf: 'stretch',
        marginTop: 16,
        borderRadius: 18,
        shadowColor: '#FF5C96',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.26,
        shadowRadius: 14,
        elevation: 0,
    },
    buttonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.985 }],
    },
    button: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    buttonArrow: {
        color: '#FFFFFF',
        fontSize: 23,
        lineHeight: 25,
        marginLeft: 10,
        marginTop: -1,
    },
});

export default PartnerConnectedModal;
