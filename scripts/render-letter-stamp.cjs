/* eslint-env node, es2020 */
// Rebuild the transparent animation textures from LetterSealArt.jsx.
// Run with: node scripts/render-letter-stamp.cjs
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const babel = require('@babel/core');
const sharp = require('sharp');

const source = path.resolve(__dirname, '../src/components/letters/LetterSealArt.jsx');
const output = path.resolve(__dirname, '../assets/letters');
const svgTags = {
    __esModule: true, default: 'svg', Circle: 'circle', Defs: 'defs',
    Ellipse: 'ellipse', LinearGradient: 'linearGradient', Path: 'path',
    RadialGradient: 'radialGradient', Rect: 'rect', Stop: 'stop',
};
const { code } = babel.transformFileSync(source, {
    configFile: false,
    babelrc: false,
    plugins: ['@babel/plugin-transform-react-jsx', '@babel/plugin-transform-modules-commonjs'],
});
const art = { exports: {} };
const load = name => name === 'react-native-svg' ? svgTags : require(name);
vm.runInNewContext(code, { require: load, module: art, exports: art.exports }, { filename: source });

const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const serialize = element => {
    if (element == null || typeof element === 'boolean') return '';
    if (Array.isArray(element)) return element.map(serialize).join('');
    if (typeof element !== 'object') return escapeXml(element);
    if (typeof element.type === 'function') return serialize(element.type(element.props));
    const { children, ...props } = element.props;
    const attributes = Object.entries(props).map(([name, value]) => {
        const attribute = ['viewBox', 'preserveAspectRatio'].includes(name)
            ? name : name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
        return `${attribute}="${escapeXml(value)}"`;
    }).join(' ');
    const namespace = element.type === 'svg' ? ' xmlns="http://www.w3.org/2000/svg"' : '';
    return `<${element.type}${namespace} ${attributes}>${serialize(children)}</${element.type}>`;
};

async function render() {
    fs.mkdirSync(output, { recursive: true });
    for (const [name, Component, width, height] of [
        ['seal-stamp', art.exports.SealStampArt, 100, 148],
        ['seal-stamp-shadow', art.exports.SealStampShadow, 120, 40],
    ]) {
        const svg = Buffer.from(serialize(Component({ width, height })));
        for (const scale of [1, 2, 3]) {
            const suffix = scale === 1 ? '' : `@${scale}x`;
            await sharp(svg).resize(width * scale, height * scale).png()
                .toFile(path.join(output, `${name}${suffix}.png`));
        }
    }
}

render().catch(error => { console.error(error); process.exitCode = 1; });
