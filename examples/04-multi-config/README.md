# 04 · Multi-config (`// @preview-config`)

Add one or more **`// @preview-config:`** lines at the top of a preview file to
render the same UI under several configurations — different resolutions, themes,
or a named device. The preview panel lets you switch between them.

```cpp
// @preview-config: name="Phone Light", width=720, height=1280, theme=light
// @preview-config: name="Phone Dark",  width=720, height=1280, theme=dark
// @preview-config: name="Watch",       width=360, height=360
```

## Try it

1. Open [`responsive.preview.dali.cpp`](responsive.preview.dali.cpp).
2. Save (`Ctrl+S`). The panel offers each named configuration.
3. Switch between **Phone Light / Phone Dark / Watch** to see the layout adapt.

Great for checking responsive layouts and light/dark theming in one file.
