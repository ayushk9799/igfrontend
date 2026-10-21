import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

// Each size keeps its own ruled-line spacing so the writing stays on the lines.
export const LETTER_TEXT_SIZES = [
    { id: 'small', label: 'Small', fontSize: 19, lineHeight: 26 },
    { id: 'medium', label: 'Medium', fontSize: 23, lineHeight: 30 },
    { id: 'large', label: 'Large', fontSize: 28, lineHeight: 36 },
];

// `pattern` is what's printed on the sheet: lined or plain.
// `texture` scales the grain: extra specks, paper fibres and soft mottling.
export const LETTER_PAPERS = [
    {
        id: 'cream',
        label: 'Lined',
        pattern: 'lined',
        stops: ['#FFF9EC', '#F7EBD2', '#EDD9B2'],
        edge: '#D8BF92',
        shadow: '#6B3F14',
        speck: '#8A6332',
        rule: '#B9CBDD',
        margin: '#E39A9A',
        ink: '#24345E',
    },
    {
        id: 'white',
        label: 'Plain',
        pattern: 'plain',
        stops: ['#FFFFFF', '#FCFBF8', '#F1EEE8'],
        edge: '#DDD8CF',
        shadow: '#3A3348',
        speck: '#8C8578',
        fiber: '#9A938A',
        mottle: '#E2DACB',
        texture: { specks: 2.4, fibers: 1, mottle: 1 },
        rule: '#C5D3E2',
        margin: '#EBA5A5',
        ink: '#1F2B4D',
    },
    {
        id: 'blush',
        label: 'Blush',
        pattern: 'lined',
        stops: ['#FFF5F7', '#FDE7EC', '#F6D3DC'],
        edge: '#EBBCC8',
        shadow: '#7A2440',
        speck: '#B0607A',
        fiber: '#C47A92',
        mottle: '#F0BFCC',
        texture: { specks: 2.2, fibers: 1, mottle: 1 },
        rule: '#EFC3CF',
        margin: '#D9829B',
        ink: '#5B2A4E',
    },
    {
        id: 'parchment',
        label: 'Parchment',
        pattern: 'plain',
        stops: ['#F7EBCF', '#EBD7A9', '#D9BB7D'],
        edge: '#BF9A5A',
        shadow: '#5A3608',
        speck: '#7A5320',
        rule: '#CDB37F',
        margin: '#C47F5A',
        ink: '#4A2E14',
    },
];

export const getLetterPaper = (paperId) => (
    LETTER_PAPERS.find((paper) => paper.id === paperId) || LETTER_PAPERS[0]
);

export const getLetterTextSize = (sizeId) => (
    LETTER_TEXT_SIZES.find((size) => size.id === sizeId) || LETTER_TEXT_SIZES[1]
);

const EDGE_INSET = 6;
const EDGE_STEP = 5;
const EDGE_DEPTH = 2.6;
const PAD_TOP = 24;
const PAD_BOTTOM = 40;
// Lined paper leaves room for the red margin; the others start closer to the edge.
const PAD_LEFT_LINED = 52;
const PAD_LEFT = 26;
const PAD_RIGHT = 22;
const MARGIN_X = 40;
// Ruled line sits just under the text baseline inside each line box.
const ruleOffset = (lineHeight) => Math.round(lineHeight * 0.2);

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

const DEFAULT_TEXTURE = { specks: 1, fibers: 0, mottle: 0 };

const buildSpecks = (width, height, density = 1, seed = 11) => {
    const rand = seededRandom(seed);
    const count = Math.round(((width * height) / 2600) * density);
    return Array.from({ length: count }, (_, index) => ({
        key: index,
        cx: EDGE_INSET + rand() * (width - EDGE_INSET * 2),
        cy: EDGE_INSET + rand() * (height - EDGE_INSET * 2),
        r: 0.4 + rand() * 0.9,
        opacity: 0.08 + rand() * 0.12,
    }));
};

// Short curved hairs, like the pulp fibres you see when you hold paper to the light.
const buildFibers = (width, height, density = 0, seed = 23) => {
    const rand = seededRandom(seed);
    const count = Math.round(((width * height) / 1500) * density);
    return Array.from({ length: count }, (_, index) => {
        const x = EDGE_INSET + 4 + rand() * (width - EDGE_INSET * 2 - 8);
        const y = EDGE_INSET + 4 + rand() * (height - EDGE_INSET * 2 - 8);
        const angle = rand() * Math.PI;
        const length = 5 + rand() * 12;
        const bend = (rand() - 0.5) * 6;
        const endX = x + Math.cos(angle) * length;
        const endY = y + Math.sin(angle) * length;
        const midX = (x + endX) / 2 - Math.sin(angle) * bend;
        const midY = (y + endY) / 2 + Math.cos(angle) * bend;
        return {
            key: index,
            d: `M${x.toFixed(1)},${y.toFixed(1)}Q${midX.toFixed(1)},${midY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`,
            strokeWidth: 0.4 + rand() * 0.5,
            opacity: 0.1 + rand() * 0.14,
        };
    });
};

