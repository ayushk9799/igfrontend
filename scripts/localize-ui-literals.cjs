const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const projectRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(projectRoot, 'src');
const translatedAttributes = new Set([
    'accessibilityHint',
    'accessibilityLabel',
    'buttonText',
    'description',
    'label',
    'placeholder',
    'subtitle',
    'title',
]);

const sourceFiles = [];
const collectFiles = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const filePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'i18n') collectFiles(filePath);
        } else if (/\.(js|jsx)$/.test(entry.name)) {
            sourceFiles.push(filePath);
        }
    }
};

const hasWords = (value) => /[A-Za-z]{2}/.test(value);
const toCall = (value) => `translateUiText(${JSON.stringify(value)})`;

const addPatch = (patches, node, replacement) => {
    if (!node || node.start == null || node.end == null) return;
    patches.push({ start: node.start, end: node.end, replacement });
};

collectFiles(sourceRoot);

let changedFiles = 0;
let changedLiterals = 0;

for (const filePath of sourceFiles) {
    const source = fs.readFileSync(filePath, 'utf8');
    const ast = parser.parse(source, {
        sourceType: 'module',
        plugins: ['jsx', 'optionalChaining'],
    });
    const patches = [];

    traverse(ast, {
        JSXText(nodePath) {
            const text = nodePath.node.value.replace(/\s+/g, ' ').trim();
            if (!hasWords(text)) return;
            addPatch(patches, nodePath.node, `{${toCall(text)}}`);
        },
        JSXAttribute(nodePath) {
            const { name, value } = nodePath.node;
            if (
                !name
                || !translatedAttributes.has(name.name)
                || !value
                || value.type !== 'StringLiteral'
                || !hasWords(value.value)
            ) {
                return;
            }
            addPatch(patches, value, `{${toCall(value.value)}}`);
        },
        JSXExpressionContainer(nodePath) {
            const expression = nodePath.node.expression;
            const parent = nodePath.parentPath;
            const isTextChild = parent.isJSXElement() || parent.isJSXFragment();
            if (
                isTextChild
                && expression
                && expression.type === 'StringLiteral'
                && hasWords(expression.value)
            ) {
                addPatch(patches, expression, toCall(expression.value));
            }
        },
        CallExpression(nodePath) {
            if (!nodePath.get('callee').matchesPattern('Alert.alert')) return;

            const [title, message, buttons] = nodePath.node.arguments;
            for (const argument of [title, message]) {
                if (argument && argument.type === 'StringLiteral' && hasWords(argument.value)) {
                    addPatch(patches, argument, toCall(argument.value));
                }
            }

            if (!buttons || buttons.type !== 'ArrayExpression') return;
            for (const button of buttons.elements) {
                if (!button || button.type !== 'ObjectExpression') continue;
                for (const property of button.properties) {
                    if (
                        property.type === 'ObjectProperty'
                        && property.key
                        && property.key.name === 'text'
                        && property.value
                        && property.value.type === 'StringLiteral'
                        && hasWords(property.value.value)
                    ) {
                        addPatch(patches, property.value, toCall(property.value.value));
                    }
                }
            }
        },
    });

    if (!patches.length) continue;

    const uniquePatches = Array.from(new Map(
        patches.map((patch) => [`${patch.start}:${patch.end}`, patch])
    ).values()).sort((a, b) => b.start - a.start);

    let output = source;
    for (const patch of uniquePatches) {
        output = output.slice(0, patch.start) + patch.replacement + output.slice(patch.end);
    }

    if (!source.includes("from '../i18n/uiTranslation'") && !source.includes("from './i18n/uiTranslation'")) {
        const relativeImport = path
            .relative(path.dirname(filePath), path.join(sourceRoot, 'i18n', 'uiTranslation'))
            .replace(/\\/g, '/');
        const importPath = relativeImport.startsWith('.') ? relativeImport : `./${relativeImport}`;
        const imports = ast.program.body.filter((node) => node.type === 'ImportDeclaration');
        const insertionPoint = imports.length ? imports[imports.length - 1].end : 0;
        output = `${output.slice(0, insertionPoint)}\nimport { translateUiText } from '${importPath}';${output.slice(insertionPoint)}`;
    }

    fs.writeFileSync(filePath, output);
    changedFiles += 1;
    changedLiterals += uniquePatches.length;
}

