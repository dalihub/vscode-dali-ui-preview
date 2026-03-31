/**
 * DALi Preview Server
 *
 * A long-lived DALi Application that:
 *   1. Initialises the DALi Application + Window once.
 *   2. Polls stdin for RELOAD commands via a 100ms Timer.
 *   3. dlopen/dlclose the user plugin .so on each RELOAD.
 *   4. Captures a PNG and writes scene-graph metadata.
 *   5. Writes OK:<png_path> or ERROR:<msg> to stdout.
 *
 * IPC protocol (line-based):
 *   Input:  RELOAD <so_path> <png_path> <metadata_path> <width> <height>
 *   Output: READY                    (once, after init)
 *           OK:<png_path>            (after successful capture)
 *           ERROR:<message>          (on dlopen / runtime failure)
 */
#include <dali/dali.h>
#include <dali/public-api/adaptor-framework/capture.h>
#include <dali-ui-foundation/dali-ui-foundation.h>

#include <dlfcn.h>
#include <fcntl.h>
#include <unistd.h>

#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

using namespace Dali;
using namespace Dali::Ui;
using Dali::Ui::View;

// ---------------------------------------------------------------------------
// Scene-graph metadata helpers (identical to preview_harness.cpp.template)
// ---------------------------------------------------------------------------

static void CollectActorMetadata(Actor actor, std::ostringstream& json,
                                 float pX, float pY, float pW, float pH,
                                 bool isFirst = true)
{
    if (!isFirst) json << ",";

    Dali::String name = actor.GetProperty<Dali::String>(Actor::Property::NAME);
    Vector3 pos       = actor.GetCurrentProperty<Vector3>(Actor::Property::POSITION);
    Vector3 size      = actor.GetCurrentProperty<Vector3>(Actor::Property::SIZE);
    Vector3 anchor    = actor.GetCurrentProperty<Vector3>(Actor::Property::ANCHOR_POINT);
    Vector3 parentOrigin = actor.GetCurrentProperty<Vector3>(Actor::Property::PARENT_ORIGIN);

    float w = size.x;
    float h = size.y;
    float x = pX + pW * parentOrigin.x + pos.x - w * anchor.x;
    float y = pY + pH * parentOrigin.y + pos.y - h * anchor.y;

    json << "{\"name\":\"" << name.CStr() << "\","
         << "\"x\":" << x << ",\"y\":" << y << ","
         << "\"w\":" << w << ",\"h\":" << h;

    uint32_t childCount = actor.GetChildCount();
    if (childCount > 0)
    {
        json << ",\"children\":[";
        for (uint32_t i = 0; i < childCount; i++)
        {
            CollectActorMetadata(actor.GetChildAt(i), json, x, y, w, h, (i == 0));
        }
        json << "]";
    }
    json << "}";
}

static void ExportSceneMetadata(Actor root, const std::string& metadataPath,
                                float winW, float winH)
{
    Vector3 rootSize = root.GetCurrentProperty<Vector3>(Actor::Property::SIZE);
    float rW = rootSize.x;
    float rH = rootSize.y;

    std::ostringstream json;
    json << "{\"root\":{\"name\":\"RootLayer\","
         << "\"x\":0,\"y\":0,\"w\":" << rW << ",\"h\":" << rH;

    uint32_t childCount = root.GetChildCount();
    if (childCount > 0)
    {
        json << ",\"children\":[";
        for (uint32_t i = 0; i < childCount; i++)
        {
            CollectActorMetadata(root.GetChildAt(i), json, 0.0f, 0.0f, rW, rH, (i == 0));
        }
        json << "]";
    }
    json << "}}";

    std::ofstream out(metadataPath);
    out << json.str();
}

// ---------------------------------------------------------------------------
// Pending reload request (set by stdin timer, consumed by capture callback)
// ---------------------------------------------------------------------------

struct ReloadRequest {
    std::string soPath;
    std::string pngPath;
    std::string metadataPath;
    float       width  = 0.0f;
    float       height = 0.0f;
    std::string theme  = "dark";  // "light" | "dark"
};

// ---------------------------------------------------------------------------
// PreviewServer application class
// ---------------------------------------------------------------------------

