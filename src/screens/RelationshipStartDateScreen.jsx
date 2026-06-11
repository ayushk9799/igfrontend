import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DatePicker } from 'react-native-wheel-pick';
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

const BackIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M15 18 9 12l6-6" stroke="#050E3E" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const RelationshipStartDateScreen = ({ onComplete, onBack, initialDate }) => {
    const [selectedDate, setSelectedDate] = useState(() => {
        if (initialDate) {
            const parsed = new Date(initialDate);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
        return today;
    });
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

    const handleDateChange = (date) => {
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
                <View style={[styles.header, { paddingTop: insets.top + 4, flexDirection: 'row', alignItems: 'center' }]}>
                    {onBack && (
                        <TouchableOpacity
                            onPress={onBack}
                            style={styles.backButton}
                            activeOpacity={0.8}
                        >
                            <BackIcon />
                        </TouchableOpacity>
                    )}
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

                        <View style={styles.nativePickerWrap}>
                            {Platform.OS === 'ios' ? (
                                <DateTimePicker
                                    value={selectedDate}
                                    mode="date"
                                    display="spinner"
                                    maximumDate={today}
                                    minimumDate={new Date(1900, 0, 1)}
                                    onChange={(event, date) => handleDateChange(date)}
                                    style={styles.nativePicker}
                                    textColor={navy}
                                />
                            ) : (
                                <>
                                    <DatePicker
                                        date={selectedDate}
                                        mode="date"
                                        maximumDate={today}
                                        minimumDate={new Date(1900, 0, 1)}
                                        onDateChange={handleDateChange}
                                        style={styles.nativePicker}
                                        textColor={navy}
                                        textSize={20}
                                        order="D-M-Y"
                                        isShowSelectBackground={false}
                                        isShowSelectLine={false}
                                    />
                                    <View style={styles.customHighlighter} pointerEvents="none" />
                                </>
                            )}
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
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
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
        top: isCompactHeight ? -30 : -20,
        width: isCompactHeight ? 230 : 280,
        height: isCompactHeight ? 270 : 330,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinkCircle: {
        position: 'absolute',
        width: isCompactHeight ? 180 : 220,
        height: isCompactHeight ? 180 : 220,
        borderRadius: isCompactHeight ? 90 : 110,
        backgroundColor: '#FFE0EE',
        opacity: 0.62,
        top: isCompactHeight ? 66 : 90,
    },
    mascotImage: {
        width: isCompactHeight ? 240 : 290,
        height: isCompactHeight ? 300 : 365,
    },
    card: {
        backgroundColor: 'transparent',
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: 24,
        paddingTop: isCompactHeight ? 10 : 16,
        paddingBottom: isCompactHeight ? 38 : 52,
        minHeight: isCompactHeight ? 356 : 424,
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
        backgroundColor: 'transparent',
    },
    customHighlighter: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: isCompactHeight ? 38 : 44,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 94, 151, 0.25)',
        backgroundColor: 'rgba(255, 94, 151, 0.06)',
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
