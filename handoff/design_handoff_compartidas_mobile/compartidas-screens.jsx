/* global React, Icon, Avatar, Polaroid, MOCK_POSTS, USERS, timeAgo, formatTableDate */
/* global PostCard, FeaturedBroadside, Composer, Sidebar, MesaTicket, PhotoGrid, PrivacyChip */
const { useState, useMemo } = React;

// ─── FEED SCREEN ─────────────────────────────────────────────
function FeedScreen({ onOpenPost, onLightbox }) {
  const [filter, setFilter] = useState("all");
  const featured = MOCK_POSTS.find((p) => p.featured);
  const rest = MOCK_POSTS.filter((p) => !p.featured);

  return (
    <div className="page">
      <div className="layout">
        <div className="feedCol">
          {/* Page header */}
          <div className="pageHeader">
            <div>
              <div className="heroEyebrow">Comunidad · diario compartido</div>
              <h1 className="heroTitle">
                Lo que <em>jugamos</em> esta semana.
              </h1>
              <p className="heroSub">
                Compartí tus partidas, fotos y momentos. Esto es la bitácora
                abierta de la comunidad — un pedacito de cada mesa, para que no
                se pierda nada.
              </p>
            </div>
            <div className="heroStats">
              <div className="heroStatRow">
                <div>
                  <div className="heroStatVal accent">{MOCK_POSTS.length}</div>
                  <div>Compartidas</div>
                </div>
                <div>
                  <div className="heroStatVal">7</div>
                  <div>Esta semana</div>
                </div>
              </div>
            </div>
          </div>

          {/* Composer */}
          <Composer />

          {/* Featured broadside */}
          {featured && (
            <FeaturedBroadside
              post={featured}
              onOpen={() => onOpenPost(featured._id)}
              onLightbox={onLightbox}
            />
          )}

          {/* Regular posts */}
          {rest.map((post, i) => (
            <PostCard
              key={post._id}
              post={post}
              i={i}
              onOpen={() => onOpenPost(post._id)}
              onLightbox={onLightbox}
            />
          ))}

          <button className="loadMore">↓ Ver más compartidas</button>
        </div>

        <div className="asideCol">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}

// ─── PERMALINK SCREEN ─────────────────────────────────────────
function PermalinkScreen({ postId, onBack, onLightbox }) {
  const post = useMemo(
    () => MOCK_POSTS.find((p) => p._id === postId) || MOCK_POSTS[0],
    [postId],
  );
  const [iLiked, setILiked] = useState(post.iLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [popping, setPopping] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLike = () => {
    if (!iLiked) {
      setPopping(true);
      setTimeout(() => setPopping(false), 400);
    }
    setILiked(!iLiked);
    setLikeCount((c) => c + (iLiked ? -1 : 1));
  };

  return (
    <div className="permalinkPage">
      <button className="permaBack" onClick={onBack}>
        <Icon.ArrowLeft size={11} /> Volver al feed
      </button>

      <article className="permaPost">
        {/* Hero with photos */}
        {post.images?.length > 0 && (
          <div className="permaHero">
            <PhotoGrid
              images={post.images}
              onPhotoClick={(i) => onLightbox(post.images[i])}
            />
          </div>
        )}

        <div className="permaBody">
          {/* Author header */}
          <div className="permaAuthor">
            <Avatar user={post.author} size="lg" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {post.author.name}
                </span>
                {post.author.bgwatch && (
                  <span className="postAuthorRowBg" title="BG Watch">
                    <Icon.Dice size={11} />
                  </span>
                )}
              </div>
              <div className="postMetaLine" style={{ marginTop: 2 }}>
                <span>@{post.author.handle}</span>
                <span>·</span>
                <span>hace {timeAgo(post.createdAt)}</span>
                <PrivacyChip privacy={post.privacy} />
              </div>
            </div>
            <button className="postMenu">
              <Icon.Dots />
            </button>
          </div>

          {/* Title + body */}
          {post.title && <h1 className="permaTitle">{post.title}</h1>}
          {post.body && <p className="permaText">{post.body}</p>}

          {/* Linked mesa */}
          {post.linkedTable && (
            <div style={{ margin: "0 -32px 24px" }}>
              <MesaTicket table={post.linkedTable} />
            </div>
          )}

          {/* Footer */}
          <div
            className="postFooter"
            style={{ margin: "0", padding: "14px 0" }}
          >
            <div className="reactionGroup">
              <button
                className={`reactionBtn ${iLiked ? "active" : ""}`}
                onClick={handleLike}
              >
                <span className={`heart ${popping ? "popping" : ""}`}>
                  <Icon.Heart filled={iLiked} size={18} />
                </span>
                <span>
                  {likeCount} {likeCount === 1 ? "me gusta" : "me gusta"}
                </span>
              </button>
              <button className="reactionBtn">
                <Icon.Comment size={18} />
                <span>{post.comments.length} comentarios</span>
              </button>
            </div>

            <div className="shareGroup">
              <button className="shareIconBtn">
                <Icon.Wa />
              </button>
              <button className="shareIconBtn">
                <Icon.Tg />
              </button>
              <button className="shareIconBtn">
                <Icon.X />
              </button>
              <button
                className={`shareIconBtn ${copied ? "copied" : ""}`}
                onClick={() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Icon.Check /> : <Icon.Link />}
              </button>
            </div>
          </div>

          {/* Full comments thread */}
          <div
            className="comments"
            style={{
              borderTop: "1px solid var(--border)",
              paddingTop: 18,
              margin: "0 -4px",
            }}
          >
            <div className="commentsHead">
              ◆ {post.comments.length} comentarios
            </div>

            {post.comments.map((c, idx) => (
              <div className="comment" key={idx}>
                <Avatar user={c.author} size="sm" />
                <div className="commentBody">
                  <div className="commentMeta">
                    <span className="commentAuthor">{c.author.name}</span>
                    <span className="commentTime">
                      hace {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p className="commentText">{c.content}</p>
                </div>
              </div>
            ))}

            {post.comments.length === 0 && (
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  letterSpacing: "0.04em",
                  textAlign: "center",
                  padding: "20px 0",
                }}
              >
                Sin comentarios aún. ¡Sé el primero!
              </p>
            )}

            <form
              className="commentForm"
              onSubmit={(e) => e.preventDefault()}
              style={{ marginTop: 18 }}
            >
              <Avatar user={USERS.vos} size="sm" />
              <input
                className="commentInput"
                placeholder="Escribí un comentario…"
              />
              <button type="submit" className="commentSubmit">
                <Icon.Send />
              </button>
            </form>
          </div>
        </div>
      </article>
    </div>
  );
}

window.FeedScreen = FeedScreen;
window.PermalinkScreen = PermalinkScreen;
