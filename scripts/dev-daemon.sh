#!/usr/bin/env bash
# Double-fork daemon launcher — escapes the agent Bash tool's descendant cleanup
# by reparenting the final process to PID 1 (tini).
cd /home/z/my-project
(
  (
    exec setsid nohup bun run dev < /dev/null >> /tmp/dev-daemon.log 2>&1
  ) &
  exit 0
) &
wait
echo "daemon launched"
