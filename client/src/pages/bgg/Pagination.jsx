import styles from './BggProfile.module.css';

export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;

  const range = [];
  const delta = 2;
  const left = Math.max(1, page - delta);
  const right = Math.min(totalPages, page + delta);

  if (left > 1) { range.push(1); if (left > 2) range.push('…'); }
  for (let i = left; i <= right; i++) range.push(i);
  if (right < totalPages) { if (right < totalPages - 1) range.push('…'); range.push(totalPages); }

  return (
    <div className={styles.pagination}>
      <button
        className={styles.pageBtn}
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        type="button"
      >
        ‹
      </button>
      {range.map((item, i) => (
        item === '…'
          ? <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>…</span>
          : (
            <button
              key={item}
              type="button"
              className={`${styles.pageBtn} ${item === page ? styles.pageBtnActive : ''}`}
              onClick={() => onPage(item)}
            >
              {item}
            </button>
          )
      ))}
      <button
        className={styles.pageBtn}
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        type="button"
      >
        ›
      </button>
    </div>
  );
}
