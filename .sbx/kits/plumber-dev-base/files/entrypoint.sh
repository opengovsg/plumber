#!/bin/sh

tmux has-session -t main 2>/dev/null

if [ $? != 0 ]; then
    tmux new-session -d -s main \; rename-window "Agent" \; new-window -n "Plumber" \; new-window -n "Bash"
    tmux send-keys -t main:Agent "plumber-dev-agent" C-m
    tmux send-keys -t main:Plumber "npm i && npm run dev:local" C-m
    tmux select-window -t :Agent
fi

exec tmux attach-session -t main
