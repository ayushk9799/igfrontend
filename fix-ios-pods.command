#!/bin/bash -l
# One-off: reinstall JS deps on this Mac and sync CocoaPods (Mapbox + expo-gl) after the remote merge.
cd "/Volumes/SSD500/Ayush/igfrontend" || exit 1
export LANG=en_US.UTF-8
LOG="/Volumes/SSD500/Ayush/igfrontend/fix-ios-pods.log"
{
  echo "== $(date) =="
  echo "== npm install =="; npm install --no-audit --no-fund
  echo "== pod install =="; cd ios && pod install
  echo "== EXIT $? =="
} 2>&1 | tee "$LOG"
echo; echo "Done. You can close this window."
