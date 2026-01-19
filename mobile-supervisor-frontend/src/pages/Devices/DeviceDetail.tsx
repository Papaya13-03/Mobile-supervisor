// src/pages/Devices/DeviceDetail.tsx
import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import io from "socket.io-client";
import deviceService from "../../services/device";
import btsService from "../../services/bts";
import DateRangeExportCSV from "../../components/exportCsv/exportCsv";
import Loading from "../../components/loading/loading";

// --- CẤU HÌNH ICON LEAFLET ---
import iconMarker from "leaflet/dist/images/marker-icon.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import cellTowerIcon from "../../assets/cell-tower.png";
import { FaUser } from "react-icons/fa";
import { MdSignalCellular4Bar } from "react-icons/md";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// --- HẰNG SỐ CẤU HÌNH ---
const UPDATE_THROTTLE = 1000;
const MIN_MOVE_THRESHOLD = 20;
const BUFFER_SIZE = 5;
const MAX_SPEED_KPH = 150;

// --- CSS STYLES ---
const container: React.CSSProperties = {
  backgroundAttachment: "fixed",
  margin: "1rem 1rem",
  background: "#f6f6f6",
  borderRadius: "12px",
  boxShadow: "0 4px 6px -1px rgba(249, 115, 22, 0.1)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
  gap: "12px",
  flexWrap: "wrap",
};

const backButton: React.CSSProperties = {
  padding: "10px 20px",
  border: "1.5px solid #fed7aa",
  borderRadius: "8px",
  background: "white",
  color: "#f97316",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const refreshButton: React.CSSProperties = {
  padding: "10px 20px",
  background: "#eb420f",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontWeight: 600,
  fontSize: "14px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  boxShadow: "0 4px 6px -1px rgba(249, 115, 22, 0.4)",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

const exportContainer: React.CSSProperties = {
  marginBottom: "20px",
};

const infoGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "20px",
  marginBottom: "20px",
};

const infoCard: React.CSSProperties = {
  padding: "20px",
  border: "1.5px solid #fed7aa",
  borderRadius: "12px",
  background: "white",
  transition: "all 0.2s ease",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
};

const infoCardTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "16px",
  color: "#374151",
  fontSize: "16px",
  fontWeight: 700,
};

const infoRow: React.CSSProperties = {
  marginBottom: "10px",
  fontSize: "14px",
  color: "#374151",
  lineHeight: "1.6",
};

const infoLabel: React.CSSProperties = {
  fontWeight: 600,
  color: "#1f2937",
};

const servingBtsText: React.CSSProperties = {
  color: "#f97316",
  fontWeight: 600,
};

const mapContainer: React.CSSProperties = {
  height: "500px",
  borderRadius: "12px",
  overflow: "hidden",
  border: "1.5px solid #fed7aa",
  boxShadow: "0 4px 6px -1px rgba(249, 115, 22, 0.1)",
};

const noDataContainer: React.CSSProperties = {
  display: "flex",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
  background: "#fff7ed",
  color: "#9a3412",
  fontSize: "16px",
  fontWeight: 500,
};

const notFoundContainer: React.CSSProperties = {
  padding: "40px",
  textAlign: "center",
  fontSize: "16px",
  color: "#374151",
};

