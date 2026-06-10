import React, { useMemo } from 'react';
import {
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

const BackIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M15 18 9 12l6-6" stroke="#2E1E3C" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const HeartIcon = ({ color = '#FF8AA7', size = 24 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M12 21s-7.2-4.35-9.55-8.2C.54 9.66 1.32 5.83 4.6 4.53 7.1 3.54 9.53 4.5 12 7.15c2.47-2.65 4.9-3.61 7.4-2.62 3.28 1.3 4.06 5.13 2.15 8.27C19.2 16.65 12 21 12 21z" />
    </Svg>
);

const BrushIcon = () => (
    <Svg width={25} height={25} viewBox="0 0 24 24" fill="none">
        <Path d="M9.8 17.2 21 6a2.12 2.12 0 0 0-3-3L6.8 14.2" stroke="#FF758F" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M7 14c-2.4.25-4 1.9-4 4.15C3 20.25 4.75 22 6.85 22 9.1 22 10.75 20.4 11 18" stroke="#8B5CF6" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const Avatar = ({ label, variant = 'pink', style }) => (
    <View style={[styles.avatar, variant === 'lavender' && styles.avatarLavender, style]}>
        <Text style={styles.avatarText}>{label}</Text>
    </View>
);

const TimeTogetherWidget = ({ relationshipStartDate }) => {
    const values = useMemo(() => {
        const start = relationshipStartDate ? new Date(relationshipStartDate) : null;
        const elapsed = start && !Number.isNaN(start.getTime())
            ? Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000))
            : 0;

        return {
            days: Math.floor(elapsed / 86400),
            hr: Math.floor((elapsed % 86400) / 3600),
            min: Math.floor((elapsed % 3600) / 60),
            sec: elapsed % 60,
        };
    }, [relationshipStartDate]);

    return (
        <View style={styles.timeWidgetPreview}>
            <View style={styles.timeWidgetHeader}>
                <Text style={styles.timeWidgetHeaderText}>together for</Text>
                <HeartIcon color="#FFFFFF" size={13} />
            </View>
            <View style={styles.timeRows}>
                <TimeBlock value={values.days} label="days" />
                <TimeBlock value={String(values.hr).padStart(2, '0')} label="hr" />
                <TimeBlock value={String(values.min).padStart(2, '0')} label="min" />
                <TimeBlock value={String(values.sec).padStart(2, '0')} label="sec" />
            </View>
        </View>
    );
};

const TimeBlock = ({ value, label }) => (
    <View style={styles.timeBlock}>
        <Text style={styles.timeValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.timeLabel}>{label}</Text>
    </View>
);

const LockDaysCard = ({ days }) => (
    <View style={styles.lockWidgetTile}>
        <LinearGradient colors={['#FFB8CF', '#BCA7FF', '#95D8FF']} style={styles.lockPhonePreview}>
            <Text style={styles.lockMockDate}>Tue 9 Jun</Text>
            <Text style={styles.lockMockTime}>11:44</Text>
            <View style={styles.accessoryCircle}>
                <HeartIcon size={16} color="#FFFFFF" />
                <Text style={styles.circleDaysNumber}>{days}</Text>
                <Text style={styles.circleDaysLabel}>days</Text>
            </View>
        </LinearGradient>
        <Text style={styles.widgetTileName}>Days Together</Text>
    </View>
);

const LockCountdownCard = ({ relationshipStartDate }) => (
    <View style={styles.lockWidgetTileWide}>
        <LinearGradient colors={['#B9A7FF', '#FF9EBD', '#8ED8FF']} style={styles.lockPhonePreviewWide}>
            <Text style={styles.lockMockDate}>Tue 9 Jun</Text>
            <Text style={styles.lockMockTime}>11:44</Text>
            <View style={styles.accessoryRect}>
                <TimeTogetherWidget relationshipStartDate={relationshipStartDate} />
            </View>
        </LinearGradient>
        <Text style={styles.widgetTileName}>Time Together</Text>
    </View>
);

const MiniDoubleHeart = () => (
    <View style={styles.miniHeartWrap}>
        <View style={[styles.miniHeart, styles.miniHeartBack]}>
            <HeartIcon size={14} color="rgba(255,255,255,0.92)" />
        </View>
        <View style={[styles.miniHeart, styles.miniHeartFront]}>
            <HeartIcon size={17} color="#FFFFFF" />
        </View>
    </View>
);

