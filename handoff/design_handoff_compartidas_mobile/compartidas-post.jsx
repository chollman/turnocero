/* global React, Icon, Avatar, Polaroid, USERS, MOCK_POSTS, UPCOMING_TABLES, TOP_GAMES, BGWATCH_USER, PULL_QUOTE, timeAgo, formatTableDate */
const { useState, useRef, useEffect } = React;

// ─── Privacy icon ─────────────────────────────────────────────
function PrivacyChip({ privacy }) {
  if (privacy === "public") {
    return (
      <span className="postPrivacy">
        <Icon.Globe /> Público
      </span>
    );
  }
  if (privacy === "friends") {
    return (
      <span className="postPrivacy">
        <Icon.Users /> Amigos
      </span>
    );
  }
  return (
    <span className="postPrivacy">
      <Icon.Lock /> Solo yo
    </span>
  );
}

// ─── Linked mesa as mini ticket ───────────────────────────────
function MesaTicket({ table }) {
  const isOpen = table.status === "open";
  return (
    <div className="mesaTicket">
      <div className="mesaTile">{table.gameInitial || "🎲"}</div>
      <div className="mesaInfo">
        <div className="mesaLabel">◆ Mesa enlazada</div>
        <div className="mesaGame">{table.game}</div>
        <div className="mesaMeta">
          <span>{formatTableDate(table.date)}</span>
          {table.location && <span>· {table.location}</span>}
          {isOpen && (
            <span>
              · {table.seats} lugar{table.seats !== 1 ? "es" : ""}
            </span>
          )}
        </div>
      </div>
      <button className={`mesaCta ${isOpen ? "" : "mesaCtaGhost"}`}>
        {isOpen ? "Unirse →" : "Ver mesa"}
      </button>
    </div>
  );
}

