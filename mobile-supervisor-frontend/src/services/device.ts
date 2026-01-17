// src/services/device.ts
import { privateClient } from "./apiClient";

const deviceService = {
  // Lấy danh sách tất cả thiết bị (cho bảng)
  getAll: async (page?: number, limit?: number) => {
    const params: any = {};

    if (page !== undefined) params.page = page;
    if (limit !== undefined) params.limit = limit;

    const response = await privateClient.get("/devices", { params });
    return response.data;
  },

  // Lấy chi tiết 1 thiết bị theo ID (cho bản đồ chi tiết)
  getById: async (id: string) => {
    const response = await privateClient.get(`/devices/${id}`);
    return response.data;
  },

  getHistory: async (deviceId: string, start: string, end: string) => {
    const response = await privateClient.get(`/devices/${deviceId}/history`, {
      params: {
        start,
        end,
      },
    });
    return response.data;
  },

  configureInterval: async (interval: number) => {
    const response = await privateClient.post("/mqtt/publish-interval", {
      interval,
    });
    return response.data;
  },
};

export default deviceService;
