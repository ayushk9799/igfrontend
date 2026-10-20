import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BirdArt from './BirdArt';
import { fontFamily } from '../../constants/fonts';
import { translateUiTemplate, translateUiText } from '../../i18n/uiTranslation';
import { formatArrival, getLetterBird, getLiveProgress } from '../../utils/letters';

const LetterRow = ({ letter, partnerName, nowMs, onPress }) => {
    const bird = getLetterBird(letter.bird);
    const isOutgoing = letter.direction === 'outgoing';
    const isFlying = letter.status === 'flying';
    const isUnread = !isOutgoing && letter.status === 'delivered' && !letter.readAt;
    const title = isOutgoing
        ? translateUiTemplate('To {{0}}', [partnerName])
        : translateUiTemplate('From {{0}}', [partnerName]);
    const progress = getLiveProgress(letter, nowMs);
    const subtitle = isFlying
        ? translateUiTemplate('Lands {{0}}', [formatArrival(letter.deliverAt, new Date(nowMs))])
        : (letter.body || translateUiTemplate('Delivered {{0}}', [formatArrival(letter.deliveredAt || letter.deliverAt, new Date(nowMs))]));

    return (
        <TouchableOpacity
            style={styles.row}
            activeOpacity={0.8}
            onPress={() => onPress?.(letter.id)}
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${translateUiText(bird.name)}, ${subtitle}`}
        >
            <View style={[styles.birdTile, { backgroundColor: bird.tint }]}>
                <BirdArt bird={bird.id} size={40} />
            </View>
            <View style={styles.body}>
                <View style={styles.titleRow}>
                    <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
                        {title} · {translateUiText(bird.name)}
                    </Text>
                    {isUnread ? <View style={styles.unreadDot} /> : null}
                </View>
                {isFlying ? (
                    <>
                        <Text style={[styles.subtitle, { color: bird.ink }]} numberOfLines={1}>{subtitle}</Text>
                        <View style={[styles.track, { backgroundColor: bird.tint }]}>
                            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: bird.route }]} />
                        </View>
                    </>
                ) : (
                    <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 8,
        minHeight: 56,
    },
    birdTile: {
        width: 48,
        height: 48,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: {
        flex: 1,
        minWidth: 0,
        gap: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        flexShrink: 1,
        fontFamily: fontFamily.bold,
        fontSize: 15,
        color: '#2E1E3C',
    },
    titleUnread: {
        fontFamily: fontFamily.extraBold,
    },
    unreadDot: {
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: '#D23F66',
    },
    subtitle: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        color: '#5A4C6B',
    },
    track: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    fill: {
        height: 6,
        borderRadius: 3,
    },
});

export default LetterRow;
