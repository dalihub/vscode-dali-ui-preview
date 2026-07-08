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
// Scene-graph metadata helpers - extracted into the shared exporter header so
// the harness (full-build path) and this server (baked / native-local path)
// share ONE source and can never silently drift. See server/preview_export.h.
// The header emits the SUPERSET shape (adds localX/localY vs. the old server
// output); everything else is byte-identical to the previous inline copy.
// ---------------------------------------------------------------------------

#include "preview_export.h"

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
    bool        isRenderAt = false; // true → RENDER_AT scrub path (reuse resident plugin)
    float       progress = 0.0f;    // normalized [0,1] for RENDER_AT
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

// Dark-theme token palette for the server scene-builder path (F3.3).
// MUST stay in sync with src/buildRunner.ts DARK_PALETTE_TOKENS and
// test/e2e/standaloneBuildRunner.ts (same token→RGBA rows). Installed as the
// runtime color override (UiColorManager::SetColorOverride) when a RENDER_JSON
// carries theme=dark; a plain free function (no captures) per ColorOverrideFunc.
static bool __DarkServerPalette(Dali::StringView id, Dali::Vector4& out)
{
    struct Row { const char* k; Dali::Vector4 v; };
    static const Row table[] = {
        {"Primary",    Dali::Vector4(0.49f, 0.55f, 0.99f, 1.0f)},
        {"Background", Dali::Vector4(0.10f, 0.10f, 0.12f, 1.0f)},
        {"Outline",    Dali::Vector4(0.45f, 0.45f, 0.52f, 1.0f)},
        {"Surface",    Dali::Vector4(0.16f, 0.16f, 0.20f, 1.0f)},
        {"OnSurface",  Dali::Vector4(0.92f, 0.92f, 0.96f, 1.0f)},
        {"OnPrimary",  Dali::Vector4(1.0f,  1.0f,  1.0f,  1.0f)},
    };
    for (const auto& r : table)
        if (id == r.k) { out = r.v; return true; }
    return false;
}

// Predefined UiColor token-id constants (UiColor::PRIMARY etc., ui-color.h:56-58).
// Mapped to their string ids so `UiColor::PRIMARY` parses the same as
// `UiColor("Primary")` through the UiColorManager (override or theme).
static bool SBResolveColorToken(const std::string& token, UiColor& out)
{
    static const struct { const char* expr; const char* id; } kTokenAliases[] = {
        {"UiColor::PRIMARY",    "Primary"},
        {"UiColor::BACKGROUND", "Background"},
        {"UiColor::OUTLINE",    "Outline"},
    };
    std::string id;
    for (const auto& a : kTokenAliases)
        if (token == a.expr) { id = a.id; break; }

    // `UiColor("Name")` string-id form — extract the quoted token name.
    if (id.empty())
    {
        const std::string pfx = "UiColor(\"";
        if (token.size() > pfx.size() + 1 &&
            token.compare(0, pfx.size(), pfx) == 0 && token.back() == ')')
        {
            // strip `UiColor("` ... `")`
            size_t closeQuote = token.rfind('"');
            if (closeQuote != std::string::npos && closeQuote > pfx.size() - 1)
                id = token.substr(pfx.size(), closeQuote - pfx.size());
        }
    }

    if (id.empty()) return false;

    // Resolve through the manager: honors the installed dark override, else the
    // default theme. GetColor returns false if the id is unknown to both.
    // (StringView has no std::string ctor — go via c_str().)
    Dali::Vector4 v;
    if (Dali::Ui::UiColorManager::Get().GetColor(Dali::StringView(id.c_str()), v))
    {
        out = UiColor(v);
        return true;
    }
    // Token recognized but unresolved (no override + not in theme): still build a
    // token-carrying UiColor so it resolves lazily at GetRgba() against whatever
    // override is active at render time.
    out = UiColor(Dali::String(id.c_str()));
    return true;
}

