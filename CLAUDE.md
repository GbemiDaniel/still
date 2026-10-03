# Rules for every piece built from this starter
Goal: a finished, premium-looking web experience that runs smoothly on a mid-range phone. Phone first.

## Quality
- Aim for the highest visual quality the device can sustain. Start at full quality.
- Never lower quality silently. Every reduction goes through src/engine/governor.ts and shows in the debug readout with its reason.
- Heavy drawing belongs in shaders or canvas. In the page itself, animate transform and opacity only.
- After visual or heavy changes, check with the visual-qa and perf-auditor subagents.
- Every piece has a calm version through src/engine/motion.ts. It must still look finished, never like a stripped-down fallback.

## Choices
- Pick the stack, libraries, colours, fonts and layout that give the best result. Record each choice and why in NOTES.md.

## Workflow
- Read NOTES.md first, then the part of BRIEF.md you need. The plan in BRIEF.md is a suggestion. Follow my message for how far to go.
- Never paste screenshots, traces or long logs into this chat. Ask the subagent for a summary.
- Before ending a session: update NOTES.md (what exists, decisions, what to do next), commit, and push to main so Vercel deploys.
- Keep any written copy free of em-dashes.
