import Meeple from "../../components/shared/Meeple";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import { API } from "../../api/endpoints";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import DatabaseSkeleton from "./DatabaseSkeleton";
import styles from "./DatabaseViewer.module.css";

function cellValue(val) {
  if (val === null || val === undefined)
    return <span className={styles.null}>null</span>;
  if (typeof val === "boolean")
    return <span className={styles.bool}>{String(val)}</span>;
  if (typeof val === "object") {
    const str = JSON.stringify(val);
    return (
      <span className={styles.obj} title={str}>
        {str.length > 60 ? `${str.slice(0, 57)}…` : str}
      </span>
    );
  }
  return String(val);
}

function unionKeys(docs) {
  const seen = new Set();
  const keys = [];
  for (const doc of docs) {
    for (const k of Object.keys(doc)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  return keys;
}

function DatabaseViewerInner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [collections, setCollections] = useState([]);
  const [activeCol, setActiveCol] = useState(null);
  const [docs, setDocs] = useState([]);
  const [columns, setColumns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    axios
      .get(API.admin.COLLECTIONS)
      .then(({ data }) => {
        setCollections(data);
        if (data.length > 0) setActiveCol(data[0]);
      })
      .catch(() => setError(t("admin:database.errorCollections")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    if (!activeCol) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = { page, limit: 50 };
        if (debouncedSearch) params.search = debouncedSearch;
        const { data } = await axios.get(
          API.admin.COLLECTION_DETAIL(activeCol),
          { params },
        );
        if (cancelled) return;
        setDocs(data.docs);
        setPagination({
          page: data.page,
          pages: data.pages,
          total: data.total,
        });
        setColumns(unionKeys(data.docs));
      } catch {
        if (!cancelled) setError(t("admin:database.errorData"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCol, page, debouncedSearch]);

  const handleColChange = (name) => {
    if (name === activeCol) return;
    setActiveCol(name);
    setPage(1);
    setSearch("");
    setDocs([]);
    setColumns([]);
  };

  const handleToggleAdmin = async (doc) => {
    setToggling(doc._id);
    try {
      const { data } = await axios.patch(API.admin.USER_TOGGLE_ADMIN(doc._id));
      setDocs((prev) =>
        prev.map((d) =>
          d._id?.toString() === doc._id?.toString()
            ? { ...d, isAdmin: data.isAdmin }
            : d,
        ),
      );
    } catch {
      setError(t("admin:database.errorToggleAdmin"));
    } finally {
      setToggling(null);
    }
  };

  const isUsersCollection = activeCol === "users";

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.eyebrow}>
            <Meeple />
            {t("admin:database.eyebrow")}
          </div>
          <h1 className={styles.title}>{t("admin:database.title")}</h1>
          <p className={styles.sub}>{t("admin:database.sub")}</p>
        </div>

        {collections.length > 0 && (
          <div className={styles.tabs}>
            {collections.map((name) => (
              <button
                key={name}
                className={`${styles.tab} ${activeCol === name ? styles.activeTab : ""}`}
                onClick={() => handleColChange(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {activeCol && (
          <div className={styles.searchBar}>
            <input
              className={styles.searchInput}
              type="text"
              placeholder={t("admin:database.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className={styles.searchClear}
                onClick={() => setSearch("")}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        {loading ? (
          <DatabaseSkeleton />
        ) : !error && docs.length === 0 && activeCol ? (
          <div className={styles.center}>
            <p>
              {debouncedSearch
                ? t("admin:database.noSearchResults", { query: debouncedSearch })
                : t("admin:database.emptyCollection")}
            </p>
          </div>
        ) : (
          columns.length > 0 && (
            <>
              <p className={styles.meta}>
                {debouncedSearch
                  ? t("admin:database.metaSearch", {
                      count: pagination.total,
                      query: debouncedSearch,
                      page: pagination.page,
                      pages: pagination.pages,
                    })
                  : t("admin:database.meta", {
                      count: pagination.total,
                      page: pagination.page,
                      pages: pagination.pages,
                    })}
              </p>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      {columns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                      {isUsersCollection && <th>{t("admin:database.colAdmin")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc, i) => (
                      <tr key={doc._id ?? i}>
                        {columns.map((col) => (
                          <td key={col}>{cellValue(doc[col])}</td>
                        ))}
                        {isUsersCollection && (
                          <td>
                            <button
                              className={`${styles.adminToggle} ${doc.isAdmin ? styles.adminOn : styles.adminOff}`}
                              onClick={() => handleToggleAdmin(doc)}
                              disabled={
                                toggling === doc._id ||
                                doc._id?.toString() === user._id?.toString()
                              }
                              title={
                                doc._id?.toString() === user._id?.toString()
                                  ? t("admin:database.cantRemoveSelf")
                                  : ""
                              }
                            >
                              {toggling === doc._id
                                ? "…"
                                : doc.isAdmin
                                  ? t("admin:database.adminOn")
                                  : t("admin:database.adminOff")}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination.pages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                  >
                    {t("admin:database.prev")}
                  </button>
                  <span className={styles.pageInfo}>
                    {page} / {pagination.pages}
                  </span>
                  <button
                    className={styles.pageBtn}
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === pagination.pages}
                  >
                    {t("admin:database.next")}
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}

export default function DatabaseViewer() {
  // intentionally use isActuallyAdmin (not user.isAdmin) so the page stays accessible
  // when an admin previews the site as a regular user.
  const { isActuallyAdmin } = useAuth();
  if (!isActuallyAdmin) return <Navigate to="/" replace />;
  return <DatabaseViewerInner />;
}
