---
name: share-pr-evidence
description: Records browser screenshots and videos for a PR that changes the Plumber UI and posts them on the PR. Use when opening or updating a PR with UI changes, or when asked to add QA evidence, screenshots or recordings to a PR.
---

# Share UI evidence on a PR

Follow [docs/agents/pr-evidence.md](../../../docs/agents/pr-evidence.md). This skill adds the Claude Code fallback for step 1, when `gh` cannot attach media.

## Publish a page instead

Use this path only when step 1 rules out `gh pr comment --attach`.

1. Publish one Artifact page per PR. Name it after the change, e.g. "Save and Continue QA".
2. Pass the media through the Artifact tool's `files`. Use each file's `tmp/qa/` path as the source. Set `contentType: "video/webm"` for videos.
3. The page shows the test setup, then one section per scenario: what it shows, the video and the screenshots. List the scenarios you did not cover, with the reason.
4. Post the PR comment from step 5 of the doc. Replace the media with the page link.

On a re-run, republish the same file path or `url`, so the link stays the same. Edit the PR comment with `update_issue_comment` and name the latest tested commit.

The page is private when published. You cannot change its sharing. Tell the user to share it from the page's Share menu with the team that reviews the PR. Do not write in the comment that the page is shared until the user confirms it.
