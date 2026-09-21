#!/bin/bash

# Only create tmux session if it doesn't already exist.
tmux has-session -t main 2>/dev/null

if [ $? != 0 ]; then
  tmux new-session -d -s main
  tmux split-window -h

  tmux send-keys -t main:0.0 "claude --dangerously-skip-permissions" C-m
  tmux send-keys -t main:0.1 "npm run dev:local" C-m
fi

tmux attach-session -t main