static UiColor SBParseUiColor(const std::string& s)
{
    // A trailing ".WithAlpha(<f>)" (e.g. "Color::CYAN.WithAlpha(0.5f)") overrides
    // the base color's alpha. Strip it off first, remember the alpha to re-apply.
    std::string base = s;
    bool        hasAlpha   = false;
    float       alphaValue = 1.0f;
    {
        const std::string marker = ".WithAlpha(";
        size_t mpos = base.find(marker);
        if (mpos != std::string::npos)
        {
            size_t open  = mpos + marker.size();
            size_t close = base.find(')', open);
            if (close != std::string::npos)
            {
                alphaValue = SBParseFloat(base.substr(open, close - open));
                hasAlpha   = true;
                base       = base.substr(0, mpos); // color expression without .WithAlpha
            }
        }
    }

    UiColor result(0x000000);
    bool    resolved = false;

    // "UiColor(0x1e1e2e)" or "UiColor(0xFF0000FF)" — unchanged hex behavior.
    const std::string prefix = "UiColor(";
    if (base.size() > prefix.size() && base.substr(0, prefix.size()) == prefix &&
        base.back() == ')')
    {
        std::string hex = base.substr(prefix.size(), base.size() - prefix.size() - 1);
        try
        {
            unsigned long v = std::stoul(hex, nullptr, 16);
            result   = UiColor(static_cast<uint32_t>(v));
            resolved = true;
        }
        catch (...) {}
    }

    // UiColor token ids — `UiColor("Primary")` (string form) or `UiColor::PRIMARY`
    // (predefined constant). Resolved through UiColorManager so the installed
    // dark override (theme=dark) reskins them; falls back to the theme otherwise.
    // Honest boundary: hex `UiColor(0x..)` already resolved above and never
    // reaches here, so hex colors are theme-independent.
    if (!resolved)
    {
        UiColor tokenColor;
        if (SBResolveColorToken(base, tokenColor))
        {
            result   = tokenColor;
            resolved = true;
        }
    }

    // Named Dali::Color::* constants (RGBA matching dali-core color-table).
    if (!resolved)
    {
        struct NamedColor { const char* name; float r, g, b, a; };
        static const NamedColor kNamed[] = {
            {"Color::RED",         1.0f, 0.0f, 0.0f, 1.0f},
            {"Color::GREEN",       0.0f, 1.0f, 0.0f, 1.0f},
            {"Color::BLUE",        0.0f, 0.0f, 1.0f, 1.0f},
            {"Color::WHITE",       1.0f, 1.0f, 1.0f, 1.0f},
            {"Color::BLACK",       0.0f, 0.0f, 0.0f, 1.0f},
            {"Color::YELLOW",      1.0f, 1.0f, 0.0f, 1.0f},
            {"Color::CYAN",        0.0f, 1.0f, 1.0f, 1.0f},
            {"Color::MAGENTA",     1.0f, 0.0f, 1.0f, 1.0f},
            {"Color::TRANSPARENT", 0.0f, 0.0f, 0.0f, 0.0f},
        };
        for (const auto& nc : kNamed)
        {
            if (base == nc.name)
            {
                result   = UiColor(nc.r, nc.g, nc.b, nc.a);
                resolved = true;
                break;
            }
        }
    }

    // Unknown non-hex token → loud debug magenta (NOT black, so the bug is visible).
    if (!resolved)
        result = UiColor(1.0f, 0.0f, 1.0f, 1.0f);

    if (hasAlpha)
        result = result.WithAlpha(alphaValue);

    return result;
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
        else if (n == "SetCornerRadius")    view.SetCornerRadius(SBParseFloat(a0));
        else if (n == "SetOpacity")         view.SetOpacity(SBParseFloat(a0));
        else if (n == "SetVisibility")      view.SetVisibility(a0.find("true") != std::string::npos);
        else if (n == "SetBorderlineWidth") view.SetBorderlineWidth(SBParseFloat(a0));
        else if (n == "SetBorderlineColor") view.SetBorderlineColor(SBParseUiColor(a0));
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

        // Method-form text/markup: a `.SetText("...")` or `.SetMarkupEnabled(true)`
        // chained after `Label::New()` lands in properties, not the constructor arg.
        // Enable markup BEFORE assigning method-form text so tags are parsed.
        auto itMarkup = node.properties.find("SetMarkupEnabled");
        if (itMarkup != node.properties.end() && !itMarkup->second.empty())
            lbl.SetMarkupEnabled(itMarkup->second[0].find("true") != std::string::npos);

        auto itText = node.properties.find("SetText");
        if (itText != node.properties.end() && !itText->second.empty())
        {
            std::string mt = itText->second[0];
            if (mt.size() >= 2 && mt.front() == '"' && mt.back() == '"')
                mt = mt.substr(1, mt.size() - 2);
            lbl.SetText(mt.c_str());
        }

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
        // Method-form URL: `.SetResourceUrl("...")` chained after `ImageView::New()`
        // lands in properties, not the constructor arg.
        if (url.empty())
        {
            auto itUrl = node.properties.find("SetResourceUrl");
            if (itUrl != node.properties.end() && !itUrl->second.empty())
                url = itUrl->second[0];
        }
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

            // Parse: RENDER_AT <progress> <png_path> <metadata_path> <width> <height> [theme] [bgColor]
            else if (line.size() >= 9 && line.substr(0, 9) == "RENDER_AT")
            {
                std::string rest = (line.size() > 9) ? line.substr(10) : "";
                std::istringstream iss(rest);
                ReloadRequest req;
                req.isRenderAt = true;
                std::string pStr, wStr, hStr;
                if (!(iss >> pStr >> req.pngPath >> req.metadataPath >> wStr >> hStr))
                {
                    std::cout << ">>>ERROR:malformed RENDER_AT command" << std::endl;
                    continue;
                }
                try
                {
                    req.progress = std::stof(pStr);
                    req.width    = std::stof(wStr);
                    req.height   = std::stof(hStr);
                }
                catch (...)
                {
                    std::cout << ">>>ERROR:malformed RENDER_AT command" << std::endl;
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

        // Async image resources (ImageView URLs) load off the main thread, so the
        // capture must wait for them. Flag their presence so ScheduleCapture takes
        // the resource-polling path instead of grabbing the still-empty first frame
        // (the bug: a flat/parser-path image preview captured before the load even
        // queued → blank). Image-less scenes keep the immediate fast path.
        mHasAsyncResource = (json.find("ImageView") != std::string::npos);

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

        // Install/clear the dark token override per-render (warm-server safe —
        // SetColorOverride refreshes all bindings, ui-color-manager.h:237). When
        // theme=dark, UiColor("Primary") etc. resolve to the dark palette; any
        // other theme clears the override so tokens fall back to the theme
        // (honest: hex colors never route through the override). F3.3.
        if (req.theme == "dark")
            Dali::Ui::UiColorManager::Get().SetColorOverride(&__DarkServerPalette);
        else
            Dali::Ui::UiColorManager::Get().ClearColorOverride();

        // Apply background
        mWindow.SetBackgroundColor(
            req.bgColor.empty() ? ThemeToColor(req.theme) : HexToColor(req.bgColor));

        // Resize window if needed
        // Window::GetSize()/SetSize(WindowSize) were renamed to GetPositionSize()/
        // SetPositionSize(PositionSize) and removed from Dali::Window in dali-adaptor
        // 2.5.29. Use the new API directly so this compiles against a current adaptor in
        // BOTH runtimes — local (host prefix) AND docker (the runtime-release agent's
        // sed-patch is now a no-op). PositionSize is a Rect<int32_t> (.x/.y/.width/.height),
        // so keep the current window position and just change the size.
        Dali::PositionSize winSize = mWindow.GetPositionSize();
        if (static_cast<int>(winSize.width)  != static_cast<int>(req.width) ||
            static_cast<int>(winSize.height) != static_cast<int>(req.height))
        {
            mWindow.SetPositionSize(Dali::PositionSize(winSize.x, winSize.y,
                static_cast<int>(req.width),
                static_cast<int>(req.height)));
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
        if (req.isJson)     { DoRenderJson(req); return; }
        if (req.isRenderAt) { DoRenderAt(req);  return; }

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
        // Window::GetSize()/SetSize(WindowSize) were renamed to GetPositionSize()/
        // SetPositionSize(PositionSize) and removed from Dali::Window in dali-adaptor
        // 2.5.29. Use the new API directly so this compiles against a current adaptor in
        // BOTH runtimes — local (host prefix) AND docker (the runtime-release agent's
        // sed-patch is now a no-op). PositionSize is a Rect<int32_t> (.x/.y/.width/.height),
        // so keep the current window position and just change the size.
        Dali::PositionSize winSize = mWindow.GetPositionSize();
        if (static_cast<int>(winSize.width)  != static_cast<int>(req.width) ||
            static_cast<int>(winSize.height) != static_cast<int>(req.height))
        {
            mWindow.SetPositionSize(Dali::PositionSize(winSize.x, winSize.y,
                static_cast<int>(req.width),
                static_cast<int>(req.height)));
        }

        // Unload previous plugin
        if (mPluginHandle)
        {
            dlclose(mPluginHandle);
            mPluginHandle = nullptr;
        }
        mSetPreviewProgress = nullptr;
        mAnimCount          = 0;

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

        // ABI version gate — run BEFORE any other symbol resolution so an
        // ABI-drifted plugin is refused loudly instead of silently wrong-rendering.
        // A MISSING symbol (old plugin predating the gate) counts as a mismatch and
        // is NOT tolerated, unlike the optional animation symbols resolved below.
        static const int kServerAbiVersion = 1;
        using AbiVersionFn = int (*)();
        AbiVersionFn abiVersion =
            reinterpret_cast<AbiVersionFn>(dlsym(mPluginHandle, "dali_preview_abi_version"));
        if (!abiVersion || abiVersion() != kServerAbiVersion)
        {
            std::string pluginAbi = abiVersion ? std::to_string(abiVersion()) : "missing";
            std::cout << ">>>ERROR:abi mismatch (plugin=" << pluginAbi
                      << ", server=" << kServerAbiVersion
                      << ") — update runtime image" << std::endl;
            dlclose(mPluginHandle);
            mPluginHandle = nullptr;
            mCaptureBusy  = false;
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

        // Resolve optional animation-scrub symbols. Always present in current
        // plugins; mAnimCount is 0 for previews with no .Play() animations.
        mSetPreviewProgress = reinterpret_cast<void(*)(float)>(dlsym(mPluginHandle, "__SetPreviewProgress"));
        {
            using IntFn   = int (*)();
            using FloatFn = float (*)();
            IntFn   animCount = reinterpret_cast<IntFn>(dlsym(mPluginHandle, "__PreviewAnimationCount"));
            FloatFn animDur   = reinterpret_cast<FloatFn>(dlsym(mPluginHandle, "__PreviewAnimationDuration"));
            mAnimCount        = animCount ? animCount() : 0;
            long durationMs   = animDur ? static_cast<long>(animDur() * 1000.0f) : 0L;
            std::cout << ">>>ANIM:" << mAnimCount << ":" << durationMs << std::endl;
        }

        ScheduleCapture();
    }

    void DoRenderAt(const ReloadRequest& req)
    {
        if (!mPluginHandle || !mSetPreviewProgress || mAnimCount == 0)
        {
            std::cout << ">>>ERROR:no animated preview loaded" << std::endl;
            mCaptureBusy = false;   // symmetric with the other bail-outs: drain any queued request
            FlushPending();
            return;
        }
        mCaptureBusy = true;
        mCurrentReq  = req;
        mSetPreviewProgress(req.progress);
        // Let one update cycle apply the new progress before capturing.
        mResourceTimer = Timer::New(32);
        mResourceTimer.TickSignal().Connect(this, [this]() { OnStartCapture(); return false; });
        mResourceTimer.Start();
    }

    void ScheduleCapture()
    {
        // Fast path: if no async image loads are pending, capture immediately.
        // Image-less previews (red-box, plain layouts) skip the polling overhead entirely.
        // A scene with an ImageView always takes the polling path: right after Add()
        // the load is not yet queued, so IsResourceReady() reads true here and the
        // image would be missed — poll instead so it actually loads first.
        if(!mHasAsyncResource && AreAllResourcesReady(Actor(mWindow.GetRootLayer())))
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
    bool         mHasAsyncResource = false; // scene has an ImageView → wait for its async load before capturing

    void*        mPluginHandle;
    void       (*mSetPreviewProgress)(float) = nullptr;
    int          mAnimCount = 0;
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
