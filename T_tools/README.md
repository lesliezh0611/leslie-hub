# Leslie Hub Tools

## Publish `data.json` Source Changes

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
