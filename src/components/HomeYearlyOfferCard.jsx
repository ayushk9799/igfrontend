import React, { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { fontFamily, fontWeight } from '../constants/fonts';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const formatCountdown = remainingMs => {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export default function HomeYearlyOfferCard({
    visible,
    endsAt,
    onPress,
    onExpire,
}) {
    const [now, setNow] = useState(Date.now());
    const remainingMs = endsAt ? Math.max(0, endsAt - now) : 0;

    useEffect(() => {
        if (!visible || !endsAt) return undefined;

        const updateCountdown = () => {
            const nextNow = Date.now();
            setNow(nextNow);
            if (nextNow >= endsAt) {
                onExpire?.();
            }
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [endsAt, onExpire, visible]);

    if (!visible || remainingMs <= 0) return null;

    const countdown = formatCountdown(remainingMs);

    return (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={translateUiTemplate("Open yearly offer, {{0}} remaining", [countdown])}
            activeOpacity={0.88}
            onPress={onPress}
            style={styles.card}
        >
            <View style={styles.animationWrap}>
                <LottieView
                    source={require('../../assets/box-offer.lottie')}
                    autoPlay
                    loop
                    resizeMode="contain"
                    style={styles.lottie}
                />
            </View>
            <View style={styles.copy}>
                <Text style={styles.title}>{translateUiText("Your yearly offer")}</Text>
                <View style={styles.countdownRow}>
                    <Text style={styles.endsText}>{translateUiText("Ends in")}</Text>
                    <Text style={styles.countdownText}>{countdown}</Text>
                </View>
            </View>
            <View style={styles.arrow}>
                <Text style={styles.arrowText}>›</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        width: '100%',
        minHeight: 82,
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 22,
        backgroundColor: '#F2F8FF',
        borderWidth: 1,
        borderColor: '#CFE4FB',
        shadowColor: '#3379B8',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 11,
        elevation: 0,
    },
    animationWrap: {
        width: 72,
        height: 66,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lottie: {
        width: 88,
        height: 88,
    },
    copy: {
        flex: 1,
        marginLeft: 8,
    },
    title: {
        color: '#2E1E3C',
        fontFamily: fontFamily.bold,
        fontSize: 16,
        ...fontWeight('700'),
    },
    countdownRow: {
        marginTop: 5,
        flexDirection: 'row',
        alignItems: 'center',
    },
    endsText: {
        marginRight: 5,
        color: '#6E6874',
        fontFamily: fontFamily.medium,
        fontSize: 12,
        ...fontWeight('500'),
    },
    countdownText: {
        color: '#D45871',
        fontFamily: fontFamily.bold,
        fontSize: 12,
        letterSpacing: 0.15,
        fontVariant: ['tabular-nums'],
        ...fontWeight('700'),
    },
    arrow: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 17,
        backgroundColor: '#2F83D4',
    },
    arrowText: {
        marginTop: -2,
        color: '#FFFFFF',
        fontFamily: fontFamily.bold,
        fontSize: 27,
        lineHeight: 29,
        ...fontWeight('700'),
    },
});
