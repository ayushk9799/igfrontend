import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import LetterPaper, { getLetterPaper } from './LetterPaper';
import { SCROLL_RADIUS } from '../../features/letterBird/birdChoreography';

const ROLL_MIN = 10;
const ROLL_MAX = SCROLL_RADIUS * 2;
const PACK_SCALE = 0.4;
const SCROLL_INSET = 4;

// Where the finished scroll ends up, so the 3D bird can take over from it.
export const getRolledScroll = ({ x, y, width }) => ({
    x: x + width / 2,
    y,
    length: (width - SCROLL_INSET * 2) * PACK_SCALE,
});

/**
 * The real letter rolls up from the bottom into a scroll, which is then tied with a ribbon.
 * Calls onRolled once the scroll is ready to be picked up. `hideScroll` hands it to the 3D bird.
 * `frame` is the paper's position inside this overlay's parent.
 */
const LetterSendAnimation = ({ frame, paperId, body, textStyle, hideScroll, onRolled }) => {
    const paper = getLetterPaper(paperId);
    const roll = useSharedValue(0);
    const pack = useSharedValue(0);
    const { x, y, width, height } = frame;

    useEffect(() => {
        const tie = () => {
            pack.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }, (done) => {
                if (done && onRolled) runOnJS(onRolled)();
            });
        };
        // Short wait so the bird sheet has slid away before the letter starts rolling.
        roll.value = withDelay(320, withTiming(1, { duration: 1050, easing: Easing.inOut(Easing.cubic) }, (done) => {
            if (done) runOnJS(tie)();
        }));
        // Runs once for the life of this overlay.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The paper is eaten from the bottom up as it rolls.
    const paperClipStyle = useAnimatedStyle(() => ({
        height: height * (1 - roll.value),
    }));

    const scrollStyle = useAnimatedStyle(() => {
        const thickness = interpolate(roll.value, [0, 1], [ROLL_MIN, ROLL_MAX]);
        const edge = y + height * (1 - roll.value);
        return {
            top: edge - thickness / 2,
            height: thickness,
            borderRadius: thickness / 2,
            opacity: interpolate(roll.value, [0, 0.03], [0, 1], 'clamp'),
            transform: [{ scaleX: interpolate(pack.value, [0, 1], [1, PACK_SCALE]) }],
        };
    });

    const ribbonStyle = useAnimatedStyle(() => ({
        opacity: pack.value,
    }));

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Animated.View style={[styles.paperClip, { left: x, top: y, width }, paperClipStyle]}>
                <LetterPaper paperId={paper.id} lineHeight={textStyle.lineHeight} style={{ height }}>
                    <Text style={[styles.body, textStyle, { color: paper.ink }]}>{body}</Text>
                </LetterPaper>
            </Animated.View>

            {hideScroll ? null : (
                <Animated.View style={[styles.scroll, { left: x + SCROLL_INSET, width: width - SCROLL_INSET * 2 }, scrollStyle]}>
                    <LinearGradient
                        colors={[paper.edge, paper.stops[0], paper.stops[1], paper.edge]}
                        locations={[0, 0.35, 0.7, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                    <Animated.View style={[styles.ribbon, ribbonStyle]} />
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    paperClip: {
        position: 'absolute',
        overflow: 'hidden',
    },
    body: {
        minHeight: 288,
    },
    scroll: {
        position: 'absolute',
        overflow: 'hidden',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(90, 60, 30, 0.18)',
    },
    ribbon: {
        width: 26,
        height: '100%',
        backgroundColor: '#D23F66',
    },
});

export default LetterSendAnimation;