class PreviewServer : public ConnectionTracker
{
public:
    explicit PreviewServer(Application& app)
        : mApp(app)
        , mPluginHandle(nullptr)
        , mHasPending(false)
        , mCaptureBusy(false)
    {
        app.InitSignal().Connect(this, &PreviewServer::OnInit);
    }

    // -----------------------------------------------------------------------

    void OnInit(Application& app)
    {
        mWindow = app.GetWindow();
        mWindow.SetBackgroundColor(Vector4(0.1f, 0.1f, 0.12f, 1.0f));

        // Make stdin non-blocking so Timer can poll without blocking the main loop
        int flags = fcntl(STDIN_FILENO, F_GETFL, 0);
        fcntl(STDIN_FILENO, F_SETFL, flags | O_NONBLOCK);

        // Poll stdin every 100 ms
        mPollTimer = Timer::New(100);
        mPollTimer.TickSignal().Connect(this, &PreviewServer::OnPollStdin);
        mPollTimer.Start();

        // Signal that the server is ready for commands
        std::cout << "READY" << std::endl;
    }

    // -----------------------------------------------------------------------
    // stdin polling (runs inside DALi main loop via Timer)
    // -----------------------------------------------------------------------

    bool OnPollStdin()
    {
        std::string line;
        while (ReadLine(line))
        {
            // Parse: RELOAD <so_path> <png_path> <metadata_path> <width> <height> [theme]
            if (line.size() >= 6 && line.substr(0, 6) == "RELOAD")
            {
                std::string rest = (line.size() > 6) ? line.substr(7) : "";
                std::istringstream iss(rest);
                ReloadRequest req;
                std::string wStr, hStr;
                if (!(iss >> req.soPath >> req.pngPath >> req.metadataPath >> wStr >> hStr))
                {
                    std::cout << "ERROR:malformed RELOAD command" << std::endl;
                    continue;
                }
                try
                {
                    req.width  = std::stof(wStr);
                    req.height = std::stof(hStr);
                }
                catch (...)
                {
                    std::cout << "ERROR:malformed RELOAD command" << std::endl;
                    continue;
                }
                // Optional theme parameter (default: dark)
                std::string themeStr;
                if (iss >> themeStr)
                {
                    req.theme = themeStr;
                }

                if (!mCaptureBusy)
                {
                    DoReload(req);
                }
                else
                {
                    // Queue latest request; discard any older pending one
                    mPendingRequest = req;
                    mHasPending     = true;
                }
            }
        }

        return true; // keep timer running
    }

    // -----------------------------------------------------------------------
    // dlopen + render cycle
    // -----------------------------------------------------------------------

    static Vector4 ThemeToColor(const std::string& theme)
    {
        if (theme == "light")
            return Vector4(1.0f, 1.0f, 1.0f, 1.0f);
        return Vector4(0.1f, 0.1f, 0.12f, 1.0f); // dark (default)
    }

