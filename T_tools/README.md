# Leslie Hub Tools

## Self Intro Photo Issue Automation

Use GitHub's `Self Intro Photo Update` issue form for normal photo replacement. The workflow:

- reads the issue form fields;
- downloads the attached JPG, PNG, or WEBP image;
- saves it under `assets/self-intro/uploads/`;
- replaces the selected existing photo slot in `data.json`;
- commits and pushes the update;
- comments on the issue and closes it.

The helper script can be syntax-checked locally:

```bash
node --check T_tools/apply-self-intro-photo-issue.mjs
```

Dry-run with a fixture event payload:

```bash
node T_tools/apply-self-intro-photo-issue.mjs --dry-run --event-path /path/to/event.json
```

## Publish `data.json` Source Changes

Use this when you edited text/content directly inside `data.json` and only want to publish that file:

```bash
cd /Users/leslie/Projects/leslie-hub/D_deliverables
bash T_tools/publish-data-json.sh
```

Optional custom commit message:

```bash
bash T_tools/publish-data-json.sh "Update self intro copy"
```

The script:

- accepts only local `data.json` edits;
- validates that `data.json` is valid JSON;
- syncs latest GitHub changes with rebase/autostash;
- uses the Mac system HTTPS proxy automatically when available;
- commits `data.json`;
- pushes to `main`.

## Publish Explore Source Changes

Use this after editing `data.json`, especially `explore.vibeCoding.sources`.

```bash
cd /Users/leslie/Projects/leslie-hub/D_deliverables
bash T_tools/publish-data-update.sh
```

Optional custom commit message:

```bash
bash T_tools/publish-data-update.sh "Update Vibe Coding X sources"
```

The script:

- accepts only local `data.json` edits, so unrelated work is not accidentally committed;
- syncs the latest GitHub Actions commit before publishing;
- regenerates fresh Explore data through RSSHub;
- validates and prints freshness counts;
- commits `data.json`;
- pushes to `main`.

Default RSSHub:

```text
https://lesliezh.zeabur.app
```

To test another RSSHub instance for one run:

```bash
RSSHUB_BASE_URL="https://another-rsshub.example.com" bash T_tools/publish-data-update.sh
```
