#!/bin/bash
# Find all asset files (excluding .DS_Store, node_modules, .git)
cd /Users/ayushkumar/ALLCODE/igfrontend

echo "=== CHECKING EACH ASSET FILE ==="

# Collect all asset file paths relative to the project
find assets -type f \
  ! -name '.DS_Store' \
  ! -name '*.ttf' \
  | sort | while read -r filepath; do
  
  # Get just the filename
  filename=$(basename "$filepath")
  
  # Also get the relative path from assets dir for require/import patterns
  # Search in src/, App.jsx, index.js for references to this filename
  # We search for the filename without extension and with extension
  name_no_ext="${filename%.*}"
  
  # Search in all JS/JSX/TS/TSX files (excluding node_modules)
  found=$(grep -rl --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" \
    -e "$filename" \
    -e "$name_no_ext" \
    src/ App.jsx index.js 2>/dev/null | head -1)
  
  # Also check in react-native.config.js, metro.config.js, app.json, package.json
  if [ -z "$found" ]; then
    found=$(grep -rl \
      -e "$filename" \
      -e "$name_no_ext" \
      react-native.config.js metro.config.js app.json package.json 2>/dev/null | head -1)
  fi
  
  if [ -z "$found" ]; then
    # Get file size in KB
    size_kb=$(du -k "$filepath" | cut -f1)
    echo "UNUSED|${filepath}|${size_kb}KB"
  fi
done

echo ""
echo "=== CHECKING FONT FILES ==="
find assets/fonts -type f -name '*.ttf' | sort | while read -r filepath; do
  filename=$(basename "$filepath")
  name_no_ext="${filename%.*}"
  
  # For fonts, check both code references and react-native.config.js / iOS/Android configs
  found=$(grep -rl --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.plist" \
    -e "$filename" \
    -e "$name_no_ext" \
    src/ App.jsx index.js react-native.config.js app.json package.json ios/ android/ 2>/dev/null | head -1)
  
  if [ -z "$found" ]; then
    size_kb=$(du -k "$filepath" | cut -f1)
    echo "UNUSED|${filepath}|${size_kb}KB"
  fi
done

echo ""
echo "=== CHECKING SOUND FILES ==="
find assets/sounds -type f | sort | while read -r filepath; do
  filename=$(basename "$filepath")
  name_no_ext="${filename%.*}"
  
  found=$(grep -rl --include="*.js" --include="*.jsx" --include="*.ts" --include="*.tsx" \
    -e "$filename" \
    -e "$name_no_ext" \
    src/ App.jsx index.js 2>/dev/null | head -1)
  
  if [ -z "$found" ]; then
    size_kb=$(du -k "$filepath" | cut -f1)
    echo "UNUSED|${filepath}|${size_kb}KB"
  fi
done
