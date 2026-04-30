# Self Intro Photos

Place Leslie's personal photos for `self-intro.html` in this folder.

## Easiest Upload Flow

Use GitHub's `Self Intro Photo Update` issue form:

1. Open the repo on GitHub.
2. Go to **Issues** -> **New issue**.
3. Choose **Self Intro Photo Update**.
4. Pick the target item and photo slot.
5. Drag one JPG, PNG, or WEBP image into the photo field.
6. Add alt text and an optional hover description.
7. Submit the issue.

GitHub Actions will copy the image into `assets/self-intro/uploads/`, update `data.json`, commit, push, comment on the issue, and close it.

Life Slot 1 is the visible year-matched photo in the Life Experience crossfade. Hobbies and Casual slots appear in the masonry gallery.

## Manual Fallback

Recommended real-photo filenames:

- `cover.jpg`
- `photo-01.jpg`
- `photo-02.jpg`
- `photo-03.jpg`
- `life-campus.jpg`
- `life-building.jpg`
- `hobby-english.jpg`
- `hobby-tools.jpg`
- `casual-walk.jpg`
- `casual-breaks.jpg`

The current `data.json` points to the bundled `placeholder-*.svg` files so the page has no broken image requests. When real photos are ready, add them here and update the corresponding `src`, `image`, or `coverImage` paths in `data.json`.
