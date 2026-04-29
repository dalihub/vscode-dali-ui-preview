# Choose your runtime

Pick one of the two runtimes for the preview to render against.

## Docker (Recommended) ⭐

Best for first-time users and anyone without DALi installed.

- One-time Docker install (next step guides you)
- DALi runtime ships as a pre-built container image (~290 MB)
- Image lives outside the extension and can be cleaned up any time
  with `DALi Preview: Clean Runtime Images`
- Performance: parser-path text edits update in ~100 ms

Click **"Use Docker (Recommended)"** to switch the runtime, then move
to step 3 to install Docker.

## Native (advanced)

For users who already have DALi built on the host (typically at
`/opt/dali`).

- No Docker needed
- Uses your host GPU directly — slightly faster on large canvases
- Requires you to have built DALi from source yourself (~30 min)

Click **"Use Native DALi"** to switch the runtime. The extension will
prompt you to point at your DALi installation folder after reloading.

> If you're not sure which to pick, choose **Docker** — it just works.
