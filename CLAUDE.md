
## Project tracking (single source of truth)

`PROJECT.md` at the repo root is the **single source of truth** for what this project contains, its feature status, and roadmap.

**Whenever you make a change that adds, removes, or alters a feature, page, API, or significant behavior, you MUST update `PROJECT.md` in the same change:**

1. Update the affected feature's status tag (✅ Done / 🚧 In progress / 📋 Planned) and description.
2. Adjust the **Roadmap** and **Known Gaps / Tech Debt** sections if the change resolves or introduces items there.
3. Update the directory map if files were added/removed/moved.
4. Bump the `Last updated` date at the top.
5. Append a one-line entry to the **Changelog** (newest first).

Keep edits surgical — do not rewrite unrelated sections.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
