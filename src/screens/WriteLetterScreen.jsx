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
import { useSharedValue } from 'react-native-reanimated';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, X } from 'lucide-react-native';
import BirdPickerSheet from '../components/letters/BirdPickerSheet';
import LetterPaper, { getLetterPaper, getLetterTextSize } from '../components/letters/LetterPaper';
import LetterStyleControls from '../components/letters/LetterStyleControls';
import LetterSendAnimation from '../components/letters/LetterSendAnimation';
import LetterBirdCanvas from '../features/letterBird/LetterBirdCanvas';
import {
    BIRD_SIZE,
    PERCH_RIGHT,
    PERCH_SINK,
    PERCH_W,
    flightPose,
    perchedPose,
} from '../features/letterBird/birdChoreography';
import useReducedMotion from '../hooks/useReducedMotion';
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
// One clock for the bird so its idle routine doesn't jump between frames.
const nowSec = () => (global.performance?.now ? global.performance.now() : Date.now()) / 1000;
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => { const v = Math.min(1, Math.max(0, u)); return v * v * (3 - 2 * v); };
// The bird swoops in from off-screen, so its hop toward the envelope is stretched to this long.
const SWOOP = 0.95;
// How small the sealed envelope gets once the bird has it in its feet.
const CARRIED_SCALE = 0.42;

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
    const [preparingLetter, setPreparingLetter] = useState(false);
    const [pickerHeight, setPickerHeight] = useState(0);
    const preparingInFlight = useRef(false);
    const sendInFlight = useRef(false);
    const mounted = useRef(true);
    // ---- the 3D carrier bird
    // It waits on the letter while you write, hides while the letter is folded and sealed, and once
    // the send succeeds it swoops in, takes the sealed envelope and flies off with it.
    const { width: screenWidth } = useWindowDimensions();
    const reduceMotion = useReducedMotion();
    const containerRef = useRef(null);
    const envelopeRef = useRef(null);
    const scrollYRef = useRef(0);
    const scrollBoxRef = useRef({ x: 0, y: 0 });
    const paperBoxRef = useRef(null);
    const idleStartRef = useRef(null);
    const [birdReady, setBirdReady] = useState(false);
    // Set once the letter is sent: where the envelope sits, and the saved letter to hand on.
    const [flight, setFlight] = useState(null);
    const flightStartRef = useRef(null);
    const finishedRef = useRef(false);
    const carryX = useSharedValue(0);
    const carryY = useSharedValue(0);
    const carryScale = useSharedValue(1);
    const carryRotate = useSharedValue(0);
    // null while writing, 'birds' to pick a carrier, 'premium' for the upsell.
    const [sheetMode, setSheetMode] = useState(null);
    const [sizeId, setSizeId] = useState(() => getLetterTextSize(readSetting(TEXT_SIZE_KEY)).id);
    const [paperId, setPaperId] = useState(() => getLetterPaper(readSetting(PAPER_KEY)).id);
    const [controlsHeight, setControlsHeight] = useState(0);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

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
    const busy = sending || preparingLetter;
    const canContinue = trimmed.length > 0 && !busy;

    const finishFlight = useCallback((letter) => {
        if (finishedRef.current || !mounted.current) return;
        finishedRef.current = true;
        setFlight(null);
        setPreparingLetter(false);
        onSent?.(letter);
    }, [onSent]);

    // After a successful send: the bird fetches the sealed envelope. Falls back to leaving straight
    // away when motion is reduced, the bird can't draw, or the envelope can't be measured.
    const flyOff = useCallback((letter) => {
        finishedRef.current = false;
        const container = containerRef.current;
        const envelope = envelopeRef.current;
        if (reduceMotion || !birdReady || !container || !envelope) {
            finishFlight(letter);
            return;
        }
        container.measureInWindow((cx, cy) => {
            envelope.measureInWindow((ex, ey, width, height) => {
                if (!width || !height) {
                    finishFlight(letter);
                    return;
                }
                flightStartRef.current = null;
                carryX.value = 0; carryY.value = 0; carryScale.value = 1; carryRotate.value = 0;
                setFlight({ letter, envelope: { x: ex - cx, y: ey - cy, width, height } });
            });
        });
    }, [reduceMotion, birdReady, finishFlight, carryX, carryY, carryScale, carryRotate]);

    // Where the waiting bird stands: on the paper's top edge, towards the right.
    const perchFor = (frame) => [frame.x + frame.width - PERCH_RIGHT - PERCH_W / 2, frame.y + PERCH_SINK];

    const birdFrame = useCallback((sprite, t) => {
        if (!flight) {
            if (preparingLetter || !paperBoxRef.current) {
                // Out of sight while the letter is folded and sealed.
                sprite.pose(perchedPose(0, -1000, -1000));
                return true;
            }
            if (idleStartRef.current == null) idleStartRef.current = nowSec();
            const box = paperBoxRef.current;
            const frame = {
                x: scrollBoxRef.current.x + box.x,
                y: scrollBoxRef.current.y + box.y - scrollYRef.current,
                width: box.width,
            };
            const [x, y] = perchFor(frame);
            sprite.pose(perchedPose(nowSec() - idleStartRef.current, x, y));
            return true;
        }
        if (flightStartRef.current == null) flightStartRef.current = t;
        const elapsed = t - flightStartRef.current;
        // Skip the perched wind-up and stretch the hop into a swoop from the top-right corner.
        const ft = elapsed < SWOOP ? 0.3 + elapsed * (0.6 / SWOOP) : elapsed - SWOOP + 0.9;
        const env = flight.envelope;
        const grab = { x: env.x + env.width / 2, y: env.y, length: 0 };
        const start = [screenWidth + BIRD_SIZE, Math.max(40, env.y - 260)];
        const { pose, done } = flightPose(ft, start, grab, { width: screenWidth });
        // The envelope rides under its feet: follow the carried point, shrink to fit the bird.
        const held = smooth((ft - 0.94) / 0.16);
        const k = pose.size / BIRD_SIZE;
        carryX.value = pose.scroll.x - grab.x;
        carryY.value = pose.scroll.y - grab.y;
        carryScale.value = lerp(1, CARRIED_SCALE * k, held);
        carryRotate.value = pose.scroll.tilt || 0;
        sprite.pose({ ...pose, scroll: null });
        if (done) {
            finishFlight(flight.letter);
            return false;
        }
        return true;
    }, [flight, preparingLetter, screenWidth, finishFlight, carryX, carryY, carryScale, carryRotate]);

    // If the bird never drew, don't keep the user waiting on a sent letter.
    useEffect(() => {
        if (!flight) return undefined;
        const timer = setTimeout(() => finishFlight(flight.letter), 6000);
        return () => clearTimeout(timer);
    }, [flight, finishFlight]);

    const submit = useCallback(async (chosenBirdId) => {
        if (!trimmed || sendInFlight.current || preparingInFlight.current) return;
        sendInFlight.current = true;
        Keyboard.dismiss();
        setSending(true);
        try {
            const data = await sendLetter({ body: trimmed, bird: chosenBirdId });
            trackEvent('letter_sent', { bird: chosenBirdId, length: trimmed.length });
            if (!mounted.current) return;
            setSheetMode(null);
            flyOff(data?.letter);
        } catch (error) {
            if (!mounted.current) return;
            if (error.code === 'premium_required') {
                setSheetMode('premium');
            } else {
                Alert.alert(translateUiText('Letter not sent'), error.message || translateUiText('Please try again.'));
            }
        } finally {
            sendInFlight.current = false;
            if (mounted.current) setSending(false);
        }
    }, [trimmed, flyOff]);

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

    const prepareLetter = () => {
        if (!trimmed || preparingLetter || preparingInFlight.current || sendInFlight.current) return;
        preparingInFlight.current = true;
        Keyboard.dismiss();
        setPreparingLetter(true);
    };

    const openBirdPicker = useCallback(() => {
        if (!preparingInFlight.current || !mounted.current) return;
        preparingInFlight.current = false;
        trackEvent('letter_bird_picker_open', { length: trimmed.length });
        setSheetMode('birds');
    }, [trimmed]);

    const closeBirdPicker = () => {
        if (sendInFlight.current) return;
        setSheetMode(null);
        setPreparingLetter(false);
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
            <View style={styles.header} accessibilityElementsHidden={busy} importantForAccessibility={busy ? 'no-hide-descendants' : 'auto'}>
                <TouchableOpacity
                    style={styles.iconButton}
                    onPress={onClose}
                    disabled={busy}
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
                    onPress={prepareLetter}
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
                accessibilityElementsHidden={busy}
                importantForAccessibility={busy ? 'no-hide-descendants' : 'auto'}
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
                <View style={styles.paperWrap} onLayout={(event) => { paperBoxRef.current = event.nativeEvent.layout; }}>
                <LetterPaper paperId={paper.id} lineHeight={textSize.lineHeight}>
                    <TextInput
                        value={body}
                        onChangeText={setBody}
                        multiline
                        editable={!busy}
                        caretHidden={busy}
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
                pointerEvents={keyboardVisible && !busy ? 'box-none' : 'none'}
                accessibilityElementsHidden={!keyboardVisible || busy}
                importantForAccessibility={keyboardVisible && !busy ? 'auto' : 'no-hide-descendants'}
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
                onClose={closeBirdPicker}
                onHeightChange={setPickerHeight}
                onSelectBird={setBirdId}
                onSend={handleSend}
                onUpgrade={() => {
                    setSheetMode(null);
                    setPreparingLetter(false);
                    onPremiumPress?.('letters_bird');
                }}
                onUseFreeBird={() => {
                    setBirdId('pigeon');
                    setSheetMode('birds');
                    submit('pigeon');
                }}
            />
            {preparingLetter ? (
                <LetterSendAnimation
                    body={trimmed}
                    paperId={paper.id}
                    sizeId={textSize.id}
                    choosingBird={sheetMode !== null}
                    pickerHeight={pickerHeight}
                    onComplete={openBirdPicker}
                    envelopeRef={envelopeRef}
                    carry={flight ? { x: carryX, y: carryY, scale: carryScale, rotate: carryRotate } : null}
                    carryOrigin={flight ? [flight.envelope.x + flight.envelope.width / 2, flight.envelope.y] : null}
                />
            ) : null}

            {/* The 3D carrier bird, drawn over everything; touches pass straight through. */}
            <LetterBirdCanvas
                style={[StyleSheet.absoluteFill, styles.birdLayer]}
                onFrame={birdFrame}
                onReady={() => setBirdReady(true)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF6F6',
    },
    paperWrap: {
        // Room above the paper for the waiting bird.
        marginTop: 129,
    },
    birdLayer: {
        zIndex: 200,
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
        minHeight: 420,
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
