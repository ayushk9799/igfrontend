import React from 'react';
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';
import { formatRelativeTime, translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const CameraIcon = () => (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-2h4.6l1.2 2h2A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="#FFFFFF" strokeWidth={1.9} strokeLinejoin="round" />
        <Path d="M15.5 12.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" stroke="#FFFFFF" strokeWidth={1.9} />
    </Svg>
);

const timeLabel = (value) => {
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return formatRelativeTime(0, 'minute');
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 1) return formatRelativeTime(0, 'minute');
    if (minutes < 60) return formatRelativeTime(-minutes, 'minute');
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return formatRelativeTime(-hours, 'hour');
    const days = Math.floor(hours / 24);
    return formatRelativeTime(-days, 'day');
};

const CouplePhotoCard = ({
    hasPartner,
    partnerName = 'Your partner',
    partnerPhoto,
    myPhoto,
    onFindPartner,
    onOpenCapture,
    size = 160,
    borderRadius = 24,
    showCameraBadge = true,
    showCopy = true,
}) => {
    const displayPhoto = partnerPhoto;

    const handlePress = () => {
        if (!hasPartner) {
            onFindPartner?.();
            return;
        }
        onOpenCapture?.();
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={handlePress}
            style={[styles.widgetShell, { width: size, height: size, borderRadius }]}
        >
            <Image
                source={displayPhoto?.imageUrl
                    ? { uri: displayPhoto.imageUrl }
                    : require('../../assets/photo-crops-final/01-moon-sky.png')}
                style={styles.photo}
                resizeMode="cover"
            />
            {myPhoto?.imageUrl ? (
                <Image source={{ uri: myPhoto.imageUrl }} style={styles.myPhotoOverlay} resizeMode="cover" />
            ) : showCameraBadge ? (
                <View style={styles.cameraBadge}><CameraIcon /></View>
            ) : null}
            {showCopy && (
                <View style={styles.widgetCopy}>
                    <Text style={styles.widgetTitle} numberOfLines={1}>
                        {displayPhoto ? translateUiTemplate("From {{0}}", [partnerName]) : (myPhoto ? translateUiTemplate("Sent to {{0}}", [partnerName]) : translateUiText("Partner Photo"))}
                    </Text>
                    <Text style={styles.widgetSubtitle} numberOfLines={1}>
                        {(displayPhoto || myPhoto)
                            ? timeLabel((displayPhoto || myPhoto).updatedAt)
                            : (hasPartner ? translateUiText("Tap to send") : translateUiText("Connect partner"))}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    widgetShell: {
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
    myPhotoOverlay: { position: 'absolute', right: 10, top: 10, width: 46, height: 46, borderRadius: 14, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#F4EAF5' },
    cameraBadge: { position: 'absolute', right: 11, top: 11, width: 34, height: 34, borderRadius: 17, backgroundColor: '#D94E86', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)' },
    widgetCopy: { position: 'absolute', left: 13, right: 11, bottom: 12 },
    widgetTitle: { color: '#FFFFFF', fontSize: 14, lineHeight: 17, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    widgetSubtitle: { color: 'rgba(255,255,255,0.84)', fontSize: 11, lineHeight: 14, fontFamily: fontFamily.regular, marginTop: 2 },
});

export default CouplePhotoCard;
