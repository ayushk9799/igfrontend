import React from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';

const CameraIcon = () => (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-2h4.6l1.2 2h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="#FFFFFF" strokeWidth={1.9} strokeLinejoin="round" />
        <Path d="M15.5 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" stroke="#FFFFFF" strokeWidth={1.9} />
    </Svg>
);

const timeLabel = (value) => {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return 'just now';
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'yesterday' : `${days}d ago`;
};

const CouplePhotoCard = ({
    hasPartner,
    partnerName = 'Your partner',
    partnerPhoto,
    myPhoto,
    onFindPartner,
    onOpenCapture,
}) => {
    const displayPhoto = partnerPhoto || myPhoto;
    const isIncoming = Boolean(partnerPhoto);

    const handlePress = () => {
        if (!hasPartner) {
            onFindPartner?.();
            return;
        }
        onOpenCapture?.();
    };

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={handlePress} style={styles.widgetShell}>
            <Image
                source={displayPhoto?.imageUrl
                    ? { uri: displayPhoto.imageUrl }
                    : require('../../assets/images/1_timeline.png')}
                style={styles.photo}
                resizeMode="cover"
            />
            <LinearGradient colors={['rgba(20,8,26,0.02)', 'rgba(20,8,26,0.82)']} style={StyleSheet.absoluteFill} />
            <View style={styles.cameraBadge}><CameraIcon /></View>
            <View style={styles.widgetCopy}>
                <Text style={styles.widgetTitle} numberOfLines={1}>
                    {displayPhoto ? (isIncoming ? `From ${partnerName}` : `Sent to ${partnerName}`) : 'Partner Photo'}
                </Text>
                <Text style={styles.widgetSubtitle} numberOfLines={1}>
                    {displayPhoto ? timeLabel(displayPhoto.updatedAt) : (hasPartner ? 'Tap to send' : 'Connect partner')}
                </Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    widgetShell: {
        width: 160,
        height: 160,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#F4EAF5',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        ...Platform.select({
            ios: { shadowColor: '#8D5270', shadowOpacity: 0.23, shadowRadius: 15, shadowOffset: { width: 0, height: 9 } },
            android: { elevation: 8 },
        }),
    },
    photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
    cameraBadge: { position: 'absolute', right: 11, top: 11, width: 34, height: 34, borderRadius: 17, backgroundColor: '#D94E86', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
    widgetCopy: { position: 'absolute', left: 13, right: 11, bottom: 12 },
    widgetTitle: { color: '#FFFFFF', fontSize: 14, lineHeight: 17, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    widgetSubtitle: { color: 'rgba(255,255,255,0.84)', fontSize: 11, lineHeight: 14, fontFamily: fontFamily.regular, marginTop: 2 },
});

export default CouplePhotoCard;