const LockDistanceCard = () => (
    <View style={styles.lockWidgetTileWide}>
        <LinearGradient colors={['#D4B3FF', '#9CCBFF', '#FFB3C8']} style={styles.lockPhonePreviewWide}>
            <Text style={styles.lockMockDate}>Tue 9 Jun</Text>
            <Text style={styles.lockMockTime}>11:44</Text>
            <View style={styles.distanceAccessoryRect}>
                <Text style={styles.distanceAccessoryTitle}>Our distance: 381 km</Text>
                <View style={styles.distanceAccessoryRow}>
                    <Svg width="100%" height={34} viewBox="0 0 128 34" style={styles.distanceAccessoryDots}>
                        <Path
                            d="M17 17H111"
                            stroke="#FFFFFF"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeDasharray="1 4"
                            opacity={0.9}
                        />
                    </Svg>
                    <View style={[styles.distanceMiniAvatar, styles.distanceMiniAvatarLeft]}>
                        <Text style={styles.distanceMiniAvatarText}>R</Text>
                    </View>
                    <MiniDoubleHeart />
                    <View style={[styles.distanceMiniAvatar, styles.distanceMiniAvatarRight]}>
                        <Text style={styles.distanceMiniAvatarText}>?</Text>
                    </View>
                </View>
            </View>
        </LinearGradient>
        <Text style={styles.widgetTileName}>Our Distance</Text>
    </View>
);

