import React, { useRef } from 'react';
import Svg, {
    Circle,
    Defs,
    Ellipse,
    G,
    LinearGradient,
    Path,
    RadialGradient,
    Rect,
    Stop,
} from 'react-native-svg';

let gradientSeed = 0;

// Gradient ids must be unique per drawing or two birds on screen share fills.
const useGradientIds = () => {
    const ref = useRef(null);
    if (!ref.current) {
        gradientSeed += 1;
        const n = gradientSeed;
        ref.current = (name) => `bird${n}${name}`;
    }
    return ref.current;
};

const Cream = ({ id }) => (
    <RadialGradient id={id} cx="0.4" cy="0.3" r="0.8">
        <Stop offset="0" stopColor="#FFFFFF" />
        <Stop offset="1" stopColor="#F1E4D6" />
    </RadialGradient>
);

const Eye = ({ cx, cy, sleeping, color = '#1E1726' }) => (
    sleeping ? (
        <Path d={`M${cx - 8} ${cy} Q${cx} ${cy + 6} ${cx + 8} ${cy}`} stroke={color} strokeWidth={4} strokeLinecap="round" fill="none" />
    ) : (
        <G>
            <Ellipse cx={cx} cy={cy} rx={6.8} ry={8.2} fill={color} />
            <Circle cx={cx + 2.4} cy={cy - 3.4} r={2.5} fill="#FFFFFF" />
        </G>
    )
);

const Penguin = ({ id, sleeping }) => (
    <G>
        <Defs>
            <Cream id={id('cream')} />
            <RadialGradient id={id('body')} cx="0.35" cy="0.25" r="0.85">
                <Stop offset="0" stopColor="#5E566E" />
                <Stop offset="1" stopColor="#262030" />
            </RadialGradient>
        </Defs>
        <Ellipse cx={44} cy={122} rx={14} ry={34} rotation={22} origin="44, 122" fill={`url(#${id('body')})`} />
        <Ellipse cx={156} cy={122} rx={14} ry={34} rotation={-22} origin="156, 122" fill={`url(#${id('body')})`} />
        <Ellipse cx={100} cy={112} rx={62} ry={74} fill={`url(#${id('body')})`} />
        <Path d="M100 70 C80 50 52 62 54 92 C56 120 66 152 100 178 C134 152 144 120 146 92 C148 62 120 50 100 70Z" fill={`url(#${id('cream')})`} />
        <Circle cx={94} cy={40} r={6} fill="#262030" />
        <Circle cx={104} cy={38} r={6} fill="#262030" />
        <Eye cx={82} cy={92} sleeping={sleeping} />
        <Eye cx={118} cy={92} sleeping={sleeping} />
        <Ellipse cx={70} cy={110} rx={9} ry={5.5} fill="#FF9FB3" opacity={0.75} />
        <Ellipse cx={130} cy={110} rx={9} ry={5.5} fill="#FF9FB3" opacity={0.75} />
        <Path d="M88 104 Q100 97 112 104 Q106 117 100 118 Q94 117 88 104Z" fill="#F5A524" />
        <Ellipse cx={80} cy={185} rx={16} ry={8} fill="#F5A524" />
        <Ellipse cx={120} cy={185} rx={16} ry={8} fill="#F5A524" />
        <Path d="M60 78 L138 146" stroke="#B0274F" strokeWidth={6} strokeLinecap="round" />
        <Rect x={124} y={136} width={46} height={36} rx={9} fill="#FF758F" />
        <Path d="M124 146 Q147 162 170 146 L170 145 Q170 136 161 136 L133 136 Q124 136 124 145Z" fill="#E0567A" />
        <Path d="M147 164 l-5.5 -5.5 a3.4 3.4 0 0 1 5.5 -4.3 a3.4 3.4 0 0 1 5.5 4.3z" fill="#FFFFFF" />
    </G>
);

