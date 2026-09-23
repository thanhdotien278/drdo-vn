# Deferred Work

- source_spec: `/Users/Super/drdovn/_bmad-output/implementation-artifacts/spec-epic-8-loyalty-memberships.md`
  summary: Repo hygiene — `.playwright-mcp/` session snapshots (incl. personal ChatGPT account data and one 0-byte file), rendered `_bmad/render/**` output, `_bmad` tooling, and unrelated brand/favicon assets sit uncommitted in the tree.
  evidence: Pre-existing untracked files surfaced in the Epic 8 review diff; not caused by this story. Reviewers recommend deleting `.playwright-mcp/`, gitignoring it and `_bmad/render/`, and deciding whether `_bmad` tooling and brand assets belong in the repo.

- source_spec: `/Users/Super/drdovn/_bmad-output/implementation-artifacts/spec-epic-8-loyalty-memberships.md`
  summary: `_bmad/scripts/setup.py` (~1400 lines) ships with no paired test file while all five sibling scripts have tests.
  evidence: Verification-gap lens found it exercised only by running it; vendored tooling outside this story's scope.
