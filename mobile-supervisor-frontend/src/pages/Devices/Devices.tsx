import React, { useEffect, useState, useCallback } from "react";
import io from "socket.io-client";
import DeviceTable from "../../components/table/device/DeviceTable";
import DeviceDetail from "./DeviceDetail";
import deviceService from "../../services/device";
import type { DeviceRow } from "../../components/table/device/DeviceRow";
import SearchFilterBar from "../../layout/topbar/searchFilterBar";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const container: React.CSSProperties = {
  backgroundAttachment: "fixed",
};
const header: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.95)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  margin: "0rem 1rem",
  borderRadius: "1rem",
};

const headerContent: React.CSSProperties = {
  padding: "1.5rem 1rem",
};

const headerTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "1rem",
};

const headerTitle: React.CSSProperties = {
  fontSize: "2rem",
  fontWeight: 800,
  background: "#ef6e52",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  margin: 0,
};

const refreshBtn: React.CSSProperties = {
  padding: "0.625rem 1.25rem",
  background: "#eb420f",
  color: "#fff",
  border: "none",
  borderRadius: "0.75rem",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.875rem",
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  transition: "all 0.3s ease",
  boxShadow: "0 4px 6px -1px rgba(235, 66, 15, 0.4)",
  opacity: 1,
};

const selectBox: React.CSSProperties = {
  padding: "0.625rem 1rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#374151",
  backgroundColor: "white",
  border: "1.5px solid #fed7aa",
  borderRadius: "0.75rem",
  cursor: "pointer",
  outline: "none",
  transition: "all 0.2s ease",
  minWidth: "200px",
};

