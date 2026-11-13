@AGENTS.md

## Claude-only notes
- Use superpowers skills (brainstorming → writing-plans → TDD) for new work.
- Before saying a task is done, run its tests and paste the output (superpowers:verification-before-completion).
- After every Lane 1 diff, have the `reviewer` subagent and Codex (`/codex` plugin) review it before proposing a merge.
