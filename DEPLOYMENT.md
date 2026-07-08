# Sentinel Deployment Guide

Step-by-step guide for getting Sentinel from your local machine to a shareable GitHub plugin.

## Current State

Sentinel is built and ready at:
```
sentinel/
├── .claude-plugin/plugin.json
├── skills/[6 skill directories]
├── README.md
├── ARCHITECTURE.md
├── index.html
└── .gitignore
```

## Step 1: Test locally first

```bash
cd /path/to/sentinel
claude plugin install .
```

Try each skill in a Claude Code session:
```
/test-plan "users can upload documents"
/coverage-review sample.test.js sample.ts
/qa-review sample.ts
/bug-report "upload fails silently"
/debug-test tests/upload.spec.ts
/sentinel
```

Per the build guide: run it against at least 3 of your own repos before calling it done. If it holds up across different codebases, it's actually a framework and not a one-off script.

## Step 2: Create a GitHub repo

- Go to https://github.com/new
- Name: `sentinel`
- Description: "QA-first testing skills for Claude Code"
- Choose Public or Private
- **Do NOT initialize with README** (you already have one)

## Step 3: Push local repo to GitHub

```bash
cd /path/to/sentinel

git remote add origin https://github.com/kim-qa/sentinel.git
git branch -M main
git push -u origin main
```

## Step 4: Enable GitHub Pages (optional, for the landing page)

- Repo Settings → Pages
- Source: Deploy from branch
- Select: main / root
- Landing page live at: `https://kim-qa.github.io/sentinel/`

## Step 5: Install from GitHub

```bash
claude plugin install github:kim-qa/sentinel
```

## Step 6: Publish & share

- LinkedIn post: philosophy (tests verify behavior, not green lights), link to GitHub, example of `/coverage-review` catching a real AI test gap
- Resume line: "Built a portable SDET testing orchestration layer — reduced review overhead and demonstrated end-to-end testing architecture decisions." (See `ARCHITECTURE.md` for the design-decision detail to pull from.)

## Troubleshooting

### Plugin doesn't load
- Check `.claude-plugin/plugin.json` is valid JSON
- Check skill names in frontmatter match directory structure
- Try: `claude plugins --list` to see installed plugins

### Skills don't show up in `/help`
- Skills need `description:` in frontmatter
- Make sure file is named `SKILL.md` (exact)
- Try: `claude skills --list`

### Landing page doesn't render
- Check GitHub Pages is enabled in Settings
- URL is: `https://kim-qa.github.io/sentinel/`
- If custom domain: update in Settings

## Questions?

- Claude Code plugin docs: https://github.com/anthropics/claude-code