// ─── Photo grid (1-4) ─────────────────────────────────────────
function PhotoGrid({ images, onPhotoClick }) {
  const n = Math.min(images.length, 4);
  const gridCls = `photoGrid${n}`;
  return (
    <div className={`postPhotos ${gridCls}`}>
      {images.slice(0, n).map((img, i) => {
        // First image of 1-grid = landscape; otherwise square
        const aspect = n === 1 ? "landscape" : "square";
        return (
          <div
            key={i}
            className="polaroidWrap"
            onClick={() => onPhotoClick?.(i)}
          >
            <Polaroid
              caption={img.caption}
              aspect={aspect}
              tape={n === 1}
              tapePos={i % 2 === 0 ? "left" : "right"}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Post card (standard, not featured) ──────────────────────
function PostCard({ post, i, onOpen, onLightbox }) {
  const [iLiked, setILiked] = useState(post.iLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [popping, setPopping] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const visibleComments = showAllComments
    ? post.comments
    : post.comments.slice(-2);
  const bodyLong = post.body.length > 220;
  const displayBody =
    expanded || !bodyLong ? post.body : `${post.body.slice(0, 220)}…`;

  const handleLike = () => {
    if (!iLiked) {
      setPopping(true);
      setTimeout(() => setPopping(false), 400);
    }
    setILiked(!iLiked);
    setLikeCount((c) => c + (iLiked ? -1 : 1));
  };

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="post" style={{ "--i": i }}>
      {/* Header */}
      <div className="postHeader">
        <Avatar user={post.author} size="md" />
        <div className="postAuthor">
          <div className="postAuthorRow">
            <span className="postAuthorName">{post.author.name}</span>
            {post.author.bgwatch && (
              <span className="postAuthorRowBg" title="Tiene BG Watch activo">
                <Icon.Dice size={11} />
              </span>
            )}
          </div>
          <div className="postMetaLine">
            <span className="postDateStamp">
              ◆ hace {timeAgo(post.createdAt)}
            </span>
            <PrivacyChip privacy={post.privacy} />
          </div>
        </div>
        <button className="postMenu">
          <Icon.Dots />
        </button>
      </div>

      {/* Title + body */}
      <div className="postBody">
        {post.title && (
          <h3
            className="postTitle"
            onClick={onOpen}
            style={{ cursor: "pointer" }}
          >
            {post.title}
          </h3>
        )}
        {post.body && <p className="postText">{displayBody}</p>}
        {bodyLong && (
          <button className="expandBtn" onClick={() => setExpanded((e) => !e)}>
            {expanded ? "— Ver menos" : "+ Ver más"}
          </button>
        )}
      </div>

      {/* Photos */}
      {post.images?.length > 0 && (
        <PhotoGrid
          images={post.images}
          onPhotoClick={(i) => onLightbox(post.images[i])}
        />
      )}

      {/* Linked mesa */}
      {post.linkedTable && <MesaTicket table={post.linkedTable} />}

      {/* Footer */}
      <div className="postFooter">
        <div className="reactionGroup">
          <button
            className={`reactionBtn ${iLiked ? "active" : ""}`}
            onClick={handleLike}
          >
            <span className={`heart ${popping ? "popping" : ""}`}>
              <Icon.Heart filled={iLiked} />
            </span>
            <span>{likeCount}</span>
          </button>
          <button className="reactionBtn" onClick={onOpen}>
            <Icon.Comment />
            <span>{post.comments.length}</span>
          </button>
        </div>

        <div className="shareGroup">
          <button className="shareIconBtn" title="WhatsApp">
            <Icon.Wa />
          </button>
          <button className="shareIconBtn" title="Telegram">
            <Icon.Tg />
          </button>
          <button className="shareIconBtn" title="X">
            <Icon.X />
          </button>
          <button
            className={`shareIconBtn ${copied ? "copied" : ""}`}
            title={copied ? "¡Copiado!" : "Copiar enlace"}
            onClick={handleCopy}
          >
            {copied ? <Icon.Check /> : <Icon.Link />}
          </button>
        </div>
      </div>

      {/* Comments preview */}
      {post.comments.length > 0 && (
        <div className="comments">
          {post.comments.length > 2 && !showAllComments && (
            <button
              className="commentsToggle"
              onClick={() => setShowAllComments(true)}
            >
              Ver {post.comments.length} comentarios →
            </button>
          )}
          {visibleComments.map((c, idx) => (
            <div className="comment" key={idx}>
              <Avatar user={c.author} size="xs" />
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

          <form className="commentForm" onSubmit={(e) => e.preventDefault()}>
            <Avatar user={USERS.vos} size="xs" />
            <input
              className="commentInput"
              placeholder="Escribí un comentario…"
            />
            <button type="submit" className="commentSubmit">
              <Icon.Send />
            </button>
          </form>
        </div>
      )}

      {/* If no comments, just show input */}
      {post.comments.length === 0 && (
        <div className="comments">
          <form className="commentForm" onSubmit={(e) => e.preventDefault()}>
            <Avatar user={USERS.vos} size="xs" />
            <input
              className="commentInput"
              placeholder="Sé el primero en comentar…"
            />
            <button type="submit" className="commentSubmit">
              <Icon.Send />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

// ─── Featured broadside ───────────────────────────────────────
function FeaturedBroadside({ post, onOpen, onLightbox }) {
  const [iLiked, setILiked] = useState(post.iLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  return (
    <article
      className="broadside"
      onClick={onOpen}
      style={{ cursor: "pointer" }}
    >
      <div className="broadsideLabel">◆ Compartida del día</div>
      <div>
        <div className="broadsideEyebrow">
          <Avatar user={post.author} size="xs" />
          <span>
            Por{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {post.author.name}
            </strong>{" "}
            · hace {timeAgo(post.createdAt)}
          </span>
        </div>
        <h2 className="broadsideTitle">{post.title}</h2>
        <p className="broadsideBody">{post.pullQuote || post.body}</p>
        <div className="broadsideMeta">
          {post.linkedTable && (
            <span>
              ◆ <strong>{post.linkedTable.game}</strong>
            </span>
          )}
          <span>♥ {likeCount}</span>
          <span>💬 {post.comments.length}</span>
        </div>
      </div>
      <div className="broadsidePhotoWrap">
        <div className="broadsidePolaroid">
          <Polaroid
            caption={post.images?.[0]?.caption || "la partida"}
            aspect="square"
            tape
            tapePos="center"
          />
        </div>
      </div>
    </article>
  );
}

// ─── Composer ────────────────────────────────────────────────
function Composer() {
  const [expanded, setExpanded] = useState(false);
  const [privacy, setPrivacy] = useState("public");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasMesa, setHasMesa] = useState(false);

  if (!expanded) {
    return (
      <div className="composer">
        <div className="composerRow">
          <Avatar user={USERS.vos} size="md" />
          <button className="composerTrigger" onClick={() => setExpanded(true)}>
            ¿Qué jugaste hoy, Vos?
          </button>
          <div className="composerActions">
            <button
              className="composerIconBtn"
              title="Subir fotos"
              onClick={() => {
                setExpanded(true);
                setHasPhoto(true);
              }}
            >
              <Icon.Image size={17} />
            </button>
            <button
              className="composerIconBtn"
              title="Enlazar mesa"
              onClick={() => {
                setExpanded(true);
                setHasMesa(true);
              }}
            >
              <Icon.Dice size={17} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="composer expanded">
      <div className="composerRow" style={{ alignItems: "flex-start" }}>
        <Avatar user={USERS.vos} size="md" />
        <div className="composerForm" style={{ flex: 1 }}>
          <input
            className="composerTitleInput"
            placeholder="Un título corto (opcional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            rows={4}
            placeholder="¿Cómo estuvo la partida? Contala…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          <div className="composerAttachRow">
            <button
              className={`attachChip ${hasPhoto ? "attachChipActive" : ""}`}
              onClick={() => setHasPhoto((p) => !p)}
            >
              <Icon.Image size={13} />{" "}
              {hasPhoto ? "3 fotos adjuntas" : "Agregar fotos"}
            </button>
            <button
              className={`attachChip ${hasMesa ? "attachChipActive" : ""}`}
              onClick={() => setHasMesa((m) => !m)}
            >
              <Icon.Dice size={13} />{" "}
              {hasMesa ? "Mesa: Wingspan · Jue 21" : "Enlazar mesa"}
            </button>
          </div>

          <div className="composerFooter">
            <div className="privacyRow">
              <button
                className={`privacyOpt ${privacy === "public" ? "privacyOptActive" : ""}`}
                onClick={() => setPrivacy("public")}
              >
                <Icon.Globe size={11} /> Público
              </button>
              <button
                className={`privacyOpt ${privacy === "friends" ? "privacyOptActive" : ""}`}
                onClick={() => setPrivacy("friends")}
              >
                <Icon.Users size={11} /> Amigos
              </button>
              <button
                className={`privacyOpt ${privacy === "private" ? "privacyOptActive" : ""}`}
                onClick={() => setPrivacy("private")}
              >
                <Icon.Lock size={11} /> Solo yo
              </button>
            </div>
            <div className="composerBtns">
              <button
                className="btnGhost"
                onClick={() => {
                  setExpanded(false);
                  setBody("");
                  setTitle("");
                  setHasPhoto(false);
                  setHasMesa(false);
                }}
              >
                Cancelar
              </button>
              <button className="btnPrimary" disabled={!body.trim()}>
                Publicar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PostCard = PostCard;
window.FeaturedBroadside = FeaturedBroadside;
window.Composer = Composer;
window.PrivacyChip = PrivacyChip;
window.MesaTicket = MesaTicket;
window.PhotoGrid = PhotoGrid;
