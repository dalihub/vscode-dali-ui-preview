# Configure Native DALi (alternative path)

Skip this step if you picked Docker in step 2.

If you already have DALi built on your host, point the extension at
the install prefix.

## Expected layout

Your DALi prefix should contain:

```
/opt/dali/
├── bin/                       (optional)
├── include/dali/              ← public-api / devel-api / integration-api
└── lib/
    ├── libdali2-core.so
    ├── libdali2-adaptor.so
    ├── libdali2-toolkit.so
    ├── libdali2-ui-foundation.so
    ├── libdali2-ui-components.so
    └── pkgconfig/dali2-*.pc
```

Common prefixes: `/opt/dali`, `~/dali-env/opt`, `~/tizen/<project>/dali-env/opt`.

## Set the prefix

Click **"Configure Native DALi"** below. A folder picker appears —
select the directory containing `lib/libdali2-core.so`. The extension
validates the path, saves it to `daliPreview.daliPrefix`, and offers
to `apt install` any missing system tools (g++, Xvfb, ccache).

## Verify

Run a preview on any `.preview.dali.cpp` file. If the host environment
is good, you'll see a render in the webview panel. If something is
missing the Output channel ("DALi Preview") shows actionable
diagnostics.
