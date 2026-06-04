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
#include <dali/devel-api/text-abstraction/font-client.h>
#include <dali-ui-foundation/dali-ui-foundation.h>

#include <dlfcn.h>
#include <fcntl.h>
#include <unistd.h>

#include <cmath>
#include <fstream>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>

using namespace Dali;
using namespace Dali::Ui;
using Dali::Ui::View;

// ---------------------------------------------------------------------------
// Scene-graph metadata helpers (identical to preview_harness.cpp.template)
// ---------------------------------------------------------------------------

static std::string JsonEscapeStr(const std::string& s)
{
    std::string out;
    out.reserve(s.size() + 4);
    for(char c : s)
    {
        if      (c == '"')  out += "\\\"";
        else if (c == '\\') out += "\\\\";
        else if (c == '\n') out += "\\n";
        else if (c == '\r') out += "\\r";
        else if (c == '\t') out += "\\t";
        else if (static_cast<unsigned char>(c) < 0x20)
        {
            static const char hex[] = "0123456789abcdef";
            unsigned char uc = static_cast<unsigned char>(c);
            const char esc[7] = {'\\', 'u', '0', '0', hex[(uc >> 4) & 0xF], hex[uc & 0xF], '\0'};
            out += esc;
        }
        else                out += c;
    }
    return out;
}

static std::string ShortTypeName(const std::string& fullName)
{
    auto pos = fullName.rfind("::");
    return (pos != std::string::npos) ? fullName.substr(pos + 2) : fullName;
}

static const char* FlexDirectionStr(FlexDirection d)
{
    switch(d) {
        case FlexDirection::ROW:            return "ROW";
        case FlexDirection::ROW_REVERSE:    return "ROW_REVERSE";
        case FlexDirection::COLUMN:         return "COLUMN";
        case FlexDirection::COLUMN_REVERSE: return "COLUMN_REVERSE";
        default:                            return "ROW";
    }
}

static const char* FlexAlignStr(FlexAlign a)
{
    switch(a) {
        case FlexAlign::AUTO:       return "AUTO";
        case FlexAlign::FLEX_START: return "FLEX_START";
        case FlexAlign::CENTER:     return "CENTER";
        case FlexAlign::FLEX_END:   return "FLEX_END";
        case FlexAlign::STRETCH:    return "STRETCH";
        case FlexAlign::BASELINE:   return "BASELINE";
        default:                    return "STRETCH";
    }
}

static const char* FlexJustifyStr(FlexJustify j)
{
    switch(j) {
        case FlexJustify::FLEX_START:    return "FLEX_START";
        case FlexJustify::CENTER:        return "CENTER";
        case FlexJustify::FLEX_END:      return "FLEX_END";
        case FlexJustify::SPACE_BETWEEN: return "SPACE_BETWEEN";
        case FlexJustify::SPACE_AROUND:  return "SPACE_AROUND";
        case FlexJustify::SPACE_EVENLY:  return "SPACE_EVENLY";
        default:                         return "FLEX_START";
    }
}

static const char* FlexWrapStr(FlexWrap w)
{
    switch(w) {
        case FlexWrap::NO_WRAP:      return "NO_WRAP";
        case FlexWrap::WRAP:         return "WRAP";
        case FlexWrap::WRAP_REVERSE: return "WRAP_REVERSE";
        default:                     return "NO_WRAP";
    }
}

