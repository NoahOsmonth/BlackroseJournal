#!/usr/bin/env bash
# Run a playwriter script file against a *self-healing* browser session.
#
# Two failure modes have eaten real QA budget on this repo:
#   1. The relay drops the CDP session mid-script ("page/browser closed").
#   2. A stale session id 404s ("Session N not found"), and headless sessions
#      disappear when Chrome exits.
# Both are handled here: if the session id is missing or a run fails, we create
# a fresh session and retry the identical script. Scripts must therefore be
# self-sufficient (sign in / seed as needed) - see pwlib.js.
set -u
file="$1"
timeout_ms="${PW_TIMEOUT:-240000}"
browser="${PW_BROWSER:-headless}"
attempts="${PW_ATTEMPTS:-3}"
session="${PW_SESSION:-}"

session_exists() {
    [ -n "$session" ] || return 1
    playwriter session list 2>/dev/null | awk 'NR>2 {print $1}' | grep -qx "$session"
}

new_session() {
    local out id
    out="$(playwriter session new --browser "$browser" 2>&1)"
    id="$(printf '%s' "$out" | grep -oE 'Session [0-9]+ created' | grep -oE '[0-9]+' | head -1)"
    if [ -z "$id" ]; then
        printf '%s\n' "$out" >&2
        return 1
    fi
    session="$id"
    echo "[pw] session $session ($browser)" >&2
}

for attempt in $(seq 1 "$attempts"); do
    if ! session_exists; then
        new_session || { sleep 2; continue; }
    fi

    out="$(playwriter -s "$session" --timeout "$timeout_ms" -e "$(cat "$file")" 2>&1)"
    case "$out" in
        *"Console output:"*)
            printf '%s\n' "$out"
            echo "[pw] session=$session" >&2
            exit 0
            ;;
    esac

    echo "[pw] attempt $attempt on session $session failed" >&2
    printf '%s\n' "$out" | tail -4 >&2
    # Drop the broken session so the next attempt builds a fresh browser.
    playwriter session delete "$session" >/dev/null 2>&1
    session=""
    sleep 2
done

printf '%s\n' "$out"
exit 1
