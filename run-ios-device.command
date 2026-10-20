#!/bin/bash -l
cd "/Volumes/SSD500/Ayush/igfrontend" || exit 1
export LANG=en_US.UTF-8
LOG="/Volumes/SSD500/Ayush/igfrontend/run-ios-device.log"
{
  echo "== $(date) =="
  echo "== connected devices =="; xcrun xctrace list devices 2>&1 | head -20
  echo "== run-ios --device =="; npx react-native run-ios --device
  echo "== EXIT $? =="
} 2>&1 | tee "$LOG"
echo; echo "Done. Leave the Metro window open."
