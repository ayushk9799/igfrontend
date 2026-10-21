import React, { useCallback, useEffect, useRef, useState } from 'react';
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
    useWindowDimensions,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, X } from 'lucide-react-native';
import BirdPickerSheet from '../components/letters/BirdPickerSheet';
import LetterSendAnimation, { getRolledScroll } from '../components/letters/LetterSendAnimation';
import LetterBirdCanvas from '../features/letterBird/LetterBirdCanvas';
import {
    PERCH_RIGHT,
    PERCH_SINK,
    PERCH_W,
    flightPose,
    perchedPose,
} from '../features/letterBird/birdChoreography';
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
// One clock for both bird surfaces so the idle pose doesn't jump when they swap.
const nowSec = () => (global.performance?.now ? global.performance.now() : Date.now()) / 1000;

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
    // Set once the letter is sent: where the paper sits, and the saved letter to hand on.
    const [flight, setFlight] = useState(null);
    const containerRef = useRef(null);
    const paperRef = useRef(null);
    const { width: screenWidth } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    // The bird is drawn in one full-screen layer so it can stretch, hover and fly above the
    // letter without being clipped by the scroll view. It follows the paper as you scroll.
    const [birdReady, setBirdReady] = useState(false);
    const [rolled, setRolled] = useState(false);
    const scrollYRef = useRef(0);
    const scrollBoxRef = useRef({ x: 0, y: 0 });
    const paperBoxRef = useRef(null);
    // When the bird first appeared: its idle routine plays once from here, then it holds still.
    const idleStartRef = useRef(null);
    const flightStartRef = useRef(null);
    const rolledRef = useRef(false);
    const finishedRef = useRef(false);

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
    const canContinue = trimmed.length > 0 && !sending && !flight;

    // Roll the letter up and let the bird carry it off, then leave the screen.
    const playSendAnimation = useCallback((letter) => {
        Keyboard.dismiss();
        const container = containerRef.current;
        const paperView = paperRef.current;
        if (reduceMotion || !container || !paperView) {
            onSent?.(letter);
            return;
        }
        container.measureInWindow((containerX, containerY) => {
            paperView.measureInWindow((paperX, paperY, width, height) => {
                if (!width || !height) {
                    onSent?.(letter);
                    return;
                }
                rolledRef.current = false;
                flightStartRef.current = null;
                finishedRef.current = false;
                setRolled(false);
                setFlight({
                    letter,
                    frame: { x: paperX - containerX, y: paperY - containerY, width, height },
                });
            });
        });
    }, [onSent, reduceMotion]);

    const finishFlight = useCallback(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        onSent?.(flight?.letter);
    }, [flight, onSent]);

    // If the 3D bird can't draw, don't keep the user waiting once the letter is rolled.
    useEffect(() => {
        if (!rolled || birdReady) return undefined;
        const timer = setTimeout(finishFlight, 700);
        return () => clearTimeout(timer);
    }, [rolled, birdReady, finishFlight]);

    // Where the perched bird stands: on the paper's top edge, towards the right.
    const perchFor = (frame) => [frame.x + frame.width - PERCH_RIGHT - PERCH_W / 2, frame.y + PERCH_SINK];

    const birdFrame = useCallback((sprite, t) => {
        if (idleStartRef.current == null) idleStartRef.current = nowSec();
        const idleT = nowSec() - idleStartRef.current;
        if (!flight) {
            // Waiting on the letter, following it as the page scrolls.
            const box = paperBoxRef.current;
            if (!box) return true;
            const frame = {
                x: scrollBoxRef.current.x + box.x,
                y: scrollBoxRef.current.y + box.y - scrollYRef.current,
                width: box.width,
            };
            const [x, y] = perchFor(frame);
            sprite.pose(perchedPose(idleT, x, y));
            return true;
        }
        const { frame } = flight;
        const perch = perchFor(frame);
        if (!rolledRef.current) {
            // Keep waiting on the letter while it rolls up.
            sprite.pose(perchedPose(idleT, perch[0], perch[1]));
            return true;
        }
        if (flightStartRef.current == null) {
            flightStartRef.current = t;
            sprite.setPaperColor(paper.stops[1]);
        }
        const { pose, done } = flightPose(
            t - flightStartRef.current,
            perch,
            getRolledScroll(frame),
            { width: screenWidth },
        );
        sprite.pose(pose);
        if (done) {
            finishFlight();
            return false;
        }
        return true;
    }, [flight, screenWidth, finishFlight, paper]);

    const submit = useCallback(async (chosenBirdId) => {
        if (!trimmed || sending) return;
        setSending(true);
        try {
            const data = await sendLetter({ body: trimmed, bird: chosenBirdId });
            trackEvent('letter_sent', { bird: chosenBirdId, length: trimmed.length });
            setSheetMode(null);
            playSendAnimation(data?.letter);
        } catch (error) {
            if (error.code === 'premium_required') {
                setSheetMode('premium');
            } else {
                Alert.alert(translateUiText('Letter not sent'), error.message || translateUiText('Please try again.'));
            }
        } finally {
            setSending(false);
        }
    }, [trimmed, sending, playSendAnimation]);

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
        <View ref={containerRef} style={[styles.container, { paddingTop: insets.top }]}>
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
                onLayout={(event) => {
                    const { x, y } = event.nativeEvent.layout;
                    scrollBoxRef.current = { x, y };
                }}
                onScroll={(event) => { scrollYRef.current = event.nativeEvent.contentOffset.y; }}
            >
                <View
                    ref={paperRef}
                    collapsable={false}
                    style={styles.paperWrap}
                    onLayout={(event) => { paperBoxRef.current = event.nativeEvent.layout; }}
                >
                    <LetterPaper paperId={paper.id} lineHeight={textSize.lineHeight} style={flight && styles.hidden}>
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
                </View>

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

            {flight ? (
                <>
                    <LetterSendAnimation
                        frame={flight.frame}
                        paperId={paper.id}
                        body={trimmed}
                        textStyle={{ fontSize: textSize.fontSize, lineHeight: textSize.lineHeight }}
                        hideScroll={rolled && birdReady}
                        onRolled={() => {
                            rolledRef.current = true;
                            setRolled(true);
                        }}
                    />
                </>
            ) : null}

            {/* The carrier waits on the letter, then carries it off. Touches pass straight through. */}
            <LetterBirdCanvas
                style={StyleSheet.absoluteFill}
                paperColor={paper.stops[1]}
                onFrame={birdFrame}
                onReady={() => setBirdReady(true)}
                onError={() => { if (rolledRef.current) finishFlight(); }}
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
    paperWrap: {
        // Room above the paper for the perched bird (fixed so the letter doesn't move
        // when the bird's size changes; the bird stands a little onto the paper instead).
        marginTop: 129,
    },
    hidden: {
        opacity: 0,
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
