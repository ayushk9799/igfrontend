#!/bin/bash -l
OUT="/Volumes/SSD500/Ayush/igfrontend/check-metro.log"
{
  echo "== $(date) =="
  echo "connected apps:"; curl -s -m 5 http://localhost:8081/json/list | grep -E '"title"|"deviceName"|"appId"' | head -12
  echo "reload: $(curl -s -m 5 -X POST -o /dev/null -w '%{http_code}' http://localhost:8081/reload)"
  echo "metro procs:"; pgrep -fl "react-native start|cli.js start|metro" | head -5
} > "$OUT" 2>&1
cat "$OUT"
