/* global React, Icon, FeedScreen, PermalinkScreen, MOCK_POSTS */
/* global TweaksPanel, TweakSection, TweakRadio, TweakToggle, useTweaks */
const { useState } = React;

function CompartidasApp() {
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
    showFeatured: true,
    polaroidRotation: true,
  }; /*EDITMODE-END*/

  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState("feed");
  const [postId, setPostId] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const openPost = (id) => {
    setPostId(id);
    setScreen("permalink");
  };
  const goFeed = () => setScreen("feed");

  // Inject tweaks-driven CSS overrides
  const cssOverrides = `
    ${!t.showFeatured ? ".broadside { display: none !important; }" : ""}
    ${!t.polaroidRotation ? ".polaroid, .photoGrid1 .polaroid, .photoGrid2 .polaroid, .photoGrid3 .polaroid, .photoGrid4 .polaroid, .broadsidePolaroid { transform: none !important; }" : ""}
  `;

  return (
    <div className="app-root">
      <style>{cssOverrides}</style>

      {/* Prototype switcher */}
      <div className="switcher">
        <div className="switcherLogo">
          <span>◆</span>
          <span>turnocero</span>
        </div>
        <div className="switcherCrumb">Compartidas · Reimagined</div>

        <div className="switcherTabs">
          <button
            className={`switcherTab ${screen === "feed" ? "switcherTabActive" : ""}`}
            onClick={() => setScreen("feed")}
          >
            Feed
          </button>
          <button
            className={`switcherTab ${screen === "permalink" ? "switcherTabActive" : ""}`}
            onClick={() => {
              setPostId(postId || MOCK_POSTS[0]._id);
              setScreen("permalink");
            }}
          >
            Permalink
          </button>
        </div>

        <div className="switcherSpacer" />
        <span className="switcherPill">v2 · scrapbook</span>
      </div>

      {screen === "feed" && (
        <FeedScreen onOpenPost={openPost} onLightbox={setLightbox} />
      )}
      {screen === "permalink" && (
        <PermalinkScreen
          postId={postId}
          onBack={goFeed}
          onLightbox={setLightbox}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightboxClose" onClick={() => setLightbox(null)}>
            <Icon.Close />
          </button>
          <div
            className="polaroid"
            style={{
              transform: "rotate(-1deg)",
              maxWidth: "90%",
              maxHeight: "90vh",
            }}
          >
            <div
              className="polaroidPhoto polaroidFallback polaroidPhotoLandscape"
              style={{ width: "min(700px, 80vw)" }}
            >
              {lightbox.caption || "foto"}
            </div>
            {lightbox.caption && (
              <span className="polaroidCaption">{lightbox.caption}</span>
            )}
          </div>
        </div>
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Layout" />
        <TweakToggle
          label="Compartida del día"
          value={t.showFeatured}
          onChange={(v) => setTweak("showFeatured", v)}
        />
        <TweakToggle
          label="Rotación polaroid"
          value={t.polaroidRotation}
          onChange={(v) => setTweak("polaroidRotation", v)}
        />
        <TweakSection label="Demo · Navegación" />
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            onClick={() => setScreen("feed")}
            style={btnStyle(screen === "feed")}
          >
            Feed
          </button>
          <button
            onClick={() => {
              setPostId(MOCK_POSTS[0]._id);
              setScreen("permalink");
            }}
            style={btnStyle(screen === "permalink")}
          >
            Permalink
          </button>
        </div>
      </TweaksPanel>
    </div>
  );
}

function btnStyle(active) {
  return {
    flex: 1,
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#fff" : "var(--text-secondary)",
    border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
    padding: "6px 8px",
    borderRadius: 6,
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(<CompartidasApp />);