const DaysTogetherCard = ({ days }) => (
    <View style={styles.daysTogetherCard}>
        <LinearGradient
            colors={['rgba(255,117,143,0.22)', 'rgba(139,92,246,0.2)', 'rgba(255,255,255,0.4)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
        />
        <View style={styles.daysLeftPane}>
            <View style={styles.daysAvatars}>
                <Avatar label="R" />
                <Avatar label="?" variant="lavender" style={styles.overlapAvatar} />
            </View>
            <Text style={styles.daysTogetherNumber}>{days} days</Text>
            <Text style={styles.daysTogetherText}>together</Text>
        </View>
        <View style={styles.anniversaryPhoto}>
            <HeartIcon size={24} color="#FFFFFF" />
            <Text style={styles.anniversaryText}>Anniversary</Text>
        </View>
    </View>
);

const ScribbleCard = () => (
    <View style={styles.scribbleCard}>
        <BrushIcon />
        <Svg width="100%" height="100%" viewBox="0 0 260 120" style={styles.scribbleLine}>
            <Path
                d="M18 74 C42 20 77 104 106 53 S174 38 197 77 S236 93 248 39"
                stroke="#FF758F"
                strokeWidth={9}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
            <Path
                d="M45 88 C87 44 130 105 177 52"
                stroke="#8B5CF6"
                strokeWidth={7}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </Svg>
    </View>
);

export const WidgetsLibraryScreen = ({
    userData = {},
    onBack,
}) => {
    const insets = useSafeAreaInsets();
    const relationshipStartDate = userData.relationshipStartDate ||
        userData.pendingRelationshipStartDate ||
        userData.connectionDate;
    const primaryWidgetSectionTitle = Platform.OS === 'ios' ? 'Lock screen' : 'Home screen';
    const showSeparateHomeSectionTitle = Platform.OS === 'ios';

    const daysTogether = useMemo(() => {
        const start = relationshipStartDate ? new Date(relationshipStartDate) : null;
        if (!start || Number.isNaN(start.getTime())) {
            return 0;
        }
        return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
    }, [relationshipStartDate]);

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#FFF6F6', '#FFF0F5', '#F5F3FF', '#EAF7FF']}
                locations={[0, 0.38, 0.72, 1]}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.gradient}
            >
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 34 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={onBack}
                            activeOpacity={0.8}
                        >
                            <BackIcon />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>{primaryWidgetSectionTitle}</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalShelf}
                    >
                        <LockDaysCard days={daysTogether} />
                        <LockCountdownCard relationshipStartDate={relationshipStartDate} />
                        <LockDistanceCard />
                    </ScrollView>

                    {showSeparateHomeSectionTitle && (
                        <Text style={[styles.sectionTitle, styles.homeTitle]}>Home screen</Text>
                    )}
                    <Text style={[
                        styles.subsectionTitle,
                        !showSeparateHomeSectionTitle && styles.subsectionTitleAfterShelf,
                    ]}>Days Together</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizontalShelf}
                    >
                        <DaysTogetherCard days={daysTogether} />
                        <ScribbleCard />
                    </ScrollView>
                </ScrollView>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.background,
    },
    gradient: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        marginRight: 12,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: '#F7DDEA',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FFB5D0',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 3,
    },
    content: {
        paddingHorizontal: 20,
    },
    sectionTitle: {
        marginBottom: 10,
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    homeTitle: {
        marginTop: 26,
        marginBottom: 10,
    },
    subsectionTitle: {
        marginTop: 4,
        marginBottom: 10,
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0,
    },
    subsectionTitleAfterShelf: {
        marginTop: 26,
    },
    horizontalShelf: {
        paddingRight: 4,
        gap: 10,
    },
    lockWidgetTile: {
        width: 122,
        padding: 8,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderWidth: 1,
        borderColor: 'rgba(255,117,143,0.16)',
        shadowColor: '#FFB5D0',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
        elevation: 3,
    },
    lockWidgetTileWide: {
        width: 202,
        padding: 8,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderWidth: 1,
        borderColor: 'rgba(192,132,252,0.16)',
        shadowColor: '#C084FC',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
        elevation: 3,
    },
    lockPhonePreview: {
        height: 136,
        borderRadius: 16,
        overflow: 'hidden',
        alignItems: 'center',
        paddingTop: 12,
    },
    lockPhonePreviewWide: {
        height: 136,
        borderRadius: 16,
        overflow: 'hidden',
        alignItems: 'center',
        paddingTop: 12,
    },
    lockMockDate: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    lockMockTime: {
        marginTop: 1,
        color: 'rgba(255,255,255,0.92)',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 0,
        lineHeight: 29,
    },
    widgetTileName: {
        marginTop: 8,
        color: colors.text,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0,
    },
    accessoryCircle: {
        marginTop: 7,
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(46,30,60,0.38)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    circleDaysNumber: {
        marginTop: 1,
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0,
    },
    circleDaysLabel: {
        color: 'rgba(255,255,255,0.86)',
        fontSize: 8,
        fontWeight: '800',
    },
    accessoryRect: {
        marginTop: 7,
        width: 154,
        minHeight: 44,
        borderRadius: 13,
        backgroundColor: 'rgba(46,30,60,0.36)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    distanceAccessoryRect: {
        marginTop: 7,
        width: 154,
        minHeight: 48,
        borderRadius: 13,
        backgroundColor: 'rgba(46,30,60,0.34)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    distanceAccessoryTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0,
    },
    distanceAccessoryRow: {
        marginTop: 4,
        width: 128,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceAccessoryDots: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    distanceMiniAvatar: {
        position: 'absolute',
        top: 0,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceMiniAvatarLeft: {
        left: 0,
    },
    distanceMiniAvatarRight: {
        right: 0,
    },
    distanceMiniAvatarText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: 0,
    },
    miniHeartWrap: {
        position: 'absolute',
        top: 7,
        left: 53,
        width: 22,
        height: 19,
    },
    miniHeart: {
        position: 'absolute',
        shadowColor: '#000000',
        shadowOpacity: 0.28,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        elevation: 2,
    },
    miniHeartBack: {
        left: 9,
        top: -3,
    },
    miniHeartFront: {
        left: 0,
        top: 1,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF4F8',
        borderWidth: 2,
        borderColor: '#FFD0DE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLavender: {
        backgroundColor: '#F3EAFF',
        borderColor: '#DDC4FF',
    },
    avatarText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: '900',
    },
    timeWidgetPreview: {
        minWidth: 130,
        alignItems: 'center',
    },
    timeWidgetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 4,
    },
    timeWidgetHeaderText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    timeRows: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 6,
    },
    timeBlock: {
        alignItems: 'center',
        minWidth: 27,
    },
    timeValue: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0,
        lineHeight: 17,
    },
    timeLabel: {
        marginTop: 1,
        color: 'rgba(255,255,255,0.82)',
        fontSize: 8,
        fontWeight: '800',
    },
    overlapAvatar: {
        marginLeft: -8,
    },
    daysTogetherCard: {
        width: 250,
        height: 128,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        flexDirection: 'row',
    },
    daysLeftPane: {
        width: 104,
        alignItems: 'center',
        justifyContent: 'center',
    },
    daysAvatars: {
        flexDirection: 'row',
        marginBottom: 7,
    },
    daysTogetherNumber: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0,
    },
    daysTogetherText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0,
    },
    anniversaryPhoto: {
        flex: 1,
        margin: 10,
        borderRadius: 14,
        backgroundColor: colors.primary,
        overflow: 'hidden',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        padding: 10,
    },
    anniversaryText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0,
    },
    scribbleCard: {
        width: 162,
        height: 128,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.88)',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scribbleLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 45,
    },
});

export default WidgetsLibraryScreen;