// Fix lỗi icon mặc định
const defaultIcon = L.icon({
  iconRetinaUrl: iconRetina,
  iconUrl: iconMarker,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

// Các loại Icon tùy chỉnh
const btsIcon = new L.Icon({
  iconUrl: cellTowerIcon,
  iconSize: [60, 60],
  iconAnchor: [20, 40],
});

const neighborIcon = new L.Icon({
  iconUrl: cellTowerIcon,
  iconSize: [50, 50],
  iconAnchor: [15, 30],
  className: "neighbor-marker",
});

const generalBtsIcon = new L.Icon({
  iconUrl: cellTowerIcon,
  iconSize: [45, 45],
  iconAnchor: [12, 25],
  className: "general-bts-marker",
});

// --- HÀM TÍNH KHOẢNG CÁCH (Haversine Formula) ---
const getDistanceFromLatLonInMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d * 1000;
};

interface DeviceDetailProps {
  deviceId: string;
  onBack: () => void;
}

// Component phụ để load BTS khi di chuyển map
const BtsLoader: React.FC<{
  onBoundsChange: (bounds: L.LatLngBounds) => void;
}> = ({ onBoundsChange }) => {
  const map = useMap();
  useMapEvents({
    moveend: () => onBoundsChange(map.getBounds()),
    zoomend: () => onBoundsChange(map.getBounds()),
  });
  useEffect(() => {
    onBoundsChange(map.getBounds());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

const DeviceDetail: React.FC<DeviceDetailProps> = ({ deviceId, onBack }) => {
  // --- STATE ---
  const [info, setInfo] = useState<any>(null);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [cellInfo, setCellInfo] = useState<any>(null);

  const [btsInfo, setBtsInfo] = useState<any>(null);
  const [neighborInfo, setNeighborInfo] = useState<any[]>([]);
  const [allBtsInView, setAllBtsInView] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  // --- REFS ĐỂ XỬ LÝ LOGIC ---
  const pendingUpdate = useRef<any>(null);
  const lastUpdateTime = useRef<number>(0);
  const updateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastValidPos = useRef<[number, number] | null>(null);
  const positionBuffer = useRef<[number, number][]>([]);

  // --- API CALL ---
  const fetchDetail = async () => {
    try {
      setLoading(true);
      const result = await deviceService.getById(deviceId);
      setInfo(result);

      if (result.current_location) {
        const point: [number, number] = [
          Number(result.current_location.latitude),
          Number(result.current_location.longitude),
        ];
        setCurrentPos(point);

        lastValidPos.current = point;
        positionBuffer.current = [point];
      }

      if (result.connected_station) {
        setBtsInfo({
          ...result.connected_station,
          lat: Number(result.connected_station.lat),
          lon: Number(result.connected_station.lon),
        });
      }

      if (result.neighbor_stations && Array.isArray(result.neighbor_stations)) {
        const neighbors = result.neighbor_stations.map((s: any) => ({
          ...s,
          lat: Number(s.lat),
          lon: Number(s.lon),
        }));
        setNeighborInfo(neighbors);
      }

      if (result.current_cell) {
        setCellInfo(result.current_cell);
      }
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadBtsInViewport = async (bounds: L.LatLngBounds) => {
    try {
      const params = {
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLon: bounds.getWest(),
        maxLon: bounds.getEast(),
      };
      const btsData = await btsService.getByBoundingBox(params);
      const formattedBts = (btsData || []).map((bts: any) => ({
        ...bts,
        lat: Number(bts.lat || bts.latitude),
        lon: Number(bts.lon || bts.longitude),
      }));
      setAllBtsInView(formattedBts);
    } catch (error) {
      console.error("Lỗi tải BTS:", error);
    }
  };

  useEffect(() => {
    if (deviceId) fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  // --- XỬ LÝ BATCH UPDATE VỚI THUẬT TOÁN LỌC ---
  const processBatchUpdate = useCallback(() => {
    if (!pendingUpdate.current) return;

    const payload = pendingUpdate.current;
    pendingUpdate.current = null;

    const rawLat = Number(payload.lat);
    const rawLon = Number(payload.lon);

    if (payload.accuracy && payload.accuracy > 100) {
      console.log("Bỏ qua do độ chính xác kém:", payload.accuracy);
      return;
    }

    positionBuffer.current.push([rawLat, rawLon]);
    if (positionBuffer.current.length > BUFFER_SIZE) {
      positionBuffer.current.shift();
    }

    const avgLat =
      positionBuffer.current.reduce((a, b) => a + b[0], 0) /
      positionBuffer.current.length;
    const avgLon =
      positionBuffer.current.reduce((a, b) => a + b[1], 0) /
      positionBuffer.current.length;

    let isValidMove = true;

    if (lastValidPos.current) {
      const dist = getDistanceFromLatLonInMeters(
        lastValidPos.current[0],
        lastValidPos.current[1],
        avgLat,
        avgLon
      );

      if (dist < MIN_MOVE_THRESHOLD) {
        isValidMove = false;
        console.log(`Bỏ qua do di chuyển nhỏ: ${dist.toFixed(1)}m`);
      } else {
        const timeDiff = (Date.now() - lastUpdateTime.current) / 1000;
        if (timeDiff > 0) {
          const speedKph = (dist / timeDiff) * 3.6;
          if (speedKph > MAX_SPEED_KPH) {
            console.log(`Bỏ qua do tốc độ ảo: ${speedKph.toFixed(0)} km/h`);
            isValidMove = false;
          }
        }
      }
    }

    if (payload.current_cell || payload.rssi || payload.signal_dbm) {
      setCellInfo((prev: any) => ({
        ...prev,
        ...(payload.current_cell || {}),
        rssi: payload.rssi || payload.current_cell?.rssi || prev?.rssi,
        signal_dbm:
          payload.signal_dbm ||
          payload.current_cell?.signal_dbm ||
          prev?.signal_dbm,
      }));
    }

    if (payload.connected_station) {
      const newBtsInfo = {
        ...payload.connected_station,
        lat: Number(payload.connected_station.lat),
        lon: Number(payload.connected_station.lon),
      };
      setBtsInfo(newBtsInfo);
      console.log("Cập nhật Serving BTS mới:", newBtsInfo.cid);
    }

    if (payload.neighbor_stations && Array.isArray(payload.neighbor_stations)) {
      const neighbors = payload.neighbor_stations.map((s: any) => ({
        ...s,
        lat: Number(s.lat),
        lon: Number(s.lon),
      }));
      setNeighborInfo(neighbors);
      console.log("Cập nhật Neighbors:", neighbors.length, "trạm");
    }

    if (isValidMove) {
      const validPoint: [number, number] = [avgLat, avgLon];
      lastValidPos.current = validPoint;
      setCurrentPos(validPoint);

      console.log(
        `Cập nhật vị trí mới: ${avgLat.toFixed(6)}, ${avgLon.toFixed(6)}`
      );

      if (payload.device) {
        setInfo((prev: any) => ({
          ...prev,
          ...payload.device,
          current_location: { latitude: avgLat, longitude: avgLon },
        }));
      }
    } else {
      console.log("Giữ nguyên vị trí cũ (movement không hợp lệ)");
    }

    lastUpdateTime.current = Date.now();
  }, []);

  // --- SOCKET LISTENER ---
  useEffect(() => {
    if (!deviceId) return;
    const socket = io(API_BASE_URL);

    socket.on("device_moved", (payload: any) => {
      if (payload.deviceId === deviceId) {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTime.current;

        pendingUpdate.current = payload;

        if (timeSinceLastUpdate >= UPDATE_THROTTLE) {
          if (updateTimeout.current) clearTimeout(updateTimeout.current);
          processBatchUpdate();
        } else {
          if (updateTimeout.current) clearTimeout(updateTimeout.current);
          updateTimeout.current = setTimeout(() => {
            processBatchUpdate();
          }, UPDATE_THROTTLE - timeSinceLastUpdate);
        }
      }
    });

    return () => {
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      socket.disconnect();
    };
  }, [deviceId, processBatchUpdate]);

  const filteredGeneralBts = useMemo(() => {
    const servingCid = btsInfo?.cid;
    const neighborCids = new Set(neighborInfo.map((n) => n.cid));
    return allBtsInView.filter(
      (bts) => bts.cid !== servingCid && !neighborCids.has(bts.cid)
    );
  }, [allBtsInView, btsInfo, neighborInfo]);

  if (loading) return <Loading />;

  if (!info)
    return (
      <div style={notFoundContainer}>
        Không tìm thấy thiết bị.{" "}
        <button
          onClick={onBack}
          style={{
            ...backButton,
            marginTop: "12px",
          }}
        >
          Quay lại
        </button>
      </div>
    );

  return (
    <div style={container}>
      {/* HEADER */}
      <div style={header}>
        <button
          onClick={onBack}
          style={backButton}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#fff7ed";
            e.currentTarget.style.borderColor = "#fb923c";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow =
              "0 4px 6px rgba(249, 115, 22, 0.15)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "white";
            e.currentTarget.style.borderColor = "#fed7aa";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          ← Quay lại danh sách
        </button>
        <button
          onClick={fetchDetail}
          style={refreshButton}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "#ea580c";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow =
              "0 6px 12px rgba(249, 115, 22, 0.5)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#eb420f";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow =
              "0 4px 6px -1px rgba(249, 115, 22, 0.4)";
          }}
        >
          Làm mới
        </button>
      </div>

      <div style={exportContainer}>
        <DateRangeExportCSV deviceId={deviceId} deviceModel={info.model} />
      </div>

      {/* INFO PANELS */}
      <div style={infoGrid}>
        <div
          style={infoCard}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = "#fb923c";
            e.currentTarget.style.boxShadow =
              "0 4px 6px rgba(249, 115, 22, 0.15)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = "#fed7aa";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={infoCardTitle}>
            <FaUser size={18} />
            <h3 style={{ margin: 0 }}>Thông tin chủ sở hữu</h3>
          </div>
          <div>
            <div style={infoRow}>
              <span style={infoLabel}>Họ tên:</span>{" "}
              {info.user?.full_name || "Chưa cập nhật"}
            </div>
            <div style={infoRow}>
              <span style={infoLabel}>CCCD:</span>{" "}
              {info.user?.citizen_id || "Chưa cập nhật"}
            </div>
            <div style={infoRow}>
              <span style={infoLabel}>Địa chỉ:</span>{" "}
              {info.user?.address || "Chưa cập nhật"}
            </div>
          </div>
        </div>

        <div
          style={infoCard}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = "#fb923c";
            e.currentTarget.style.boxShadow =
              "0 4px 6px rgba(249, 115, 22, 0.15)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = "#fed7aa";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={infoCardTitle}>
            <MdSignalCellular4Bar size={20} />
            <h3 style={{ margin: 0 }}>Trạng thái kết nối</h3>
          </div>
          <div>
            <div style={infoRow}>
              <span style={infoLabel}>Model:</span> {info.model}
            </div>
            <div style={{ ...infoRow, ...servingBtsText }}>
              <span style={infoLabel}>Serving BTS:</span>{" "}
              {btsInfo?.address || "Chưa xác định"} (CID:{" "}
              {btsInfo?.cid || "N/A"})
            </div>
            <div style={infoRow}>
              <span style={infoLabel}>Neighbors:</span> {neighborInfo.length}{" "}
              trạm
            </div>
            <div style={infoRow}>
              <span style={infoLabel}>Signal:</span>{" "}
              {cellInfo?.signal_dbm || cellInfo?.rssi || "N/A"} dBm
            </div>
          </div>
        </div>
      </div>

      {/* MAP CONTAINER */}
      <div style={mapContainer}>
        {currentPos ? (
          <MapContainer
            center={currentPos}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <BtsLoader onBoundsChange={loadBtsInViewport} />

            {/* Marker Thiết bị */}
            <Marker position={currentPos} zIndexOffset={1000}>
              <Popup>
                <b>{info.model}</b>
                <br />
                {new Date().toLocaleTimeString()}
              </Popup>
            </Marker>

            {/* Serving BTS */}
            {btsInfo && btsInfo.lat && (
              <>
                <Marker
                  position={[btsInfo.lat, btsInfo.lon]}
                  icon={btsIcon}
                  zIndexOffset={500}
                >
                  <Popup>
                    <b style={{ color: "#f97316" }}>Serving Cell</b>
                    <br />
                    {btsInfo.address}
                    <br />
                    CID: {btsInfo.cid}
                  </Popup>
                </Marker>
                <Circle
                  center={[btsInfo.lat, btsInfo.lon]}
                  radius={btsInfo.range || 500}
                  pathOptions={{
                    color: "#f97316",
                    fillOpacity: 0.05,
                    weight: 2,
                  }}
                />
                <Polyline
                  positions={[currentPos, [btsInfo.lat, btsInfo.lon]]}
                  pathOptions={{
                    color: "#f97316",
                    dashArray: "10, 10",
                    weight: 2,
                  }}
                />
              </>
            )}

            {/* Neighbor BTS */}
            {neighborInfo.map((n, i) => (
              <Marker
                key={`n-${i}`}
                position={[n.lat, n.lon]}
                icon={neighborIcon}
                opacity={0.7}
              >
                <Popup>
                  <b>Neighbor</b>
                  <br />
                  {n.address}
                  <br />
                  CID: {n.cid}
                </Popup>
              </Marker>
            ))}

            {/* General BTS */}
            {filteredGeneralBts.map((bts, i) => (
              <Marker
                key={`g-${i}`}
                position={[bts.lat, bts.lon]}
                icon={generalBtsIcon}
                opacity={0.5}
              >
                <Popup>
                  <b>BTS</b>
                  <br />
                  {bts.address}
                  <br />
                  CID: {bts.cid}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        ) : (
          <div style={noDataContainer}>
            <p>Chưa có dữ liệu vị trí GPS</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceDetail;
