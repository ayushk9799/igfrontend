// Edit Profile Screen - Update user name, age, gender
import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Animated,
    Alert,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { API_BASE } from '../constants/Api';
import { updateUser, getUser } from '../utils/authStorage';
import boyImage from '../../assets/boy.png';
import girlImage from '../../assets/girl.png';

const IMAGE_SIZE = 80;

export const EditProfileScreen = ({
    userData = {},
    onSave = () => { },
    onBack = () => { },
}) => {
    const [name, setName] = useState(userData.name || '');
    const [age, setAge] = useState(userData.age ? String(userData.age) : '');
    const [gender, setGender] = useState(userData.gender || 'male');
    const [isSaving, setIsSaving] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Name Required', 'Please enter your name');
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch(`${API_BASE}/api/user/profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userData.id,
                    name: name.trim(),
                    age: age ? parseInt(age, 10) : null,
                    gender,
                }),
            });

            const data = await response.json();

            if (data.success) {
                // Update local storage
                updateUser({
                    name: data.user.name,
                    age: data.user.age,
                    gender: data.user.gender,
                });

                Alert.alert('Profile Updated', 'Your changes have been saved!', [
                    { text: 'OK', onPress: () => onSave(data.user) },
                ]);
            } else {
                Alert.alert('Error', data.error || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            Alert.alert('Error', 'Network error. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <GradientBackground variant="warm">
            <KeyboardAwareScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: insets.top + spacing.md,
                        paddingBottom: insets.bottom + spacing.xl
                    }
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={onBack}
                        activeOpacity={0.7}
                    >
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M15 18l-6-6 6-6"
                                stroke={colors.text}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <View style={styles.headerSpacer} />
                </Animated.View>

                {/* Profile Picture Preview */}
                <Animated.View style={[styles.avatarSection, { opacity: fadeAnim }]}>
                    <LinearGradient
                        colors={[colors.primary + '30', colors.secondary + '20']}
                        style={styles.avatarLarge}
                    >
                        <Image
                            source={gender === 'female' ? girlImage : boyImage}
                            style={styles.avatarImage}
                            resizeMode="contain"
                        />
                    </LinearGradient>
                </Animated.View>

                {/* Form Fields */}
                <Animated.View style={[styles.formSection, { opacity: fadeAnim }]}>
                    {/* Name Field */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Name</Text>
                        <TextInput
                            style={styles.textInput}
                            value={name}
                            onChangeText={setName}
                            placeholder="Enter your name"
                            placeholderTextColor={colors.textMuted}
                            autoCapitalize="words"
                            autoCorrect={false}
                        />
                    </View>

                    {/* Age Field */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Age</Text>
                        <TextInput
                            style={styles.textInput}
                            value={age}
                            onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ''))}
                            placeholder="Enter your age"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="number-pad"
                            maxLength={3}
                        />
                    </View>

                    {/* Gender Selection */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Gender</Text>
                        <View style={styles.genderRow}>
                            <TouchableOpacity
                                style={[
                                    styles.genderOption,
                                    gender === 'male' && styles.genderOptionSelected,
                                ]}
                                onPress={() => setGender('male')}
                                activeOpacity={0.8}
                            >
                                <Image source={boyImage} style={styles.genderImage} resizeMode="contain" />
                                <Text style={[
                                    styles.genderLabel,
                                    gender === 'male' && styles.genderLabelSelected
                                ]}>
                                    Male
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.genderOption,
                                    gender === 'female' && styles.genderOptionSelected,
                                ]}
                                onPress={() => setGender('female')}
                                activeOpacity={0.8}
                            >
                                <Image source={girlImage} style={styles.genderImage} resizeMode="contain" />
                                <Text style={[
                                    styles.genderLabel,
                                    gender === 'female' && styles.genderLabelSelected
                                ]}>
                                    Female
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>

                {/* Save Button */}
                <View style={styles.buttonContainer}>
                    <Button
                        title={isSaving ? 'Saving...' : 'Save Changes'}
                        onPress={handleSave}
                        variant="primary"
                        size="lg"
                        fullWidth
                        disabled={isSaving || !name.trim()}
                    />
                    {isSaving && (
                        <ActivityIndicator
                            size="small"
                            color={colors.primary}
                            style={styles.loadingIndicator}
                        />
                    )}
                </View>
            </KeyboardAwareScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 44,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    avatarLarge: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.md,
    },
    avatarImage: {
        width: 100,
        height: 100,
    },
    formSection: {
        flex: 1,
    },
    inputGroup: {
        marginBottom: spacing.lg,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        marginLeft: spacing.xs,
    },
    textInput: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        fontSize: 16,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    genderRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    genderOption: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.borderLight,
    },
    genderOptionSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    genderImage: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        marginBottom: spacing.sm,
    },
    genderLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    genderLabelSelected: {
        color: colors.primary,
    },
    buttonContainer: {
        marginTop: spacing.xl,
        marginBottom: spacing.lg,
    },
    loadingIndicator: {
        position: 'absolute',
        right: spacing.lg,
        top: '50%',
        marginTop: -10,
    },
});

export default EditProfileScreen;