static void CollectActorMetadata(Actor actor, std::ostringstream& json,
                                 float pX, float pY, float pW, float pH,
                                 bool isFirst = true)
{
    if (!isFirst) json << ",";

    Dali::String name = actor.GetProperty<Dali::String>(Actor::Property::NAME);
    Vector3 pos       = actor.GetCurrentProperty<Vector3>(Actor::Property::POSITION);
    Vector3 size      = actor.GetCurrentProperty<Vector3>(Actor::Property::SIZE);
    Vector3 anchor    = actor.GetCurrentProperty<Vector3>(Actor::Property::PIVOT);
    Vector3 parentOrigin = actor.GetCurrentProperty<Vector3>(Actor::Property::PARENT_ORIGIN);

    float w = size.x;
    float h = size.y;
    float x = pX + pW * parentOrigin.x + pos.x - w * anchor.x;
    float y = pY + pH * parentOrigin.y + pos.y - h * anchor.y;

    std::string typeName = ShortTypeName(std::string(actor.GetTypeName().CStr()));
    if(typeName.empty()) typeName = "Actor";

    bool    visible = actor.GetCurrentProperty<bool>(Actor::Property::VISIBLE);
    float   opacity = actor.GetCurrentProperty<float>(Actor::Property::OPACITY);

    // User-facing color: text color for Label/InputField (the visible color the
    // user set via SetTextColor), background color for other Views, transparent
    // for non-View actors. Actor::Property::COLOR is intentionally avoided — that
    // is the tint multiplier (always white by default), not the user's color.
    Vector4 color(0.0f, 0.0f, 0.0f, 0.0f);
    const char* colorKey = "backgroundColor";
    {
        Label      label = Label::DownCast(actor);
        InputField input = InputField::DownCast(actor);
        if(label)      { color = label.GetTextColor(); colorKey = "textColor"; }
        else if(input) { color = input.GetTextColor(); colorKey = "textColor"; }
        else {
            View view = View::DownCast(actor);
            if(view) color = view.GetBackgroundColor();
        }
    }

    float safeOpacity = std::isfinite(opacity) ? opacity : 0.0f;
    float cr = std::isfinite(color.r) ? color.r : 0.0f;
    float cg = std::isfinite(color.g) ? color.g : 0.0f;
    float cb = std::isfinite(color.b) ? color.b : 0.0f;
    float ca = std::isfinite(color.a) ? color.a : 0.0f;

    json << "{\"name\":\"" << JsonEscapeStr(name.CStr()) << "\","
         << "\"type\":\"" << JsonEscapeStr(typeName) << "\","
         << "\"x\":" << x << ",\"y\":" << y << ","
         << "\"w\":" << w << ",\"h\":" << h << ","
         << "\"visible\":" << (visible ? "true" : "false") << ","
         << "\"opacity\":" << safeOpacity << ","
         << "\"properties\":{"
         << "\"" << colorKey << "\":[" << cr << "," << cg << "," << cb << "," << ca << "]"
         << "}";

    // FlexLayout-specific properties (runtime computed values)
    if(typeName == "FlexLayout")
    {
        try
        {
            FlexLayout fl = FlexLayout::DownCast(actor);
            if(fl)
            {
                json << ",\"flexProps\":{"
                     << "\"direction\":\""      << FlexDirectionStr(fl.GetDirection())      << "\","
                     << "\"alignItems\":\""     << FlexAlignStr(fl.GetAlignItems())         << "\","
                     << "\"justifyContent\":\"" << FlexJustifyStr(fl.GetJustifyContent())   << "\","
                     << "\"wrap\":\""           << FlexWrapStr(fl.GetWrap())                << "\""
                     << "}";
            }
        }
        catch(...) { /* graceful degradation if cast fails */ }
    }

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
// Resource readiness check (same as preview_harness.cpp.template)
// ---------------------------------------------------------------------------

static bool AreAllResourcesReady(Actor actor)
{
    Dali::Ui::View view = Dali::Ui::View::DownCast(actor);
    if(view && !view.IsResourceReady())
    {
        return false;
    }
    for(uint32_t i = 0; i < actor.GetChildCount(); i++)
    {
        if(!AreAllResourcesReady(actor.GetChildAt(i)))
        {
            return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// Pending reload request (set by stdin timer, consumed by capture callback)
// ---------------------------------------------------------------------------

struct ReloadRequest {
    std::string soPath;       // .so path for RELOAD; JSON file path for RENDER_JSON
    std::string pngPath;
    std::string metadataPath;
    float       width  = 0.0f;
    float       height = 0.0f;
    std::string theme  = "dark";  // "light" | "dark"
    std::string bgColor;          // optional, #RRGGBB format
    std::string locale;           // optional, e.g. "ko_KR"
    float       fontScale = 0.0f; // optional, 0 = not set
    std::string font;             // optional, font filename
    bool        isJson = false;   // true → RENDER_JSON path
};

// ---------------------------------------------------------------------------
// Minimal JSON → SceneNode parser
// ---------------------------------------------------------------------------

struct SceneNodeJson
{
    std::string                                          type;
    std::vector<std::string>                             constructorArgs;
    std::map<std::string, std::vector<std::string>>      properties;
    std::vector<SceneNodeJson>                           children;
    // Absolute 0-based source line of the originating ::New() call.
    // -1 means "not set" (render-only path without click-to-code).
    int                                                  sourceLine = -1;
};

static void JSkipWs(const std::string& s, size_t& p)
{
    while (p < s.size() && (s[p]==' '||s[p]=='\t'||s[p]=='\n'||s[p]=='\r')) ++p;
}

static std::string JReadString(const std::string& s, size_t& p)
{
    ++p; // skip opening "
    std::string out;
    while (p < s.size() && s[p] != '"')
    {
        if (s[p] == '\\' && p + 1 < s.size())
        {
            ++p;
            switch (s[p])
            {
                case '"':  out += '"';  break;
                case '\\': out += '\\'; break;
                case 'n':  out += '\n'; break;
                case 't':  out += '\t'; break;
                default:   out += s[p]; break;
            }
        }
        else { out += s[p]; }
        ++p;
    }
    ++p; // skip closing "
    return out;
}

static std::vector<std::string> JReadStringArray(const std::string& s, size_t& p)
{
    ++p; // skip '['
    std::vector<std::string> out;
    JSkipWs(s, p);
    while (p < s.size() && s[p] != ']')
    {
        if (s[p] == '"') { out.push_back(JReadString(s, p)); }
        else { ++p; } // skip unexpected token to prevent infinite loop
        JSkipWs(s, p);
        if (p < s.size() && s[p] == ',') { ++p; JSkipWs(s, p); }
    }
    if (p < s.size()) ++p; // skip ']'
    return out;
}

// Parse an unquoted JSON number into an int. Advances p past the number.
// Returns 0 on malformed input — acceptable because sourceLine defaults to -1.
static int JReadNumber(const std::string& s, size_t& p)
{
    size_t start = p;
    if (p < s.size() && (s[p] == '-' || s[p] == '+')) ++p;
    while (p < s.size() && (s[p] >= '0' && s[p] <= '9')) ++p;
    if (p == start) return 0;
    try { return std::stoi(s.substr(start, p - start)); }
    catch (...) { return 0; }
}

static std::map<std::string, std::vector<std::string>>
JReadPropertiesObject(const std::string& s, size_t& p)
{
    ++p; // skip '{'
    std::map<std::string, std::vector<std::string>> out;
    JSkipWs(s, p);
    while (p < s.size() && s[p] != '}')
    {
        if (s[p] == '"')
        {
            std::string key = JReadString(s, p);
            JSkipWs(s, p);
            if (p < s.size() && s[p] == ':') { ++p; JSkipWs(s, p); }
            if (p < s.size() && s[p] == '[')
                out[key] = JReadStringArray(s, p);
        }
        JSkipWs(s, p);
        if (p < s.size() && s[p] == ',') { ++p; JSkipWs(s, p); }
    }
    if (p < s.size()) ++p; // skip '}'
    return out;
}

static SceneNodeJson JParseNode(const std::string& s, size_t& p);

static std::vector<SceneNodeJson> JReadNodeArray(const std::string& s, size_t& p)
{
    ++p; // skip '['
    std::vector<SceneNodeJson> out;
    JSkipWs(s, p);
    while (p < s.size() && s[p] != ']')
    {
        if (s[p] == '{') { out.push_back(JParseNode(s, p)); }
        else { ++p; } // skip unexpected token to prevent infinite loop
        JSkipWs(s, p);
        if (p < s.size() && s[p] == ',') { ++p; JSkipWs(s, p); }
    }
    if (p < s.size()) ++p; // skip ']'
    return out;
}

static SceneNodeJson JParseNode(const std::string& s, size_t& p)
{
    SceneNodeJson node;
    ++p; // skip '{'
    JSkipWs(s, p);
    while (p < s.size() && s[p] != '}')
    {
        if (s[p] == '"')
        {
            std::string key = JReadString(s, p);
            JSkipWs(s, p);
            if (p < s.size() && s[p] == ':') { ++p; JSkipWs(s, p); }

            if      (key == "type"           && p < s.size() && s[p] == '"')
                node.type = JReadString(s, p);
            else if (key == "constructorArgs" && p < s.size() && s[p] == '[')
                node.constructorArgs = JReadStringArray(s, p);
            else if (key == "properties"     && p < s.size() && s[p] == '{')
                node.properties = JReadPropertiesObject(s, p);
            else if (key == "children"       && p < s.size() && s[p] == '[')
                node.children = JReadNodeArray(s, p);
            else if (key == "sourceLine")
                node.sourceLine = JReadNumber(s, p);
            else
            {
                // Skip unknown value
                if      (p < s.size() && s[p] == '"') JReadString(s, p);
                else if (p < s.size() && s[p] == '[') JReadStringArray(s, p);
                else { while (p < s.size() && s[p] != ',' && s[p] != '}') ++p; }
            }
        }
        JSkipWs(s, p);
        if (p < s.size() && s[p] == ',') { ++p; JSkipWs(s, p); }
    }
    if (p < s.size()) ++p; // skip '}'
    return node;
}

// ---------------------------------------------------------------------------
// Scene builder: SceneNodeJson → Dali::Ui view tree
// ---------------------------------------------------------------------------

static float SBParseFloat(const std::string& s)
{
    if (s.empty()) return 0.0f;
    std::string t = s;
    if (!t.empty() && t.back() == 'f') t.pop_back();
    try { return std::stof(t); } catch (...) { return 0.0f; }
}

static UiColor SBParseUiColor(const std::string& s)
{
    // "UiColor(0x1e1e2e)" or "UiColor(0xFF0000FF)"
    const std::string prefix = "UiColor(";
    if (s.size() > prefix.size() && s.substr(0, prefix.size()) == prefix)
    {
        std::string hex = s.substr(prefix.size(), s.size() - prefix.size() - 1);
        try
        {
            unsigned long v = std::stoul(hex, nullptr, 16);
            return UiColor(static_cast<uint32_t>(v));
        }
        catch (...) {}
    }
    return UiColor(0x000000);
}

static Extents SBParseExtents(const std::string& s)
{
    // "Extents(30, 30, 30, 30)"
    const std::string prefix = "Extents(";
    if (s.size() > prefix.size() && s.substr(0, prefix.size()) == prefix)
    {
        std::string inner = s.substr(prefix.size(), s.size() - prefix.size() - 1);
        std::istringstream iss(inner);
        std::string parts[4];
        for (int i = 0; i < 4; ++i) std::getline(iss, parts[i], ',');
        auto trim = [](std::string str) -> std::string {
            size_t a = str.find_first_not_of(" ");
            if (a == std::string::npos) return "0";
            str = str.substr(a);
            size_t b = str.find_last_not_of(" \tf");
            return (b == std::string::npos) ? str : str.substr(0, b + 1);
        };
        try {
            return Extents(
                static_cast<uint16_t>(std::stof(trim(parts[0]))),
                static_cast<uint16_t>(std::stof(trim(parts[1]))),
                static_cast<uint16_t>(std::stof(trim(parts[2]))),
                static_cast<uint16_t>(std::stof(trim(parts[3]))));
        } catch (...) {}
    }
    return Extents(0, 0, 0, 0);
}

// Parse layout dimension: MATCH_PARENT=-2, WRAP_CONTENT=-1, or numeric literal.
static float SBParseDimension(const std::string& s)
{
    if (s == "MATCH_PARENT")    return -2.0f;
    if (s == "WRAP_CONTENT")    return -1.0f;
    return SBParseFloat(s);
}

static void SBApplyCommonProps(View& view,
    const std::map<std::string, std::vector<std::string>>& props)
{
    for (const auto& kv : props)
    {
        if (kv.second.empty()) continue;
        const std::string& n  = kv.first;
        const std::string& a0 = kv.second[0];
        if      (n == "SetRequestedWidth")  view.SetRequestedWidth(SBParseDimension(a0));
        else if (n == "SetRequestedHeight") view.SetRequestedHeight(SBParseDimension(a0));
        else if (n == "SetBackgroundColor") view.SetBackgroundColor(SBParseUiColor(a0));
        else if (n == "SetPadding" || n == "SetViewPadding") view.SetPadding(SBParseExtents(a0));
        else if (n == "SetMargin"  || n == "SetViewMargin")  view.SetMargin(SBParseExtents(a0));
    }
}

static void SBApplyFlexProps(FlexLayout& fl,
    const std::map<std::string, std::vector<std::string>>& props)
{
    for (const auto& kv : props)
    {
        if (kv.second.empty()) continue;
        const std::string& n  = kv.first;
        const std::string& a0 = kv.second[0];

        if (n == "SetDirection" || n == "Direction")
        {
            if      (a0.find("COLUMN_REVERSE") != std::string::npos) fl.SetDirection(FlexDirection::COLUMN_REVERSE);
            else if (a0.find("ROW_REVERSE")    != std::string::npos) fl.SetDirection(FlexDirection::ROW_REVERSE);
            else if (a0.find("COLUMN")         != std::string::npos) fl.SetDirection(FlexDirection::COLUMN);
            else                                                      fl.SetDirection(FlexDirection::ROW);
        }
        else if (n == "SetAlignItems" || n == "AlignItems")
        {
            if      (a0.find("FLEX_END")   != std::string::npos) fl.SetAlignItems(FlexAlign::FLEX_END);
            else if (a0.find("FLEX_START") != std::string::npos) fl.SetAlignItems(FlexAlign::FLEX_START);
            else if (a0.find("STRETCH")    != std::string::npos) fl.SetAlignItems(FlexAlign::STRETCH);
            else if (a0.find("BASELINE")   != std::string::npos) fl.SetAlignItems(FlexAlign::BASELINE);
            else if (a0.find("CENTER")     != std::string::npos) fl.SetAlignItems(FlexAlign::CENTER);
        }
        else if (n == "SetJustifyContent" || n == "JustifyContent")
        {
            if      (a0.find("SPACE_EVENLY")  != std::string::npos) fl.SetJustifyContent(FlexJustify::SPACE_EVENLY);
            else if (a0.find("SPACE_BETWEEN") != std::string::npos) fl.SetJustifyContent(FlexJustify::SPACE_BETWEEN);
            else if (a0.find("SPACE_AROUND")  != std::string::npos) fl.SetJustifyContent(FlexJustify::SPACE_AROUND);
            else if (a0.find("FLEX_END")      != std::string::npos) fl.SetJustifyContent(FlexJustify::FLEX_END);
            else if (a0.find("CENTER")        != std::string::npos) fl.SetJustifyContent(FlexJustify::CENTER);
        }
        else if (n == "SetWrap" || n == "Wrap")
        {
            if      (a0.find("WRAP_REVERSE") != std::string::npos) fl.SetWrap(FlexWrap::WRAP_REVERSE);
            else if (a0.find("WRAP")         != std::string::npos) fl.SetWrap(FlexWrap::WRAP);
        }
    }
}

static View SBBuildNodeRaw(const SceneNodeJson& node);

// Wrapper: build the actor, then tag it with __L{sourceLine} for click-to-code.
// Recursive calls from SBBuildNodeRaw go through this wrapper (same name),
// so every node in the subtree gets tagged.
static View SBBuildNode(const SceneNodeJson& node)
{
    View result = SBBuildNodeRaw(node);
    if (result && node.sourceLine >= 0)
    {
        std::string tag = "__L" + std::to_string(node.sourceLine);
        result.SetProperty(Dali::Actor::Property::NAME, Dali::String(tag.c_str()));
    }
    return result;
}

static View SBBuildNodeRaw(const SceneNodeJson& node)
{
    const std::string& type = node.type;

    if (type == "Label")
    {
        std::string text = node.constructorArgs.empty() ? "" : node.constructorArgs[0];
        // Strip surrounding C++ string-literal quotes (e.g. `"Hello"` → `Hello`)
        if (text.size() >= 2 && text.front() == '"' && text.back() == '"')
            text = text.substr(1, text.size() - 2);
        Label lbl = Label::New(text.c_str());
        for (const auto& kv : node.properties)
        {
            if (kv.second.empty()) continue;
            const std::string& n  = kv.first;
            const std::string& a0 = kv.second[0];
            if      (n == "SetFontSize")    lbl.SetFontSize(SBParseFloat(a0));
            else if (n == "SetTextColor")   lbl.SetTextColor(SBParseUiColor(a0));
        }
        SBApplyCommonProps(lbl, node.properties);
        return lbl;
    }
    else if (type == "FlexLayout")
    {
        FlexLayout fl = FlexLayout::New();
        SBApplyFlexProps(fl, node.properties);
        SBApplyCommonProps(fl, node.properties);
        for (const auto& child : node.children)
        {
            View cv = SBBuildNode(child);
            if (cv) fl.Add(cv);
        }
        return fl;
    }
    else if (type == "StackLayout")
    {
        StackLayout sl;
        if (!node.constructorArgs.empty() &&
            node.constructorArgs[0].find("HORIZONTAL") != std::string::npos)
            sl = StackLayout::New(StackOrientation::HORIZONTAL);
        else
            sl = StackLayout::New(StackOrientation::VERTICAL);

        for (const auto& kv : node.properties)
        {
            if (kv.second.empty()) continue;
            if (kv.first == "SetSpacing" || kv.first == "Spacing") sl.SetSpacing(SBParseFloat(kv.second[0]));
        }
        SBApplyCommonProps(sl, node.properties);
        for (const auto& child : node.children)
        {
            View cv = SBBuildNode(child);
            if (cv) sl.Add(cv);
        }
        return sl;
    }
    else if (type == "ImageView")
    {
        std::string url = node.constructorArgs.empty() ? "" : node.constructorArgs[0];
        if (url.size() >= 2 && url.front() == '"' && url.back() == '"')
            url = url.substr(1, url.size() - 2);
        ImageView iv = url.empty() ? ImageView::New() : ImageView::New(url.c_str());
        SBApplyCommonProps(iv, node.properties);
        for (const auto& child : node.children)
        {
            View cv = SBBuildNode(child);
            if (cv) iv.Add(cv);
        }
        return iv;
    }
    else
    {
        View view = View::New();
        SBApplyCommonProps(view, node.properties);
        for (const auto& child : node.children)
        {
            View cv = SBBuildNode(child);
            if (cv) view.Add(cv);
        }
        return view;
    }
}

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
        , mResourceTickCount(0)
    {
        app.InitSignal().Connect(this, [this](Application& app) { OnInit(app); });
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
        mPollTimer.TickSignal().Connect(this, [this]() { return OnPollStdin(); });
        mPollTimer.Start();

        // Signal that the server is ready for commands
        std::cout << ">>>READY" << std::endl;
    }

    // -----------------------------------------------------------------------
    // stdin polling (runs inside DALi main loop via Timer)
    // -----------------------------------------------------------------------

    bool OnPollStdin()
    {
        std::string line;
        while (ReadLine(line))
        {
            // Parse: RENDER_JSON <json_path> <png_path> <metadata_path> <width> <height> [theme] [bgColor]
            if (line.size() >= 11 && line.substr(0, 11) == "RENDER_JSON")
            {
                std::string rest = (line.size() > 11) ? line.substr(12) : "";
                std::istringstream iss(rest);
                ReloadRequest req;
                req.isJson = true;
                std::string wStr, hStr;
                if (!(iss >> req.soPath >> req.pngPath >> req.metadataPath >> wStr >> hStr))
                {
                    std::cout << ">>>ERROR:malformed RENDER_JSON command" << std::endl;
                    continue;
                }
                try
                {
                    req.width  = std::stof(wStr);
                    req.height = std::stof(hStr);
                }
                catch (...)
                {
                    std::cout << ">>>ERROR:malformed RENDER_JSON command" << std::endl;
                    continue;
                }
                std::string themeStr;
                if (iss >> themeStr) req.theme = themeStr;
                std::string colorStr;
                if (iss >> colorStr && colorStr != "-") req.bgColor = colorStr;

                if (!mCaptureBusy)
                    DoReload(req);
                else
                {
                    mPendingRequest = req;
                    mHasPending     = true;
                }
            }

            // Parse: RELOAD <so_path> <png_path> <metadata_path> <width> <height> [theme]
            else if (line.size() >= 6 && line.substr(0, 6) == "RELOAD")
            {
                std::string rest = (line.size() > 6) ? line.substr(7) : "";
                std::istringstream iss(rest);
                ReloadRequest req;
                std::string wStr, hStr;
                if (!(iss >> req.soPath >> req.pngPath >> req.metadataPath >> wStr >> hStr))
                {
                    std::cout << ">>>ERROR:malformed RELOAD command" << std::endl;
                    continue;
                }
                try
                {
                    req.width  = std::stof(wStr);
                    req.height = std::stof(hStr);
                }
                catch (...)
                {
                    std::cout << ">>>ERROR:malformed RELOAD command" << std::endl;
                    continue;
                }
                // Optional theme parameter (default: dark)
                std::string themeStr;
                if (iss >> themeStr)
                {
                    req.theme = themeStr;
                }
                // Optional bgColor parameter (#RRGGBB or '-')
                std::string colorStr;
                if (iss >> colorStr && colorStr != "-")
                {
                    req.bgColor = colorStr;
                }
                // Optional locale parameter (e.g. ko_KR or '-')
                std::string localeStr;
                if (iss >> localeStr && localeStr != "-")
                {
                    req.locale = localeStr;
                }
                // Optional fontScale parameter or '-'
                std::string fontScaleStr;
                if (iss >> fontScaleStr && fontScaleStr != "-")
                {
                    try { req.fontScale = std::stof(fontScaleStr); } catch (...) {}
                }
                // Optional font filename or '-'
                std::string fontStr;
                if (iss >> fontStr && fontStr != "-")
                {
                    req.font = fontStr;
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

    static Vector4 HexToColor(const std::string& hex)
    {
        if (hex.size() != 7 || hex[0] != '#')
            return Vector4(0.1f, 0.1f, 0.12f, 1.0f); // fallback dark
        try
        {
            unsigned int r = std::stoul(hex.substr(1, 2), nullptr, 16);
            unsigned int g = std::stoul(hex.substr(3, 2), nullptr, 16);
            unsigned int b = std::stoul(hex.substr(5, 2), nullptr, 16);
            return Vector4(r / 255.0f, g / 255.0f, b / 255.0f, 1.0f);
        }
        catch (...)
        {
            return Vector4(0.1f, 0.1f, 0.12f, 1.0f); // fallback dark on parse error
        }
    }

    // -----------------------------------------------------------------------
    // RENDER_JSON path: parse scene JSON and build view tree directly
    // -----------------------------------------------------------------------

    void DoRenderJson(const ReloadRequest& req)
    {
        mCaptureBusy = true;
        mCurrentReq  = req;

        // Read scene JSON file (soPath holds the json path for RENDER_JSON)
        std::ifstream f(req.soPath);
        if (!f.is_open())
        {
            std::cout << ">>>ERROR:cannot open scene JSON: " << req.soPath << std::endl;
            mCaptureBusy = false;
            FlushPending();
            return;
        }
        std::string json((std::istreambuf_iterator<char>(f)),
                          std::istreambuf_iterator<char>());
        f.close();

        // Parse
        size_t pos = 0;
        JSkipWs(json, pos);
        if (pos >= json.size() || json[pos] != '{')
        {
            std::cout << ">>>ERROR:invalid scene JSON" << std::endl;
            mCaptureBusy = false;
            FlushPending();
            return;
        }
        SceneNodeJson sceneNode = JParseNode(json, pos);

        // Apply background
        mWindow.SetBackgroundColor(
            req.bgColor.empty() ? ThemeToColor(req.theme) : HexToColor(req.bgColor));

        // Resize window if needed
        Vector2 winSize = mWindow.GetSize();
        if (static_cast<int>(winSize.width)  != static_cast<int>(req.width) ||
            static_cast<int>(winSize.height) != static_cast<int>(req.height))
        {
            mWindow.SetSize(Window::WindowSize(
                static_cast<uint32_t>(req.width),
                static_cast<uint32_t>(req.height)));
        }

        // Clear existing actors
        Layer rootLayer = mWindow.GetRootLayer();
        while (rootLayer.GetChildCount() > 0)
            rootLayer.Remove(rootLayer.GetChildAt(0));

        // Build and attach scene
        try
        {
            View root = SBBuildNode(sceneNode);
            mWindow.Add(root);
        }
        catch (const std::exception& ex)
        {
            std::cout << ">>>ERROR:BuildScene threw: " << ex.what() << std::endl;
            mCaptureBusy = false;
            FlushPending();
            return;
        }

        ScheduleCapture();
    }

    void DoReload(const ReloadRequest& req)
    {
        if (req.isJson) { DoRenderJson(req); return; }

        mCaptureBusy = true;
        mCurrentReq  = req;

        // Apply locale if specified
        if (!req.locale.empty())
        {
            std::string langEnv = req.locale + ".UTF-8";
            setenv("LANG", langEnv.c_str(), 1);
        }

        // Apply font scale if specified
        // Phase 3-1 stub: env var set for future DALi API hook; actual TextController
        // integration planned for a later phase.
        if (req.fontScale > 0.0f)
        {
            std::string fontScaleStr = std::to_string(req.fontScale);
            setenv("DALI_FONT_SCALE", fontScaleStr.c_str(), 1);
        }

        // Apply custom font directory before dlopen so FontClient can resolve fonts.
        // req.font carries the resolved absolute directory path (set by the TypeScript
        // side from daliPreview.fontDirectories config), not a bare filename.
        if (!req.font.empty())
        {
            Dali::TextAbstraction::FontClient::Get().AddCustomFontDirectory(req.font.c_str());
        }

        // Apply background color: custom hex color takes precedence over theme
        mWindow.SetBackgroundColor(
            req.bgColor.empty() ? ThemeToColor(req.theme) : HexToColor(req.bgColor));

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
            std::cout << ">>>ERROR:" << dlErr << std::endl;
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
            std::cout << ">>>ERROR:symbol CreatePreview not found in .so" << std::endl;
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
            std::cout << ">>>ERROR:CreatePreview threw: " << ex.what() << std::endl;
            dlclose(mPluginHandle);
            mPluginHandle = nullptr;
            mCaptureBusy  = false;
            FlushPending();
            return;
        }

        ScheduleCapture();
    }

    void ScheduleCapture()
    {
        // Fast path: if no async image loads are pending, capture immediately.
        // Image-less previews (red-box, plain layouts) skip the polling overhead entirely.
        if(AreAllResourcesReady(Actor(mWindow.GetRootLayer())))
        {
            std::cout << "[ServerPerf] ScheduleCapture: fast path (resources ready immediately)" << std::endl;
            OnStartCapture();
            return;
        }

        // Slow path: poll every 100ms (up to 3s) for image decoding to finish.
        std::cout << "[ServerPerf] ScheduleCapture: slow path (polling for resources)" << std::endl;
        mResourceTickCount = 0;
        mResourceTimer = Timer::New(100);
        mResourceTimer.TickSignal().Connect(this, [this]() { return OnResourceTimer(); });
        mResourceTimer.Start();
    }

    bool OnResourceTimer()
    {
        mResourceTickCount++;
        bool ready = AreAllResourcesReady(Actor(mWindow.GetRootLayer()));
        std::cout << "[ServerPerf]   tick=" << mResourceTickCount << " ready=" << (ready ? "true" : "false") << std::endl;
        if(!ready && mResourceTickCount < 30)
        {
            return true; // keep polling up to 3 seconds
        }

        OnStartCapture();
        return false; // stop timer
    }

    bool OnStartCapture()
    {
        Capture capture = Capture::New();
        capture.FinishedSignal().Connect(this, [this](Capture capture, Capture::FinishState state) { OnCaptured(capture, state); });
        mCapture = capture;

        const Vector4 captureBg = mCurrentReq.bgColor.empty()
            ? ThemeToColor(mCurrentReq.theme)
            : HexToColor(mCurrentReq.bgColor);
        capture.Start(Actor(mWindow.GetRootLayer()),
                      Vector2(mCurrentReq.width, mCurrentReq.height),
                      Dali::String(mCurrentReq.pngPath.c_str()),
                      captureBg);
        return false; // one-shot timer
    }

    void OnCaptured(Capture capture, Capture::FinishState state)
    {
        if (state == Capture::FinishState::SUCCEEDED)
        {
            ExportSceneMetadata(Actor(mWindow.GetRootLayer()),
                                mCurrentReq.metadataPath,
                                mCurrentReq.width, mCurrentReq.height);
            std::cout << ">>>OK:" << mCurrentReq.pngPath << std::endl;
        }
        else
        {
            std::cout << ">>>ERROR:capture failed" << std::endl;
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
    Timer        mResourceTimer;
    Capture      mCapture;
    int          mResourceTickCount;

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
    Application app = Application::New(&argc, &argv, "");
    UiConfig::New().Apply();
    PreviewServer server(app);
    app.MainLoop();
    return 0;
}
