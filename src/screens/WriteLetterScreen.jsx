import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Keyboard,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, X } from 'lucide-react-native';
import BirdPickerSheet from '../components/letters/BirdPickerSheet';
import LetterPaper, { getLetterPaper, getLetterTextSize } from '../components/letters/LetterPaper';
import LetterStyleControls from '../components/letters/LetterStyleControls';
import { sendLetter } from '../api/lettersApi';
import { fontFamily } from '../constants/fonts';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import { trackEvent } from '../utils/analytics';
import { storage } from '../utils/authStorage';
import { LETTER_BODY_MAX_LENGTH, getLetterBird } from '../utils/letters';

const ScrollContainer = KeyboardAwareScrollView || ScrollView;
// Space between the floating controls and the top of the keyboard.
const FLOATING_GAP = 8;
const TEXT_SIZE_KEY = 'letters_text_size';
const PAPER_KEY = 'letters_paper';

const readSetting = (key) => {
    try {
        return storage.getString(key);
    } catch {
        return undefined;
    }
};

const saveSetting = (key, value) => {
    try {
        storage.set(key, value);
    } catch {
        // Losing the preference only means the default comes back next time.
    }
};

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
    // null while writing, 'birds' to pick a carrier, 'premium' for the upsell.
    const [sheetMode, setSheetMode] = useState(null);
    const [sizeId, setSizeId] = useState(() => getLetterTextSize(readSetting(TEXT_SIZE_KEY)).id);
    const [paperId, setPaperId] = useState(() => getLetterPaper(readSetting(PAPER_KEY)).id);
    const [controlsHeight, setControlsHeight] = useState(0);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const textSize = getLetterTextSize(sizeId);
    const paper = getLetterPaper(paperId);

    const trimmed = body.trim();
    const canContinue = trimmed.length > 0 && !sending;

    const submit = useCallback(async (chosenBirdId) => {
        if (!trimmed || sending) return;
        setSending(true);
        try {
            const data = await sendLetter({ body: trimmed, bird: chosenBirdId });
            trackEvent('letter_sent', { bird: chosenBirdId, length: trimmed.length });
            setSheetMode(null);
            onSent?.(data?.letter);
        } catch (error) {
            if (error.code === 'premium_required') {
                setSheetMode('premium');
            } else {
                Alert.alert(translateUiText('Letter not sent'), error.message || translateUiText('Please try again.'));
            }
        } finally {
            setSending(false);
        }
    }, [trimmed, sending, onSent]);

    const changeSize = (nextSizeId) => {
        setSizeId(nextSizeId);
        saveSetting(TEXT_SIZE_KEY, nextSizeId);
        trackEvent('letter_text_size_change', { size: nextSizeId });
    };

    const changePaper = (nextPaperId) => {
        setPaperId(nextPaperId);
        saveSetting(PAPER_KEY, nextPaperId);
        trackEvent('letter_paper_change', { paper: nextPaperId });
    };

    const styleControls = (
        <LetterStyleControls
            sizeId={textSize.id}
            paperId={paper.id}
            onSizeChange={changeSize}
            onPaperChange={changePaper}
        />
    );

    const openBirdPicker = () => {
        Keyboard.dismiss();
        trackEvent('letter_bird_picker_open', { length: trimmed.length });
        setSheetMode('birds');
    };

    const handleSend = (chosenBirdId) => {
        const bird = getLetterBird(chosenBirdId);
        if (bird.premium && !hasPremiumAccess) {
            trackEvent('letter_premium_bird_blocked', { bird: bird.id });
            setSheetMode('premium');
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
                <TouchableOpacity
                    style={[styles.send, !canContinue && styles.sendDisabled]}
                    onPress={openBirdPicker}
                    disabled={!canContinue}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText('Send')}
                    accessibilityState={{ disabled: !canContinue }}
                >
                    <Send size={16} color="#FFFFFF" strokeWidth={2.4} />
                    <Text style={styles.sendText}>{translateUiText('Send')}</Text>
                </TouchableOpacity>
            </View>

            <ScrollContainer
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: (keyboardVisible ? controlsHeight : insets.bottom) + 24 },
                ]}
                keyboardShouldPersistTaps="handled"
                bottomOffset={(keyboardVisible ? controlsHeight : 0) + 12}
            >
                <LetterPaper paperId={paper.id} lineHeight={textSize.lineHeight}>
                    <TextInput
                        value={body}
                        onChangeText={setBody}
                        multiline
                        maxLength={LETTER_BODY_MAX_LENGTH}
                        placeholder={translateUiTemplate('Dear {{0}},', [partnerName])}
                        placeholderTextColor="#9C8FAD"
                        style={[
                            styles.input,
                            {
                                fontSize: textSize.fontSize,
                                lineHeight: textSize.lineHeight,
                                color: paper.ink,
                            },
                        ]}
                        textAlignVertical="top"
                        accessibilityLabel={translateUiText('Your letter')}
                    />
                    <Text style={styles.counter}>{body.length} / {LETTER_BODY_MAX_LENGTH}</Text>
                </LetterPaper>

                {keyboardVisible ? null : styleControls}
            </ScrollContainer>

            {/* Below the letter while reading; rides on top of the keyboard while typing. */}
            {/* Stays mounted so it moves with the keyboard; only shown while the keyboard is up. */}
            <KeyboardStickyView
                style={[styles.floatingControls, !keyboardVisible && styles.floatingControlsHidden]}
                offset={{ opened: -FLOATING_GAP }}
                pointerEvents={keyboardVisible ? 'box-none' : 'none'}
                accessibilityElementsHidden={!keyboardVisible}
                importantForAccessibility={keyboardVisible ? 'auto' : 'no-hide-descendants'}
                onLayout={(event) => setControlsHeight(event.nativeEvent.layout.height + FLOATING_GAP)}
            >
                <LetterStyleControls
                    sizeId={textSize.id}
                    paperId={paper.id}
                    onSizeChange={changeSize}
                    onPaperChange={changePaper}
                    floating
                />
            </KeyboardStickyView>

            <BirdPickerSheet
                mode={sheetMode}
                birdId={birdId}
                partnerName={partnerName}
                hasPremiumAccess={hasPremiumAccess}
                sending={sending}
                onClose={() => setSheetMode(null)}
                onSelectBird={setBirdId}
                onSend={handleSend}
                onUpgrade={() => {
                    setSheetMode(null);
                    onPremiumPress?.('letters_bird');
                }}
                onUseFreeBird={() => {
                    setBirdId('pigeon');
                    setSheetMode('birds');
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
    floatingControls: {
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 0,
    },
    floatingControlsHidden: {
        opacity: 0,
    },
    input: {
        // Same blank-sheet height for every text size; smaller text just gets more rules.
        minHeight: 288,
        fontFamily: fontFamily.handwriting,
        padding: 0,
        paddingTop: 0,
    },
    counter: {
        position: 'absolute',
        right: 22,
        bottom: 16,
        fontFamily: fontFamily.bold,
        fontSize: 11,
        color: '#A08A66',
    },
    send: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 44,
        paddingHorizontal: 18,
        borderRadius: 22,
        backgroundColor: '#D23F66',
    },
    sendDisabled: {
        opacity: 0.4,
    },
    sendText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 15,
        color: '#FFFFFF',
    },
});

export default WriteLetterScreen;
