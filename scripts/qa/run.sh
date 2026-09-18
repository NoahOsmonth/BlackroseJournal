#!/usr/bin/env bash
# Prepend the shared playwriter helpers, then run with relay reconnection.
set -u
cat scripts/qa/pwlib.js "$1" > /tmp/pw-run.js
bash scripts/qa/pw.sh /tmp/pw-run.js
