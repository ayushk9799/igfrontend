import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Clock, Crown, X } from 'lucide-react-native';
import BirdArt from '../components/letters/BirdArt';
import PremiumBirdSheet from '../components/letters/PremiumBirdSheet';
import { sendLetter } from '../api/lettersApi';
import { fontFamily } from '../constants/fonts';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import { trackEvent } from '../utils/analytics';
import {
    LETTER_BIRDS,
    LETTER_BODY_MAX_LENGTH,
    formatArrival,
    formatTravelTime,
    getLetterBird,
} from '../utils/letters';

const ScrollContainer = KeyboardAwareScrollView || ScrollView;

const WriteLetterScreen = ({
    partnerName = 'Your partner',
    hasPremiumAccess = false,
    onClose,
    onSent,
    onPremiumPress,
}) => {
    const insets = useSafeAreaInsets();
    const [body, setBody] = useState('');
    const [birdId, setBirdId] = useState('pigeon');
    const [sending, setSending] = useState(false);
    const [premiumSheetVisible, setPremiumSheetVisible] = useState(false);

    const bird = getLetterBird(birdId);
    const trimmed = body.trim();
    const canSend = trimmed.length > 0 && !sending;
    const arrival = useMemo(
        () => formatArrival(new Date(Date.now() + bird.travelMs)),
        [bird.travelMs],
    );

    const submit = useCallback(async (chosenBirdId) => {
        if (!trimmed || sending) return;
        setSending(true);
        try {
            const data = await sendLetter({ body: trimmed, bird: chosenBirdId });
            trackEvent('letter_sent', { bird: chosenBirdId, length: trimmed.length });
            onSent?.(data.letter);
        } catch (error) {
            if (error.code === 'premium_required') {
                setPremiumSheetVisible(true);
            } else {
                Alert.alert(translateUiText('Letter not sent'), error.message || translateUiText('Please try again.'));
            }
        } finally {
            setSending(false);
        }
    }, [trimmed, sending, onSent]);

    const handleSend = () => {
        if (bird.premium && !hasPremiumAccess) {
            trackEvent('letter_premium_bird_blocked', { bird: bird.id });
            setPremiumSheetVisible(true);
            return;
        }
        submit(bird.id);
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText('Close')}
                >
                    <X size={20} color="#2E1E3C" strokeWidth={2.2} />
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.title} accessibilityRole="header">{translateUiText('New letter')}</Text>
                    <Text style={styles.subtitle}>{translateUiTemplate('To {{0}}', [partnerName])}</Text>
                </View>
            </View>

            <ScrollContainer
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
                keyboardShouldPersistTaps="handled"
                bottomOffset={24}
            >
                <Text style={styles.label} nativeID="letterLabel">{translateUiText('Your letter')}</Text>
                <View style={styles.paper}>
                    <TextInput
                        value={body}
                        onChangeText={setBody}
                        multiline
                        maxLength={LETTER_BODY_MAX_LENGTH}
                        placeholder={translateUiTemplate('Dear {{0}},', [partnerName])}
                        placeholderTextColor="#9C8FAD"
                        style={styles.input}
                        textAlignVertical="top"
                        accessibilityLabelledBy="letterLabel"
                        accessibilityLabel={translateUiText('Your letter')}
                    />
                    <Text style={styles.counter}>{body.length} / {LETTER_BODY_MAX_LENGTH}</Text>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{translateUiText('Who carries it?')}</Text>
                    <Text style={styles.sectionHint}>{translateUiText('Slower = sweeter')}</Text>
                </View>
                <View style={styles.grid}>
                    {LETTER_BIRDS.map((option) => {
                        const selected = option.id === birdId;
                        const locked = option.premium && !hasPremiumAccess;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                style={[styles.birdCard, selected && styles.birdCardSelected]}
                                onPress={() => setBirdId(option.id)}
                                activeOpacity={0.85}
                                accessibilityRole="radio"
                                accessibilityState={{ selected }}
                                accessibilityLabel={`${translateUiText(option.name)}, ${formatTravelTime(option.travelMs)}${locked ? `, ${translateUiText('Premium')}` : ''}`}
                            >
                                <View style={styles.birdCardTop}>
                                    <View style={[styles.birdTile, { backgroundColor: option.tint }]}>
                                        <BirdArt bird={option.id} size={52} />
                                    </View>
                                    {option.premium ? (
                                        <View style={styles.premiumTag}>
                                            <Crown size={12} color="#8A5A00" strokeWidth={2.4} />
                                            <Text style={styles.premiumTagText}>{translateUiText('Premium')}</Text>
                                        </View>
                                    ) : (
                                        <View style={styles.freeTag}>
                                            <Text style={styles.freeTagText}>{translateUiText('Free')}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.birdName}>{translateUiText(option.name)}</Text>
                                <Text style={[styles.birdTime, { color: option.ink }]}>{formatTravelTime(option.travelMs)}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={styles.eta}>
                    <Clock size={20} color="#6E6080" strokeWidth={2} />
                    <Text style={styles.etaText}>
                        {translateUiTemplate('{{0}} can open it {{1}}', [partnerName, arrival])}
                    </Text>
                </View>

                <TouchableOpacity
                    style={[styles.send, !canSend && styles.sendDisabled]}
                    onPress={handleSend}
                    disabled={!canSend}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canSend, busy: sending }}
                >
                    {sending ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.sendText}>
                            {translateUiTemplate('Send with {{0}}', [translateUiText(bird.name)])}
                        </Text>
                    )}
                </TouchableOpacity>
            </ScrollContainer>

            <PremiumBirdSheet
                visible={premiumSheetVisible}
                onClose={() => setPremiumSheetVisible(false)}
                onUpgrade={() => {
                    setPremiumSheetVisible(false);
                    onPremiumPress?.('letters_bird');
                }}
                onUseFreeBird={() => {
                    setPremiumSheetVisible(false);
                    setBirdId('pigeon');
                    submit('pigeon');
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF6F6',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
    },
    iconButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#F5E1FD',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        flex: 1,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: 22,
        color: '#2E1E3C',
    },
    subtitle: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        color: '#5A4C6B',
    },
    content: {
        paddingHorizontal: 20,
        paddingTop: 8,
        gap: 14,
    },
    label: {
        fontFamily: fontFamily.extraBold,
        fontSize: 14,
        color: '#4B3D5C',
    },
    paper: {
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#F1E3D3',
        backgroundColor: '#FFFDF8',
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 34,
    },
    input: {
        minHeight: 190,
        fontFamily: fontFamily.regular,
        fontSize: 16,
        lineHeight: 28,
        color: '#2E1E3C',
        padding: 0,
    },
    counter: {
        position: 'absolute',
        right: 16,
        bottom: 12,
        fontFamily: fontFamily.bold,
        fontSize: 12,
        color: '#6E6080',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    sectionTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 18,
        color: '#2E1E3C',
    },
    sectionHint: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        color: '#6E6080',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    birdCard: {
        width: '47.5%',
        flexGrow: 1,
        gap: 6,
        padding: 14,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#FAE8FF',
        backgroundColor: '#FFFFFF',
    },
    birdCardSelected: {
        borderColor: '#D23F66',
        shadowColor: '#D23F66',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
        elevation: 3,
    },
    birdCardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    birdTile: {
        width: 64,
        height: 64,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: '#FFF1D6',
    },
    premiumTagText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 11,
        color: '#8A5A00',
    },
    freeTag: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: '#E4F6EA',
    },
    freeTagText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 11,
        color: '#1F6B3A',
    },
    birdName: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        color: '#2E1E3C',
    },
    birdTime: {
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
    },
    eta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#FAE8FF',
        backgroundColor: '#FFFFFF',
    },
    etaText: {
        flex: 1,
        fontFamily: fontFamily.bold,
        fontSize: 13,
        color: '#4B3D5C',
    },
    send: {
        height: 56,
        borderRadius: 28,
        backgroundColor: '#D23F66',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    sendDisabled: {
        opacity: 0.5,
    },
    sendText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 17,
        color: '#FFFFFF',
    },
});

export default WriteLetterScreen;
