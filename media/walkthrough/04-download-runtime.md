# Download DALi Runtime Image

Skip this step if you picked Native runtime in step 2.

The DALi runtime ships as a pre-built Docker image
(`ghcr.io/lwc0917/dali-preview-runtime`, ~290 MB compressed). Pulling
it once now means your **first preview will be instant** — no waiting
during your first save.

## Two ways to trigger it

- **Easiest**: just click [Verify Docker Access] in step 3. After it
  succeeds it offers to download the image — accept.
- **Direct**: click **"Download Runtime Image"** below. A progress bar
  appears in the bottom-right of VS Code with the percentage.

## What you'll see

1. A notification with the download progress (`Downloading DALi
   runtime image (~290 MB) — 42%`).
2. On completion: `Runtime image downloaded. You can now open a
   sample preview.`
3. The step gets a green checkmark.

## When to re-run

- **Never** under normal use — the image is cached locally.
- **After version bump**: when `daliPreview.daliVersionTag` changes,
  the new version is pulled the first time it's used.
- **After cleanup**: if you ran `DALi Preview: Clean Runtime Images`
  to free disk space.
