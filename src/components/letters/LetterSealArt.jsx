import React from 'react';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

export const WaxSealArt = ({ size }) => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
            <RadialGradient id="letterWax" cx="0.36" cy="0.28" r="0.75">
                <Stop offset="0" stopColor="#E9697B" />
                <Stop offset="0.58" stopColor="#C83F5F" />
                <Stop offset="1" stopColor="#8D2445" />
            </RadialGradient>
        </Defs>
        <Path
            d="M50 5 C58 1 63 8 70 9 C78 8 80 17 85 21 C94 24 91 33 95 40 C100 48 94 54 94 62 C94 70 85 73 82 80 C79 89 69 86 63 92 C56 98 49 92 42 94 C33 97 29 89 22 86 C13 85 14 76 8 70 C2 64 7 56 5 49 C1 41 9 36 10 29 C10 20 19 19 24 13 C30 6 38 10 43 6 Z"
            fill="#662039" opacity={0.16} translateY={3}
        />
        <Path
            d="M50 5 C58 1 63 8 70 9 C78 8 80 17 85 21 C94 24 91 33 95 40 C100 48 94 54 94 62 C94 70 85 73 82 80 C79 89 69 86 63 92 C56 98 49 92 42 94 C33 97 29 89 22 86 C13 85 14 76 8 70 C2 64 7 56 5 49 C1 41 9 36 10 29 C10 20 19 19 24 13 C30 6 38 10 43 6 Z"
            fill="url(#letterWax)" stroke="#A83150" strokeWidth={1}
        />
        <Path d="M18 36 Q22 20 40 17" fill="none" stroke="#F899A3" strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />
        <Ellipse cx="69" cy="77" rx="9" ry="3" fill="#6F1E3A" opacity={0.16} transform="rotate(-30 69 77)" />
    </Svg>
);

export const WaxSealImprint = ({ size }) => (
    <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="51" r="31" fill="#9F294B" fillOpacity={0.16} stroke="#7F2441" strokeWidth={2.4} />
        <Path d="M21 55 A30 30 0 0 0 78 58" fill="none" stroke="#EF8191" strokeWidth={1.8} />
        <Path d="M50 66 C43 60 32 53 32 44 C32 34 44 32 50 41 C56 32 68 34 68 44 C68 53 57 60 50 66 Z" fill="#F0919E" translateY={1.5} />
        <Path d="M50 65 C43 59 32 52 32 43 C32 33 44 31 50 40 C56 31 68 33 68 43 C68 52 57 59 50 65 Z" fill="#9A294A" stroke="#80203D" strokeWidth={0.8} />
    </Svg>
);

