const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve, dirname } = require('node:path');

const frontendRoot = resolve(__dirname, '..');
const sourcePath = resolve(
    process.argv[2] || resolve(frontendRoot, '../igbackend/assets/5-letter-words.txt')
);
const outputPath = resolve(frontendRoot, 'src/data/fiveLetterWords.json');

const words = [...new Set(
    readFileSync(sourcePath, 'utf8')
        .split(/\r?\n/)
        .map(word => word.trim().toLowerCase())
        .filter(word => /^[a-z]{5}$/.test(word))
)].sort();

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(words)}\n`);

