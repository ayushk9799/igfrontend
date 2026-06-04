import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';

const { width, height } = Dimensions.get('window');
const isCompactHeight = height < 760;
const navy = '#050E3E';
const today = new Date();
const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const padDatePart = (value) => String(value).padStart(2, '0');

const toDateOnlyString = (date) => {
    return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
};

const HeartIcon = () => (
    <Svg width={24} height={24} viewBox="0 0 24 24">
        <Path
            fill="#FF5E97"
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
    </Svg>
);

const RelationshipStartDateScreen = ({ onComplete }) => {
    const [selectedDate, setSelectedDate] = useState(today);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const insets = useSafeAreaInsets();

    const isValid = selectedDate <= today;
    const selectedDateLabel = useMemo(() => {
        return `${padDatePart(selectedDate.getDate())} ${monthLabels[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    }, [selectedDate]);

    const handleContinue = async () => {
        if (!isValid || isSubmitting) return;

        setIsSubmitting(true);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            await onComplete?.(toDateOnlyString(selectedDate));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDateChange = (_, date) => {
        if (!date) return;

        setSelectedDate(date);
        Haptics.selectionAsync().catch(() => {});
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={styles.gradient}
            >
                <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
                    <Image
                        source={require('../../assets/images/penguin-text-logo.png')}
                        style={styles.brandLogo}
                        resizeMode="contain"
                    />
                </View>

                <View style={styles.contentView}>
                    <View style={styles.mascotWrap}>
                        <View style={styles.pinkCircle} />
                        <Image
                            source={require('../../assets/images/nickname-mascot-transparent.png')}
                            style={styles.mascotImage}
                            resizeMode="contain"
                        />
                    </View>

                    <View style={styles.card}>
                        <View style={styles.titleContainer}>
                            <Text style={styles.title}>When did your relationship begin?</Text>
                            <Text style={styles.subtitle}>
                                Choose the day your story started.
                            </Text>
                        </View>

                        <View style={styles.selectedDatePill}>
                            <HeartIcon />
                            <Text style={styles.selectedDateText}>{selectedDateLabel}</Text>
                        </View>

                        <View style={styles.nativePickerWrap}>
                            <DateTimePicker
                                value={selectedDate}
                                mode="date"
                                display="spinner"
                                maximumDate={today}
                                minimumDate={new Date(1900, 0, 1)}
                                onChange={handleDateChange}
                                style={styles.nativePicker}
                                textColor={navy}
                            />
                        </View>

                        <View style={styles.feedbackWrap}>
                            {!isValid && (
                                <Text style={styles.errorText}>Pick a date from today or earlier.</Text>
                            )}
                        </View>

                        <TouchableOpacity
                            style={styles.continueButtonWrapper}
                            onPress={handleContinue}
                            activeOpacity={0.85}
                            disabled={!isValid || isSubmitting}
                            accessibilityRole="button"
                            accessibilityLabel="Continue"
                            accessibilityState={{ disabled: !isValid || isSubmitting, busy: isSubmitting }}
                        >
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[
                                    styles.continueButtonGradient,
                                    !isValid && styles.continueButtonDisabled,
                                ]}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={styles.continueButtonText}>Continue</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        zIndex: 10,
    },
    brandLogo: {
        width: isCompactHeight ? 107 : 123,
        height: isCompactHeight ? 34 : 39,
    },
    contentView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    mascotWrap: {
        position: 'absolute',
        alignSelf: 'center',
        top: isCompactHeight ? 66 : 82,
        width: isCompactHeight ? 270 : 330,
        height: isCompactHeight ? 310 : 380,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinkCircle: {
        position: 'absolute',
        width: isCompactHeight ? 208 : 260,
        height: isCompactHeight ? 208 : 260,
        borderRadius: isCompactHeight ? 104 : 130,
        backgroundColor: '#FFE0EE',
        opacity: 0.62,
        top: isCompactHeight ? 82 : 110,
    },
    mascotImage: {
        width: isCompactHeight ? 286 : 342,
        height: isCompactHeight ? 358 : 430,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: width * 0.6,
        borderTopRightRadius: width * 0.6,
        width: width * 1.2,
        alignSelf: 'center',
        paddingHorizontal: width * 0.15,
        paddingTop: isCompactHeight ? 78 : 96,
        paddingBottom: isCompactHeight ? 38 : 52,
        minHeight: isCompactHeight ? 356 : 424,
        overflow: 'hidden',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 5,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: isCompactHeight ? 14 : 18,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 20 : 23,
        fontWeight: fontWeight('900'),
        color: navy,
        textAlign: 'center',
        lineHeight: isCompactHeight ? 24 : 29,
    },
    subtitle: {
        fontFamily: fontFamily.bold,
        fontSize: isCompactHeight ? 14 : 16,
        color: '#7380A1',
        textAlign: 'center',
        marginTop: 10,
        fontWeight: fontWeight('600'),
    },
    selectedDatePill: {
        minHeight: isCompactHeight ? 42 : 46,
        borderRadius: 23,
        alignSelf: 'center',
        backgroundColor: '#FFF3F8',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 22,
        marginBottom: isCompactHeight ? 2 : 4,
    },
    selectedDateText: {
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 18 : 20,
        fontWeight: fontWeight('900'),
        color: navy,
    },
    nativePickerWrap: {
        width: width - 52,
        height: isCompactHeight ? 174 : 202,
        alignSelf: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        marginBottom: isCompactHeight ? 2 : 4,
    },
    nativePicker: {
        width: width - 52,
        height: isCompactHeight ? 174 : 202,
    },
    feedbackWrap: {
        minHeight: isCompactHeight ? 14 : 16,
        marginBottom: isCompactHeight ? 8 : 10,
    },
    errorText: {
        fontFamily: fontFamily.bold,
        fontSize: 12,
        color: '#D94B79',
        textAlign: 'center',
    },
    continueButtonWrapper: {
        width: width - 76,
        height: isCompactHeight ? 46 : 50,
        borderRadius: 25,
        overflow: 'hidden',
        alignSelf: 'center',
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 5,
    },
    continueButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButtonDisabled: {
        opacity: 0.45,
    },
    continueButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 16 : 18,
        fontWeight: fontWeight('800'),
        color: '#FFFFFF',
    },
});

export default RelationshipStartDateScreen;
