import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export const LETTER_LINE_HEIGHT = 30;

const EDGE_INSET = 6;
const EDGE_STEP = 5;
const EDGE_DEPTH = 2.6;
const PAD_TOP = 24;
const PAD_BOTTOM = 40;
const PAD_LEFT = 52;
const PAD_RIGHT = 22;
const MARGIN_X = 40;
// Ruled line sits just under the text baseline inside each line box.
const RULE_OFFSET = 6;

// Fixed seed so the edge keeps its shape across re-renders.
const seededRandom = (seed) => {
    let step = seed;
    return () => {
        step += 1;
        const value = Math.sin(step * 12.9898 + seed * 78.233) * 43758.5453;
        return value - Math.floor(value);
    };
};

// Deckled outline: every edge wobbles inward by up to EDGE_DEPTH.
export const buildDeckledPath = (width, height, seed = 7) => {
    const rand = seededRandom(seed);
    const jitter = () => rand() * EDGE_DEPTH;
    const left = EDGE_INSET;
    const top = EDGE_INSET;
    const right = width - EDGE_INSET;
    const bottom = height - EDGE_INSET;
    const points = [];
    for (let x = left; x < right; x += EDGE_STEP) points.push([x, top + jitter()]);
    for (let y = top; y < bottom; y += EDGE_STEP) points.push([right - jitter(), y]);
    for (let x = right; x > left; x -= EDGE_STEP) points.push([x, bottom - jitter()]);
    for (let y = bottom; y > top; y -= EDGE_STEP) points.push([left + jitter(), y]);
    return `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L')}Z`;
};

const buildSpecks = (width, height, seed = 11) => {
    const rand = seededRandom(seed);
    const count = Math.round((width * height) / 2600);
    return Array.from({ length: count }, (_, index) => ({
        key: index,
        cx: EDGE_INSET + rand() * (width - EDGE_INSET * 2),
        cy: EDGE_INSET + rand() * (height - EDGE_INSET * 2),
        r: 0.4 + rand() * 0.9,
        opacity: 0.08 + rand() * 0.12,
    }));
};

const LetterPaper = ({ children, style }) => {
    const [size, setSize] = useState(null);

    const art = useMemo(() => {
        if (!size) return null;
        const { width, height } = size;
        const ruleCount = Math.max(0, Math.floor((height - PAD_TOP - PAD_BOTTOM + RULE_OFFSET) / LETTER_LINE_HEIGHT));
        return {
            outline: buildDeckledPath(width, height),
            specks: buildSpecks(width, height),
            rules: Array.from({ length: ruleCount }, (_, index) => (
                PAD_TOP + (index + 1) * LETTER_LINE_HEIGHT - RULE_OFFSET
            )),
        };
    }, [size]);

    const handleLayout = ({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        if (size?.width === width && size?.height === height) return;
        setSize({ width, height });
    };

    return (
        <View style={[styles.container, style]} onLayout={handleLayout}>
            {art ? (
                <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Defs>
                        <RadialGradient id="letterPaperFill" cx="0.5" cy="0.42" r="0.75">
                            <Stop offset="0" stopColor="#FFF9EC" />
                            <Stop offset="0.7" stopColor="#F7EBD2" />
                            <Stop offset="1" stopColor="#EDD9B2" />
                        </RadialGradient>
                    </Defs>
                    <Path d={art.outline} fill="#6B3F14" opacity={0.08} translateY={4} />
                    <Path d={art.outline} fill="#6B3F14" opacity={0.1} translateY={1.5} />
                    <Path d={art.outline} fill="url(#letterPaperFill)" stroke="#D8BF92" strokeWidth={1} strokeOpacity={0.7} />
                    {art.specks.map(({ key, ...speck }) => (
                        <Circle key={key} {...speck} fill="#8A6332" />
                    ))}
                    {art.rules.map((y) => (
                        <Rect
                            key={y}
                            x={EDGE_INSET + 10}
                            y={y}
                            width={size.width - EDGE_INSET * 2 - 20}
                            height={1}
                            fill="#B9CBDD"
                            opacity={0.85}
                        />
                    ))}
                    <Rect
                        x={MARGIN_X}
                        y={EDGE_INSET + 4}
                        width={1.2}
                        height={size.height - EDGE_INSET * 2 - 8}
                        fill="#E39A9A"
                        opacity={0.8}
                    />
                </Svg>
            ) : null}
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: PAD_TOP,
        paddingBottom: PAD_BOTTOM,
        paddingLeft: PAD_LEFT,
        paddingRight: PAD_RIGHT,
    },
});

export default LetterPaper;
