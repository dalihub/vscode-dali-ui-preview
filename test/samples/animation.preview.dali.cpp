// @preview-config: name="AnimTest" width=360 height=640 animation=true duration=2000 fps=10

// Simple animation preview sample:
// A colored box that animates via DALi Animation API.
// Captured as a multi-frame GIF (2s @ 10fps = 20 frames).

auto box = View::New()
    .SetBackgroundColor(Color::BLUE)
    .SetRequestedWidth(100.0f)
    .SetRequestedHeight(100.0f);

Animation anim = Animation::New(3.0f);
anim.AnimateTo(Property(box, Actor::Property::POSITION),
               Vector3(200.0f, 0.0f, 0.0f),
               AlphaFunction::EASE_IN_OUT);
anim.SetLooping(true);
anim.Play();

return box;
