# Switch to Docker mode

By default, the extension looks for a DALi install on your host (Native
mode). To use the containerised runtime instead, set
`daliPreview.runtimeMode` to `docker`.

Click the **"Use Docker Runtime"** button below — it flips the setting
for you and starts the preview server inside a container.

The first time you render a preview, Docker pulls the DALi runtime
image (~290 MB). Subsequent renders use the cached image and start
in well under a second.

## What happens on first preview

1. Docker checks if `ghcr.io/dalihub/dali-preview-runtime:latest` is
   cached locally — if not, it pulls it (one-time, ~2 minutes on a
   100 Mbps connection).
2. The preview server starts inside the container and emits `READY`
   to the extension.
3. Your `.preview.dali.cpp` file is parsed and the resulting scene
   is rendered. PNG + scene metadata appear in the webview panel.
4. Edit text, save (Ctrl+S), and the preview re-renders in ~100 ms.
