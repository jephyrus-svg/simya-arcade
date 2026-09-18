#!/bin/bash
cd "$(dirname "$0")"
PORT=4860
python3 -m http.server "$PORT" >/tmp/simya-arcade.log 2>&1 &
sleep 0.5
open "http://127.0.0.1:$PORT/"