const Pigeon = ({ id, sleeping }) => (
    <G>
        <Defs>
            <RadialGradient id={id('body')} cx="0.35" cy="0.3" r="0.85">
                <Stop offset="0" stopColor="#D6CCEE" />
                <Stop offset="1" stopColor="#8E7DC0" />
            </RadialGradient>
            <RadialGradient id={id('head')} cx="0.35" cy="0.3" r="0.8">
                <Stop offset="0" stopColor="#C9BEE6" />
                <Stop offset="1" stopColor="#8B7ABC" />
            </RadialGradient>
            <LinearGradient id={id('iris')} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#6FC3B2" />
                <Stop offset="1" stopColor="#A47AD8" />
            </LinearGradient>
        </Defs>
        <Path d="M44 138 L12 156 L20 168 L54 156Z" fill="#7C6BA8" />
        <Ellipse cx={96} cy={130} rx={62} ry={50} fill={`url(#${id('body')})`} />
        <Ellipse cx={120} cy={142} rx={30} ry={26} fill="#E2DAF3" opacity={0.75} />
        <Path d="M68 92 Q100 112 134 92 L134 106 Q100 126 68 106Z" fill={`url(#${id('iris')})`} />
        <Circle cx={101} cy={70} r={36} fill={`url(#${id('head')})`} />
        <Path d="M56 118 Q90 98 126 128 Q110 162 70 158 Q50 142 56 118Z" fill="#8573B5" />
        <Path d="M70 132 Q90 127 110 140" stroke="#5E4E92" strokeWidth={5} strokeLinecap="round" fill="none" />
        <Path d="M68 145 Q86 140 104 151" stroke="#5E4E92" strokeWidth={5} strokeLinecap="round" fill="none" />
        <Eye cx={88} cy={66} sleeping={sleeping} />
        <Eye cx={114} cy={66} sleeping={sleeping} />
        <Ellipse cx={78} cy={83} rx={8} ry={5} fill="#FF9FB3" opacity={0.75} />
        <Ellipse cx={124} cy={83} rx={8} ry={5} fill="#FF9FB3" opacity={0.75} />
        <Ellipse cx={101} cy={78} rx={6} ry={3.6} fill="#F4ECFA" />
        <Path d="M95 82 Q101 79 107 82 L101 94Z" fill="#4A3A5E" />
        <Path d="M82 176 l-7 10 M82 176 l0 12 M82 176 l7 10" stroke="#E57A93" strokeWidth={4} strokeLinecap="round" />
        <Path d="M114 176 l-7 10 M114 176 l0 12 M114 176 l7 10" stroke="#E57A93" strokeWidth={4} strokeLinecap="round" />
        <Rect x={118} y={164} width={30} height={14} rx={7} fill="#FFF6E8" stroke="#E8C9A0" strokeWidth={2} />
        <Rect x={131} y={163} width={4} height={16} fill="#D23F66" />
    </G>
);

const Swallow = ({ id, sleeping }) => (
    <G>
        <Defs>
            <Cream id={id('cream')} />
            <RadialGradient id={id('body')} cx="0.35" cy="0.25" r="0.85">
                <Stop offset="0" stopColor="#5A7FCC" />
                <Stop offset="1" stopColor="#1F346B" />
            </RadialGradient>
        </Defs>
        <Path d="M66 146 L18 188 L38 180 L46 194 L82 158Z" fill="#1F346B" />
        <Ellipse cx={106} cy={116} rx={58} ry={54} fill={`url(#${id('body')})`} />
        <Ellipse cx={114} cy={140} rx={38} ry={32} fill={`url(#${id('cream')})`} />
        <Ellipse cx={108} cy={70} rx={11} ry={5} fill="#E8674A" />
        <Path d="M90 102 Q108 92 126 102 Q118 122 108 124 Q98 122 90 102Z" fill="#E8674A" />
        <G rotation={-12} origin="152, 142">
            <Rect x={132} y={128} width={42} height={28} rx={4} fill="#FFFFFF" stroke="#F0D6E0" strokeWidth={2} />
            <Path d="M132 130 L153 145 L174 130" stroke="#F0D6E0" strokeWidth={2} fill="none" />
            <Circle cx={153} cy={145} r={5} fill="#D23F66" />
        </G>
        <Path d="M54 102 Q100 108 146 172 Q98 166 62 140 Q48 122 54 102Z" fill="#2A4482" />
        <Eye cx={92} cy={86} sleeping={sleeping} color="#0F1530" />
        <Eye cx={124} cy={86} sleeping={sleeping} color="#0F1530" />
        <Ellipse cx={80} cy={100} rx={7} ry={4.5} fill="#FF9FB3" opacity={0.6} />
        <Ellipse cx={136} cy={100} rx={7} ry={4.5} fill="#FF9FB3" opacity={0.6} />
        <Path d="M102 94 L114 94 L108 102Z" fill="#2E1E3C" />
    </G>
);