export const SealStampArt = ({ width, height }) => (
    <Svg width={width} height={height} viewBox="0 0 100 148">
        <Defs>
            <LinearGradient id="letterStampWood" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#3F2019" />
                <Stop offset="0.18" stopColor="#8C4D2A" />
                <Stop offset="0.38" stopColor="#D29A62" />
                <Stop offset="0.56" stopColor="#AC6D3C" />
                <Stop offset="0.8" stopColor="#60301F" />
                <Stop offset="1" stopColor="#301B17" />
            </LinearGradient>
            <RadialGradient id="letterStampCrown" cx="0.32" cy="0.24" r="0.76">
                <Stop offset="0" stopColor="#EDC28C" />
                <Stop offset="0.24" stopColor="#CC9157" />
                <Stop offset="0.58" stopColor="#9B5C32" />
                <Stop offset="0.82" stopColor="#5A2B1C" />
                <Stop offset="1" stopColor="#351B17" />
            </RadialGradient>
            <LinearGradient id="letterStampBrass" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#65411D" />
                <Stop offset="0.17" stopColor="#BE8B45" />
                <Stop offset="0.31" stopColor="#FFE6AB" />
                <Stop offset="0.43" stopColor="#D9AC65" />
                <Stop offset="0.67" stopColor="#A77333" />
                <Stop offset="0.84" stopColor="#D7AB68" />
                <Stop offset="1" stopColor="#66411D" />
            </LinearGradient>
            <RadialGradient id="letterStampBrassTop" cx="0.33" cy="0.2" r="0.86">
                <Stop offset="0" stopColor="#FFF0C2" />
                <Stop offset="0.45" stopColor="#E6C17D" />
                <Stop offset="1" stopColor="#9B6D33" />
            </RadialGradient>
        </Defs>
        {/* The curved side wall, upper rim and recessed underside give the die thickness. */}
        <Path d="M12 118 Q50 103 88 118 L88 134 Q50 150 12 134 Z" fill="url(#letterStampBrass)" stroke="#69451F" strokeWidth={1.2} />
        <Ellipse cx="50" cy="138" rx="34" ry="7" fill="#68401F" stroke="#4A2C18" />
        <Path d="M16 132 Q50 145 84 132" fill="none" stroke="#F8D999" strokeWidth={2.2} />
        <Path d="M15 126 Q50 140 85 126" fill="none" stroke="#714A23" strokeWidth={0.8} opacity={0.65} />
        <Path d="M27 121 L31 122 L31 137 L27 136 Z" fill="#FFF0BE" opacity={0.65} />
        <Ellipse cx="50" cy="118" rx="38" ry="11" fill="url(#letterStampBrassTop)" stroke="#A67B3E" />
        <Path d="M17 116 Q32 109 48 110" fill="none" stroke="#FFF4CD" strokeWidth={1.4} strokeLinecap="round" />
        <Ellipse cx="54" cy="117" rx="22" ry="5.5" fill="#59331D" opacity={0.26} />
        <Path d="M37 99 L63 99 L78 114 Q50 126 22 114 Z" fill="url(#letterStampBrass)" stroke="#90612E" />
        <Path d="M38 101 L43 102 L32 115 L28 114 Z" fill="#FFF0BC" opacity={0.55} />
        <Rect x="36" y="91" width="28" height="14" rx="4" fill="url(#letterStampBrass)" stroke="#785023" />
        <Ellipse cx="50" cy="93" rx="14" ry="4" fill="#F4D79F" stroke="#A77B3F" />

        {/* A lit crown and tapered, shaded neck read as a turned wooden handle. */}
        <Path d="M41 46 Q50 41 59 46 L58 64 L62 91 Q50 99 38 91 L42 64 Z" fill="url(#letterStampWood)" stroke="#603522" strokeWidth={0.9} />
        <Path d="M45 51 Q47 63 44 88" fill="none" stroke="#F0C08B" strokeWidth={2.8} strokeLinecap="round" opacity={0.6} />
        <Path d="M55 51 Q52 68 56 89" fill="none" stroke="#48281D" strokeWidth={1.4} opacity={0.55} />
        <Path d="M50 5 C64 5 74 14 73 29 C72 42 62 51 50 52 C38 51 28 42 27 29 C26 14 36 5 50 5 Z" fill="url(#letterStampCrown)" stroke="#693C26" strokeWidth={0.9} />
        <Ellipse cx="41" cy="16" rx="9" ry="5" fill="#FFF0CA" opacity={0.44} transform="rotate(-25 41 16)" />
        <Path d="M35 22 C32 32 37 41 43 44" fill="none" stroke="#E3AD75" strokeWidth={1.1} strokeLinecap="round" opacity={0.6} />
        <Path d="M56 12 C68 23 61 39 56 46" fill="none" stroke="#542D20" strokeWidth={1.1} opacity={0.32} />
        <Path d="M39 88 Q50 94 61 88" fill="none" stroke="#4B291D" strokeWidth={1} opacity={0.55} />
    </Svg>
);

export const SealStampShadow = ({ width, height }) => (
    <Svg width={width} height={height} viewBox="0 0 120 40" preserveAspectRatio="none">
        <Defs>
            <RadialGradient id="letterStampShadow" cx="0.5" cy="0.5" r="0.5">
                <Stop offset="0" stopColor="#3C1E28" stopOpacity={0.85} />
                <Stop offset="0.5" stopColor="#3C1E28" stopOpacity={0.42} />
                <Stop offset="1" stopColor="#3C1E28" stopOpacity={0} />
            </RadialGradient>
        </Defs>
        <Ellipse cx="60" cy="20" rx="60" ry="20" fill="url(#letterStampShadow)" />
    </Svg>
);
