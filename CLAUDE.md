@AGENTS.md

## Claude-only notes
- Use superpowers skills (brainstorming → writing-plans → TDD) for new work.
- Before saying a task is done, run its tests and paste the output (superpowers:verification-before-completion).
- After every Lane 1 diff, have the `reviewer` subagent and Codex (`/codex` plugin) review it before proposing a merge.

## Delegation
- The orchestrator reads at most 3 files itself. Beyond that, send a scout.
- Every dispatch names a model explicitly.
- Subagents return at most ~200 words. Anything longer goes in .agent-out/<task>.md, and they return the path.
- Give subagents specific file paths, never "read the whole repo."
- Max 5 subagents running at once. Review loops stop after 2 rounds.
- Parallel subagents share one identical brief at the start. Put task-specific details at the end.