const Falcon = ({ id, sleeping }) => (
    <G>
        <Defs>
            <Cream id={id('cream')} />
            <RadialGradient id={id('body')} cx="0.35" cy="0.25" r="0.85">
                <Stop offset="0" stopColor="#E3A866" />
                <Stop offset="1" stopColor="#8A5126" />
            </RadialGradient>
        </Defs>
        <Path d="M80 158 L70 190 L100 184 L130 190 L120 158Z" fill="#7A4520" />
        <Ellipse cx={100} cy={116} rx={60} ry={68} fill={`url(#${id('body')})`} />
        <Ellipse cx={100} cy={134} rx={38} ry={44} fill={`url(#${id('cream')})`} />
        <Ellipse cx={86} cy={140} rx={3} ry={4} fill="#C9A27A" />
        <Ellipse cx={100} cy={150} rx={3} ry={4} fill="#C9A27A" />
        <Ellipse cx={114} cy={140} rx={3} ry={4} fill="#C9A27A" />
        <Path d="M42 98 Q28 150 66 178 Q72 140 60 102Z" fill="#7A4520" />
        <Path d="M158 98 Q172 150 134 178 Q128 140 140 102Z" fill="#7A4520" />
        <Path d="M74 96 Q70 110 76 120" stroke="#5A3418" strokeWidth={7} strokeLinecap="round" fill="none" />
        <Path d="M126 96 Q130 110 124 120" stroke="#5A3418" strokeWidth={7} strokeLinecap="round" fill="none" />
        <Circle cx={84} cy={90} r={10.5} fill="#FCD34D" />
        <Circle cx={116} cy={90} r={10.5} fill="#FCD34D" />
        <Eye cx={84} cy={90} sleeping={sleeping} />
        <Eye cx={116} cy={90} sleeping={sleeping} />
        <Path d="M91 102 Q100 95 109 102 Q109 114 100 121 Q98 112 91 102Z" fill="#F5B82E" />
        <Path d="M46 64 Q100 44 154 64" stroke="#5A3418" strokeWidth={7} strokeLinecap="round" fill="none" />
        <Circle cx={84} cy={58} r={13} fill="#93C5FD" stroke="#4B3D5C" strokeWidth={5} />
        <Circle cx={116} cy={58} r={13} fill="#93C5FD" stroke="#4B3D5C" strokeWidth={5} />
        <Rect x={76} y={168} width={48} height={26} rx={4} fill="#FFFFFF" stroke="#F0D6E0" strokeWidth={2} />
        <Circle cx={100} cy={184} r={5} fill="#D23F66" />
    </G>
);

const BIRDS = {
    penguin: Penguin,
    pigeon: Pigeon,
    swallow: Swallow,
    falcon: Falcon,
};

/**
 * One of the four mail-bird characters, drawn in a 200×200 box.
 * Placeholder vector art until the final 3D renders are ready.
 */
const BirdArt = ({ bird = 'pigeon', size = 64, sleeping = false, style }) => {
    const id = useGradientIds();
    const Bird = BIRDS[bird] || Pigeon;
    return (
        <Svg width={size} height={size} viewBox="0 0 200 200" style={style}>
            <Bird id={id} sleeping={sleeping} />
        </Svg>
    );
};

export default BirdArt;
