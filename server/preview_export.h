#pragma once
/**
 * DALi Preview - shared scene-graph metadata exporter (Family-1).
 *
 * SINGLE SOURCE for the JSON scene export + Actor::CalculateScreenExtents()
 * screen rects. Included by docker/preview_server.cpp (baked / native-local
 * server path) and, from M3b Task 2, server/preview_harness.cpp.template (the
 * fresh full-build harness) so the two exporters can never silently drift.
 *
 * Output shape is the SUPERSET: it emits localX/localY (the actor-local
 * position) in addition to the absolute screen rect. The harness already
 * emitted those two keys; the server previously did not, so adopting this
 * header only ADDS two harmless keys to the server's metadata JSON.
 *
 * These functions use unqualified DALi names (Actor, Vector3, FlexLayout, ...);
 * the using-directives below make the header self-contained. Both includers
 * also declare the same file-scope using-directives, so this is a no-op there.
 */
#include <dali/dali.h>
#include <dali-ui-foundation/dali-ui-foundation.h>

#include <cmath>
#include <fstream>
#include <sstream>
#include <string>

using namespace Dali;
using namespace Dali::Ui;
using Dali::Ui::View;

// Bumped whenever the exported JSON/rect contract changes; used by the
// runtime<->extension ABI handshake in a later M3b/c task.
inline const char* dali_preview_export_version() { return "m3b-1"; }

// ---------------------------------------------------------------------------
// Scene-graph metadata helpers (Family-1 exporter)
// ---------------------------------------------------------------------------

inline std::string JsonEscapeStr(const std::string& s)
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

inline std::string ShortTypeName(const std::string& fullName)
{
    auto pos = fullName.rfind("::");
    return (pos != std::string::npos) ? fullName.substr(pos + 2) : fullName;
}

inline const char* FlexDirectionStr(FlexDirection d)
{
    switch(d) {
        case FlexDirection::ROW:            return "ROW";
        case FlexDirection::ROW_REVERSE:    return "ROW_REVERSE";
        case FlexDirection::COLUMN:         return "COLUMN";
        case FlexDirection::COLUMN_REVERSE: return "COLUMN_REVERSE";
        default:                            return "ROW";
    }
}

inline const char* FlexAlignStr(FlexAlign a)
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

inline const char* FlexJustifyStr(FlexJustify j)
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

inline const char* FlexWrapStr(FlexWrap w)
{
    switch(w) {
        case FlexWrap::NO_WRAP:      return "NO_WRAP";
        case FlexWrap::WRAP:         return "WRAP";
        case FlexWrap::WRAP_REVERSE: return "WRAP_REVERSE";
        default:                     return "NO_WRAP";
    }
}

inline void CollectActorMetadata(Actor actor, std::ostringstream& json,
                                 float pX, float pY, float pW, float pH,
                                 bool isFirst = true)
{
    if (!isFirst) json << ",";

    Dali::String name = actor.GetProperty<Dali::String>(Actor::Property::NAME);
    Vector3 pos = actor.GetCurrentProperty<Vector3>(Actor::Property::POSITION);

    // Absolute screen-space bounds straight from DALi — convention-independent.
    // The old hand-rolled parentOrigin/PIVOT math (x = pX + pW*parentOrigin.x +
    // pos.x - w*anchor.x) silently broke when dali-ui v2.5.28 changed the default
    // actor coordinate convention: the RENDER stayed correct but the reconstructed
    // click-to-code regions landed off-screen (e.g. a full-window container at
    // (-960,-540)). CalculateScreenExtents() is exactly what DALi uses to place the
    // actor, so the reported region always matches where it is drawn — regardless of
    // parentOrigin/anchor defaults. (Mirrors the CLI harness, which already does this.)
    Dali::Rect<float> ext = actor.CalculateScreenExtents();
    float x = std::isfinite(ext.x)      ? ext.x      : 0.0f;
    float y = std::isfinite(ext.y)      ? ext.y      : 0.0f;
    float w = std::isfinite(ext.width)  ? ext.width  : 0.0f;
    float h = std::isfinite(ext.height) ? ext.height : 0.0f;
    (void)pX; (void)pY; (void)pW; (void)pH; // parent-rect threading no longer needed

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
         << "\"localX\":" << pos.x << ",\"localY\":" << pos.y << ","
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

inline void ExportSceneMetadata(Actor root, const std::string& metadataPath,
                                float winW, float winH)
{
    Vector3 rootSize = root.GetCurrentProperty<Vector3>(Actor::Property::SIZE);
    float rW = rootSize.x;
    float rH = rootSize.y;

    std::ostringstream json;
    // M3bc Task 4: stamp the exporter-contract version so the extension can detect
    // a STALE docker image (baked server lagging the fresh harness/code). Emitted
    // as a top-level sibling of "root"; consumers that read root.x/y/w/h/children
    // ignore this unknown key, so it is behavior-preserving for existing readers.
    // Since this header is #included by BOTH the docker server and the harness,
    // both exporters emit it automatically.
    json << "{\"exportVersion\":\"" << dali_preview_export_version() << "\","
         << "\"root\":{\"name\":\"RootLayer\","
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

inline bool AreAllResourcesReady(Actor actor)
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