const Devices: React.FC = () => {
  const [viewMode, setViewMode] = useState<"list" | "detail">("list");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const [deviceData, setDeviceData] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [page, setPage] = useState<number>(1);
  const limit = 20;
  const [hasMore, setHasMore] = useState<boolean>(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("");

  // State cho config thời gian
  const [configTime, setConfigTime] = useState<string>("60");
  const [isUpdatingConfig, setIsUpdatingConfig] = useState<boolean>(false);

  const mapToDeviceRow = (item: any): DeviceRow => {
    const lastLoc = item.location_history?.[0] || item.last_location;
    const lastCell = item.cell_tower_history?.[0] || item.last_cell;

    let status: "online" | "offline" | "idle" = "offline";
    const lastSeenTime = lastLoc?.recorded_at
      ? new Date(lastLoc.recorded_at)
      : null;

    if (lastSeenTime) {
      const diffMinutes = (Date.now() - lastSeenTime.getTime()) / 60000;
      if (diffMinutes < 5) status = "online";
      else if (diffMinutes < 60) status = "idle";
    }

    return {
      id: item.id,
      userId: item.user?.id || "",
      deviceName: item.model || "Không tên",
      userName: item.user?.full_name || "Chưa đăng ký",
      phoneNumber: item.phone_number,
      status,
      lastSeen: lastSeenTime ? lastSeenTime.toLocaleString("vi-VN") : "-",
      gps: lastLoc
        ? `${Number(lastLoc.latitude).toFixed(4)}, ${Number(
            lastLoc.longitude
          ).toFixed(4)}`
        : "-",
      cellId: lastCell?.cid ? String(lastCell.cid) : "-",
      lacTac: lastCell?.lac ? String(lastCell.lac) : "-",
      mccMnc:
        lastCell?.mcc && lastCell?.mnc
          ? `${lastCell.mcc}/${lastCell.mnc}`
          : "-",
    };
  };

  const fetchDevices = useCallback(
    async (pageNumber: number, append: boolean = false) => {
      if (loading && pageNumber !== 1) return;

      try {
        setLoading(true);
        const response = await deviceService.getAll(pageNumber, limit);

        const rawItems = Array.isArray(response) ? response : response.data;

        const mapped = rawItems.map((item: any) => mapToDeviceRow(item));

        if (mapped.length < limit) setHasMore(false);

        if (append) {
          setDeviceData((prev) => [...prev, ...mapped]);
        } else {
          setDeviceData(mapped);
        }
      } catch (error) {
        console.error("Lỗi khi tải thiết bị:", error);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  // Function xử lý cập nhật config thời gian
  const handleUpdateConfigTime = async () => {
    try {
      setIsUpdatingConfig(true);

      // Gọi API để cập nhật config
      const response = await deviceService.configureInterval(
        Number(configTime)
      );
      console.log("Response từ API config interval:", response);
      if (response.success) {
        console.log("Cập nhật thời gian thành công:", configTime, "giây");
      } else {
        console.error("Lỗi khi cập nhật thời gian");
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật config thời gian:", error);
    } finally {
      setIsUpdatingConfig(false);
    }
  };

  // Function xử lý khi bấm làm mới
  const handleRefresh = async () => {
    setPage(1);
    setHasMore(true);
    await handleUpdateConfigTime(); // Cập nhật config
    fetchDevices(1, false); // Làm mới data
  };

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchDevices(1, false);
  }, []);

  useEffect(() => {
    const socket = io(API_BASE_URL);

    socket.on("connect", () => {
      console.log("Connected to Socket Server");
    });

    socket.on("device_moved", (payload: any) => {
      setDeviceData((currentList) => {
        return currentList.map((dev) => {
          if (dev.id === payload.deviceId) {
            return {
              ...dev,
              status: "online",
              lastSeen: new Date(payload.timestamp).toLocaleString("vi-VN"),
              gps: `${Number(payload.lat).toFixed(4)}, ${Number(
                payload.lon
              ).toFixed(4)}`,
              cellId: payload.cid ? String(payload.cid) : dev.cellId,
              lacTac: payload.lac ? String(payload.lac) : dev.lacTac,
            };
          }
          return dev;
        });
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleLoadMore = () => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDevices(nextPage, true);
  };

  const handleViewDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    setViewMode("detail");
  };

  const handleBackToList = () => {
    setSelectedDeviceId(null);
    setViewMode("list");
    setPage(1);
    setHasMore(true);
    fetchDevices(1, false);
  };

  if (viewMode === "detail" && selectedDeviceId) {
    return (
      <DeviceDetail deviceId={selectedDeviceId} onBack={handleBackToList} />
    );
  }

  const filteredData = deviceData.filter((device) => {
    const q = searchQuery.toLowerCase();
    return (
      (device.userName.toLowerCase().includes(q) ||
        device.deviceName.toLowerCase().includes(q) ||
        device.phoneNumber?.toLowerCase().includes(q)) &&
      (!filter ||
        (filter === "active" && device.status === "online") ||
        (filter === "inactive" && device.status === "offline"))
    );
  });

  return (
    <div style={container}>
      <div style={header}>
        <div style={headerContent}>
          <div style={headerTop}>
            <div>
              <h1 style={headerTitle}>Danh sách thiết bị</h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Box chọn thời gian */}
              <select
                style={selectBox}
                value={configTime}
                onChange={(e) => setConfigTime(e.target.value)}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "#fb923c";
                  e.currentTarget.style.boxShadow =
                    "0 2px 4px rgba(249, 115, 22, 0.15)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "#fed7aa";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <option value="5">5 giây</option>
                <option value="10">10 giây</option>
                <option value="30">30 giây</option>
                <option value="60">1 phút</option>
                <option value="300">5 phút</option>
                <option value="600">10 phút</option>
              </select>

              {/* Nút làm mới */}
              <button
                style={{
                  ...refreshBtn,
                  opacity: loading || isUpdatingConfig ? 0.6 : 1,
                  cursor:
                    loading || isUpdatingConfig ? "not-allowed" : "pointer",
                }}
                onClick={handleRefresh}
                disabled={loading || isUpdatingConfig}
              >
                {loading || isUpdatingConfig ? "Đang xử lý..." : "Làm mới"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <SearchFilterBar
        onSearch={setSearchQuery}
        onFilter={setFilter}
        enableFilter
      />

      <DeviceTable
        data={filteredData}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onViewDevice={handleViewDevice}
      />
    </div>
  );
};

export default Devices;