    void DoReload(const ReloadRequest& req)
    {
        mCaptureBusy = true;
        mCurrentReq  = req;

        // Apply background color for current theme
        mWindow.SetBackgroundColor(ThemeToColor(req.theme));

        // Resize window if dimensions changed
        Vector2 winSize = mWindow.GetSize();
        if (static_cast<int>(winSize.width)  != static_cast<int>(req.width) ||
            static_cast<int>(winSize.height) != static_cast<int>(req.height))
        {
            mWindow.SetSize(Window::WindowSize(
                static_cast<uint32_t>(req.width),
                static_cast<uint32_t>(req.height)));
        }

        // Unload previous plugin
        if (mPluginHandle)
        {
            dlclose(mPluginHandle);
            mPluginHandle = nullptr;
        }

        // Remove all actors from root layer
        Layer rootLayer = mWindow.GetRootLayer();
        while (rootLayer.GetChildCount() > 0)
        {
            rootLayer.Remove(rootLayer.GetChildAt(0));
        }

        // Load new plugin
        mPluginHandle = dlopen(req.soPath.c_str(), RTLD_NOW | RTLD_LOCAL);
        if (!mPluginHandle)
        {
            const char* dlErrPtr = dlerror();
            std::string dlErr = dlErrPtr ? dlErrPtr : "unknown dlopen error";
            std::cout << "ERROR:" << dlErr << std::endl;
            mCaptureBusy = false;
            FlushPending();
            return;
        }

        // Resolve CreatePreview symbol
        using CreatePreviewFn = View (*)();
        CreatePreviewFn createPreview =
            reinterpret_cast<CreatePreviewFn>(dlsym(mPluginHandle, "CreatePreview"));
        if (!createPreview)
        {
            std::cout << "ERROR:symbol CreatePreview not found in .so" << std::endl;
            dlclose(mPluginHandle);
            mPluginHandle = nullptr;
            mCaptureBusy  = false;
            FlushPending();
            return;
        }

        // Build the preview UI and add to window
        try
        {
            View preview = createPreview();
            mWindow.Add(preview);
        }
        catch (const std::exception& ex)
        {
            std::cout << "ERROR:CreatePreview threw: " << ex.what() << std::endl;
            dlclose(mPluginHandle);
            mPluginHandle = nullptr;
            mCaptureBusy  = false;
            FlushPending();
            return;
        }

        // Delay capture by one frame so layout is flushed
        mCaptureTimer = Timer::New(200);
        mCaptureTimer.TickSignal().Connect(this, &PreviewServer::OnStartCapture);
        mCaptureTimer.Start();
    }

    bool OnStartCapture()
    {
        Capture capture = Capture::New();
        capture.FinishedSignal().Connect(this, &PreviewServer::OnCaptured);
        mCapture = capture;

        capture.Start(Actor(mWindow.GetRootLayer()),
                      Vector2(mCurrentReq.width, mCurrentReq.height),
                      Dali::String(mCurrentReq.pngPath.c_str()),
                      ThemeToColor(mCurrentReq.theme));
        return false; // one-shot timer
    }

    void OnCaptured(Capture capture, Capture::FinishState state)
    {
        if (state == Capture::FinishState::SUCCEEDED)
        {
            ExportSceneMetadata(Actor(mWindow.GetRootLayer()),
                                mCurrentReq.metadataPath,
                                mCurrentReq.width, mCurrentReq.height);
            std::cout << "OK:" << mCurrentReq.pngPath << std::endl;
        }
        else
        {
            std::cout << "ERROR:capture failed" << std::endl;
        }

        mCaptureBusy = false;
        FlushPending();
    }

    // -----------------------------------------------------------------------
    // Flush queued request (if any)
    // -----------------------------------------------------------------------

    void FlushPending()
    {
        if (mHasPending)
        {
            mHasPending = false;
            DoReload(mPendingRequest);
        }
    }

private:
    // -----------------------------------------------------------------------
    // Non-blocking line read from stdin with internal line buffer.
    // Drains all available bytes from stdin into mStdinBuf, then returns the
    // first complete line (trimmed of \r\n). Returns false when no complete
    // line is available yet.
    // -----------------------------------------------------------------------

    bool ReadLine(std::string& out)
    {
        // Drain all currently available bytes into the line buffer
        char buf[4096];
        ssize_t n;
        while ((n = read(STDIN_FILENO, buf, sizeof(buf) - 1)) > 0)
        {
            mStdinBuf.append(buf, static_cast<size_t>(n));
        }

        // Extract the first complete line
        size_t nl = mStdinBuf.find('\n');
        if (nl == std::string::npos)
        {
            return false;
        }

        out = mStdinBuf.substr(0, nl);
        if (!out.empty() && out.back() == '\r')
        {
            out.pop_back();
        }
        mStdinBuf.erase(0, nl + 1);
        return !out.empty();
    }

    Application& mApp;
    Window       mWindow;
    Timer        mPollTimer;
    Timer        mCaptureTimer;
    Capture      mCapture;

    void*        mPluginHandle;
    bool         mHasPending;
    bool         mCaptureBusy;
    std::string  mStdinBuf;
    ReloadRequest mCurrentReq;
    ReloadRequest mPendingRequest;
};

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

int main(int argc, char* argv[])
{
    Application app = Application::New(&argc, &argv, "", Application::OPAQUE);
    UiConfig::New().Apply();
    PreviewServer server(app);
    app.MainLoop();
    return 0;
}
