// src/components/DateRangeExportCSV.tsx
import React, { useState } from "react";
import deviceService from "../../services/device.ts";

interface DateRangeExportCSVProps {
  deviceId: string;
  deviceModel?: string;
}

const DateRangeExportCSV: React.FC<DateRangeExportCSVProps> = ({
  deviceId,
  deviceModel = "Device",
}) => {
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Hàm gọi API để lấy dữ liệu lịch sử
  const fetchHistoryData = async (start: string, end: string) => {
    try {
      const response = await deviceService.getHistory(deviceId, start, end);
      return response.data || [];
    } catch (error) {
      console.error("Lỗi khi lấy dữ liệu lịch sử:", error);
      throw error;
    }
  };

  // Hàm chuyển đổi dữ liệu thành CSV
  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return "";

    // Header
    const headers = [
      "Thời gian",
      "Vĩ độ",
      "Kinh độ",
      "Địa chỉ",
      "BTS CID",
      "BTS LAC",
      "BTS MCC",
      "BTS MNC",
      "BTS Địa chỉ",
      "BTS Lat",
      "BTS Lon",
      "Cường độ sóng (dBm)",
      "Is Serving",
    ];

    // Rows
    const rows = data.map((item) => [
      item.timestamp,
      item.latitude,
      item.longitude,
      item.address || "",
      item.bts_cid || "",
      item.bts_lac || "",
      item.bts_mcc || "",
      item.bts_mnc || "",
      item.bts_address || "",
      item.bts_lat || "",
      item.bts_lon || "",
      item.signal_dbm || "",
      item.is_serving ? "Yes" : "No",
    ]);

    // Combine
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    return csvContent;
  };

  // Hàm download file CSV
  const downloadCSV = (csvContent: string, filename: string) => {
    const BOM = "\uFEFF"; // UTF-8 BOM để Excel hiển thị đúng tiếng Việt
    const blob = new Blob([BOM + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Xử lý export
  const handleExport = async () => {
    if (!startDate || !endDate) {
      alert("Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc!");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert("Ngày bắt đầu phải nhỏ hơn ngày kết thúc!");
      return;
    }

    try {
      setIsExporting(true);

      // Gọi API lấy dữ liệu
      const historyData = await fetchHistoryData(startDate, endDate);

      if (historyData.length === 0) {
        alert("Không có dữ liệu trong khoảng thời gian này!");
        return;
      }

      // Chuyển đổi sang CSV
      const csvContent = convertToCSV(historyData);

      // Tạo tên file
      const filename = `${deviceModel}_${deviceId}_${startDate}_${endDate}.csv`;

      // Download
      downloadCSV(csvContent, filename);

      alert(`Đã xuất ${historyData.length} bản ghi thành công!`);
    } catch (error) {
      console.error("Lỗi khi export CSV:", error);
      alert("Có lỗi xảy ra khi xuất file CSV!");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        padding: "15px",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        background: "white",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
    >
      <h3 style={{ margin: "0 0 15px", color: "#374151" }}>
        Xuất dữ liệu lịch sử
      </h3>

      <div
        style={{
          display: "flex",
          gap: "30px",
          alignItems: "flex-end",
          flexWrap: "wrap",
        }}
      >
        {/* Ngày bắt đầu */}
        <div style={{ flex: "1", minWidth: "150px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontSize: "14px",
              fontWeight: "500",
              color: "#374151",
            }}
          >
            Từ ngày:
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        {/* Ngày kết thúc */}
        <div style={{ flex: "1", minWidth: "150px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontSize: "14px",
              fontWeight: "500",
              color: "#374151",
            }}
          >
            Đến ngày:
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #d1d5db",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        {/* Nút Export */}
        <button
          onClick={handleExport}
          disabled={isExporting}
          style={{
            padding: "8px 20px",
            background: isExporting ? "#9ca3af" : "#eb420f",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: isExporting ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "500",
            minWidth: "120px",
          }}
        >
          {isExporting ? "Đang xuất..." : "Export CSV"}
        </button>
      </div>

      {/* Gợi ý */}
      <div
        style={{
          marginTop: "10px",
          fontSize: "12px",
          color: "#6b7280",
        }}
      >
        File CSV bao gồm: thời gian, vị trí (lat/lon), địa chỉ, thông tin BTS
        (CID, LAC, MCC, MNC, địa chỉ, tọa độ), cường độ sóng
      </div>
    </div>
  );
};

export default DateRangeExportCSV;
