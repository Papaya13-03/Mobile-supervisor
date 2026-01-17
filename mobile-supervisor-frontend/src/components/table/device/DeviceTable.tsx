import React, { useMemo, useState, useRef, useEffect } from "react";
import type { DeviceRow } from "./DeviceRow";
import styles from "./DeviceTable.module.css";
import EmptyState from "../../common/EmptyState";

type SortKey = keyof Pick<
  DeviceRow,
  | "deviceName"
  | "userName"
  | "status"
  | "lastSeen"
  | "gps"
  | "cellId"
  | "lacTac"
  | "mccMnc"
>;
type SortDir = "asc" | "desc";

export interface DeviceTableProps {
  data?: DeviceRow[];
  onRowClick?: (row: DeviceRow) => void;
  onViewDevice?: (deviceId: string) => void;
  // Infinite scroll props
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

export const DeviceTable: React.FC<DeviceTableProps> = ({
  data = [],
  onRowClick,
  onViewDevice,
  onLoadMore,
  hasMore = false,
  loading = false,
}) => {
  const [sortKey, setSortKey] = useState<SortKey>("deviceName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const loaderRef = useRef<HTMLTableRowElement | null>(null);

  // Infinite Scroll Observer
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          onLoadMore?.();
        }
      },
      { root: null, threshold: 1 }
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loaderRef.current, hasMore]);

  // Helper compare
  function compare(a: string, b: string) {
    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function compareByKey(a: DeviceRow, b: DeviceRow, key: SortKey) {
    if (key === "lastSeen") {
      const da = Date.parse(a.lastSeen);
      const db = Date.parse(b.lastSeen);
      if (!isNaN(da) && !isNaN(db)) return da - db;
    }
    return compare(String(a[key] ?? ""), String(b[key] ?? ""));
  }

  // Sorting logic
  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const sign = sortDir === "asc" ? 1 : -1;
      return sign * compareByKey(a, b, sortKey);
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => (
    <span className={active ? styles.sortIconActive : styles.sortIcon}>
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );

  const statusClass = (s: DeviceRow["status"]) =>
    s === "online"
      ? styles.statusOnline
      : s === "offline"
      ? styles.statusOffline
      : styles.statusIdle;

  return (
    <div
      role="region"
      aria-label="Bảng thiết bị"
      className={styles.tableContainer}
    >
      {sorted.length === 0 ? (
        <EmptyState fullHeight description="Không có dữ liệu thiết bị." />
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>
                <button
                  className={styles.thButton}
                  onClick={() => toggleSort("deviceName")}
                >
                  Thiết bị{" "}
                  <SortIcon active={sortKey === "deviceName"} dir={sortDir} />
                </button>
              </th>

              <th className={styles.th}>
                <button
                  className={styles.thButton}
                  onClick={() => toggleSort("userName")}
                >
                  Người dùng{" "}
                  <SortIcon active={sortKey === "userName"} dir={sortDir} />
                </button>
              </th>

              <th className={styles.th}>SĐT</th>

              <th className={styles.th}>
                <button
                  className={styles.thButton}
                  onClick={() => toggleSort("status")}
                >
                  Trạng thái{" "}
                  <SortIcon active={sortKey === "status"} dir={sortDir} />
                </button>
              </th>

              <th className={styles.th}>
                <button
                  className={styles.thButton}
                  onClick={() => toggleSort("lastSeen")}
                >
                  Lần cuối{" "}
                  <SortIcon active={sortKey === "lastSeen"} dir={sortDir} />
                </button>
              </th>

              <th className={styles.th}>
                <button
                  className={styles.thButton}
                  onClick={() => toggleSort("gps")}
                >
                  GPS <SortIcon active={sortKey === "gps"} dir={sortDir} />
                </button>
              </th>

              <th className={styles.th}>CellID / LAC</th>
              <th className={styles.th}>MCC / MNC</th>
              <th className={styles.th} style={{ textAlign: "center" }}>
                Thao tác
              </th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? styles.rowClickable : undefined}
              >
                <td className={styles.td}>
                  <div style={{ fontWeight: 500 }}>{row.deviceName}</div>
                </td>

                <td className={styles.td}>{row.userName}</td>
                <td className={styles.td}>{row.phoneNumber}</td>

                <td className={styles.td}>
                  <span className={`${styles.pill} ${statusClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>

                <td className={styles.td}>{row.lastSeen}</td>
                <td className={styles.td}>{row.gps}</td>

                <td className={styles.td}>
                  {row.cellId} / {row.lacTac}
                </td>

                <td className={styles.td}>{row.mccMnc}</td>

                <td className={styles.td}>
                  <div className={styles.actionGroup}>
                    {/* Xem thiết bị */}
                    <button
                      className={styles.actionBtn}
                      title="Chi tiết thiết bị"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewDevice?.(row.id);
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <rect x="5" y="2" width="14" height="20" rx="2" />
                        <line x1="12" y1="18" x2="12.01" y2="18" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Row loading */}
            {loading && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", padding: 12 }}>
                  Đang tải thêm dữ liệu...
                </td>
              </tr>
            )}

            {/* Sentinel để trigger loadMore */}
            {hasMore && (
              <tr ref={loaderRef}>
                <td colSpan={9} style={{ height: 1 }}></td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default DeviceTable;