// Large faint blotches so the sheet isn't one flat tone.
const buildMottle = (width, height, density = 0, seed = 31) => {
    const rand = seededRandom(seed);
    const count = Math.round(((width * height) / 7000) * density);
    return Array.from({ length: count }, (_, index) => ({
        key: index,
        cx: EDGE_INSET + rand() * (width - EDGE_INSET * 2),
        cy: EDGE_INSET + rand() * (height - EDGE_INSET * 2),
        r: 14 + rand() * 38,
        opacity: 0.35 + rand() * 0.45,
    }));
};

const LetterPaper = ({ children, style, paperId, lineHeight = getLetterTextSize().lineHeight }) => {
    const [size, setSize] = useState(null);
    const paper = getLetterPaper(paperId);
    const texture = paper.texture || DEFAULT_TEXTURE;

    const art = useMemo(() => {
        if (!size) return null;
        const { width, height } = size;
        const offset = ruleOffset(lineHeight);
        const ruleCount = Math.max(0, Math.floor((height - PAD_TOP - PAD_BOTTOM + offset) / lineHeight));
        const rules = paper.pattern === 'plain' ? [] : Array.from({ length: ruleCount }, (_, index) => (
            PAD_TOP + (index + 1) * lineHeight - offset
        ));
        return {
            outline: buildDeckledPath(width, height),
            specks: buildSpecks(width, height, texture.specks),
            fibers: buildFibers(width, height, texture.fibers),
            mottle: buildMottle(width, height, texture.mottle),
            rules,
        };
    }, [size, lineHeight, paper.pattern, texture]);

    const handleLayout = ({ nativeEvent }) => {
        const { width, height } = nativeEvent.layout;
        if (size?.width === width && size?.height === height) return;
        setSize({ width, height });
    };

    return (
        <View
            style={[styles.container, { paddingLeft: paper.pattern === 'lined' ? PAD_LEFT_LINED : PAD_LEFT }, style]}
            onLayout={handleLayout}
        >
            {art ? (
                <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Defs>
                        <RadialGradient id="letterPaperFill" cx="0.5" cy="0.42" r="0.75">
                            <Stop offset="0" stopColor={paper.stops[0]} />
                            <Stop offset="0.7" stopColor={paper.stops[1]} />
                            <Stop offset="1" stopColor={paper.stops[2]} />
                        </RadialGradient>
                        <RadialGradient id="letterPaperMottle" cx="0.5" cy="0.5" r="0.5">
                            <Stop offset="0" stopColor={paper.mottle || paper.stops[2]} stopOpacity={0.55} />
                            <Stop offset="1" stopColor={paper.mottle || paper.stops[2]} stopOpacity={0} />
                        </RadialGradient>
                    </Defs>
                    <Path d={art.outline} fill={paper.shadow} opacity={0.08} translateY={4} />
                    <Path d={art.outline} fill={paper.shadow} opacity={0.1} translateY={1.5} />
                    <Path d={art.outline} fill="url(#letterPaperFill)" stroke={paper.edge} strokeWidth={1} strokeOpacity={0.7} />
                    {art.mottle.map(({ key, ...blot }) => (
                        <Circle key={key} {...blot} fill="url(#letterPaperMottle)" />
                    ))}
                    {art.fibers.map(({ key, ...fiber }) => (
                        <Path key={key} {...fiber} fill="none" stroke={paper.fiber} strokeLinecap="round" />
                    ))}
                    {art.specks.map(({ key, ...speck }) => (
                        <Circle key={key} {...speck} fill={paper.speck} />
                    ))}
                    {art.rules.map((y) => (
                        <Rect
                            key={`rule${y}`}
                            x={EDGE_INSET + 10}
                            y={y}
                            width={size.width - EDGE_INSET * 2 - 20}
                            height={1}
                            fill={paper.rule}
                            opacity={0.85}
                        />
                    ))}
                    {paper.pattern === 'lined' ? (
                        <Rect
                            x={MARGIN_X}
                            y={EDGE_INSET + 4}
                            width={1.2}
                            height={size.height - EDGE_INSET * 2 - 8}
                            fill={paper.margin}
                            opacity={0.8}
                        />
                    ) : null}
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
        paddingRight: PAD_RIGHT,
    },
});

export default LetterPaper;
