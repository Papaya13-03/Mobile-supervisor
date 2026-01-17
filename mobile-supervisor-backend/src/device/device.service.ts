import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    // console.time('TOTAL findAll');

    // console.time('Query devices + count');
    const [total, devices] = await Promise.all([
      this.prisma.devices.count(),
      this.prisma.devices.findMany({
        skip,
        take: limit,
        orderBy: { last_seen: 'desc' },
        select: {
          id: true,
          model: true,
          phone_number: true,
          user: {
            select: { id: true, full_name: true },
          },
          location_history: {
            orderBy: { recorded_at: 'desc' },
            take: 1,
          },
        },
      }),
    ]);
    // console.timeEnd('Query devices + count');

    const deviceIds = devices.map((d) => d.id);

    // Lấy recorded_at mới nhất cho mỗi device
    // console.time('GroupBy latestTimes');
    const latestTimes = await this.prisma.cell_tower_history.groupBy({
      by: ['device_id'],
      where: { device_id: { in: deviceIds } },
      _max: { recorded_at: true },
    });
    // console.timeEnd('GroupBy latestTimes');

    // Lấy tất cả cell tower tại các thời điểm mới nhất
    // console.time('Query allLatestCells');
    const allLatestCells = await this.prisma.cell_tower_history.findMany({
      where: {
        OR: latestTimes.map((t) => ({
          device_id: t.device_id,
          recorded_at: t._max.recorded_at!,
        })),
      },
    });
    // console.timeEnd('Query allLatestCells');

    // Group theo device_id
    // console.time('Group in memory');
    const cellMap = new Map<string, any[]>();

    for (const cell of allLatestCells) {
      if (!cellMap.has(cell.device_id)) {
        cellMap.set(cell.device_id, []);
      }
      cellMap.get(cell.device_id)!.push(cell);
    }
    // console.timeEnd('Group in memory');

    // Transform
    // console.time('Transform results');
    const transformed = devices.map((device) => {
      const lastLoc = device.location_history?.[0];

      const cells = cellMap.get(device.id) || [];
      const servingCell = cells.find((c) => c.is_serving) || cells[0] || null;

      return {
        id: device.id,
        model: device.model,
        phone_number: device.phone_number,
        user: device.user,

        last_location: lastLoc
          ? {
              latitude: Number(lastLoc.latitude),
              longitude: Number(lastLoc.longitude),
              recorded_at: lastLoc.recorded_at,
            }
          : null,

        last_cell: servingCell
          ? {
              cid: servingCell.cid,
              lac: servingCell.lac,
              mcc: servingCell.mcc,
              mnc: servingCell.mnc,
              rssi: servingCell.rssi,
              recorded_at: servingCell.recorded_at,
            }
          : null,
      };
    });
    // console.timeEnd('Transform results');

    // console.timeEnd('TOTAL findAll');

    return {
      data: transformed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * API cho Bản đồ chi tiết (Map): Lấy trạng thái hiện tại
   */
  async findOne(id: string) {
    console.time('TOTAL findOne');
    const device = await this.prisma.devices.findUnique({
      where: { id },
      include: {
        user: true,
        location_history: {
          orderBy: { recorded_at: 'desc' },
          take: 1,
        },
        cell_tower_history: {
          orderBy: { recorded_at: 'desc' },
          take: 20,
        },
      },
    });

    if (!device) {
      throw new NotFoundException(`Không tìm thấy thiết bị: ${id}`);
    }

    const lastLocRaw = device.location_history[0];
    const currentLocation = lastLocRaw
      ? {
          latitude: Number(lastLocRaw.latitude),
          longitude: Number(lastLocRaw.longitude),
          recorded_at: lastLocRaw.recorded_at,
        }
      : null;

    const latestTimestamp = device.cell_tower_history[0]?.recorded_at;

    const currentBatch = device.cell_tower_history.filter(
      (cell) => cell.recorded_at.getTime() === latestTimestamp?.getTime(),
    );

    const servingCellRaw =
      currentBatch.find((c) => c.is_serving) || currentBatch[0];

    const neighborCellsRaw = currentBatch.filter(
      (c) => c.id !== servingCellRaw?.id,
    );

    let connectedStation: BtsStation | null = null;
    if (servingCellRaw) {
      connectedStation = await this.lookupBtsStation(servingCellRaw);
    }

    const neighborStations: BtsStation[] = [];
    if (neighborCellsRaw.length > 0) {
      const results = await Promise.all(
        neighborCellsRaw.map((cell) => this.lookupBtsStation(cell)),
      );
      neighborStations.push(...results.filter((s) => s !== null));
    }
    console.timeEnd('TOTAL findOne');
    return {
      ...device,
      current_location: currentLocation,
      connected_station: connectedStation,
      neighbor_stations: neighborStations,
      current_cell: servingCellRaw,
      location_history: undefined,
      cell_tower_history: undefined,
    };
  }

  /**
   * HISTORY API
   */
  async getHistory(deviceId: string, start: string, end: string) {
    if (!start || !end) {
      throw new BadRequestException('Thiếu tham số start hoặc end');
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestException('Định dạng ngày không hợp lệ');
    }

    if (startDate > endDate) {
      throw new BadRequestException('Ngày bắt đầu phải nhỏ hơn ngày kết thúc');
    }

    endDate.setHours(23, 59, 59, 999);

    const device = await this.prisma.devices.findUnique({
      where: { id: deviceId },
      select: { id: true, model: true, phone_number: true },
    });

    if (!device) {
      throw new NotFoundException(`Không tìm thấy thiết bị: ${deviceId}`);
    }

    // === Lấy GPS ===
    const locationHistory: LocationRecord[] =
      await this.prisma.location_history.findMany({
        where: {
          device_id: deviceId,
          recorded_at: { gte: startDate, lte: endDate },
        },
        orderBy: { recorded_at: 'asc' },
      });

    // === Lấy Cell tower ===
    const cellHistory: CellTowerRecord[] =
      await this.prisma.cell_tower_history.findMany({
        where: {
          device_id: deviceId,
          recorded_at: { gte: startDate, lte: endDate },
        },
        orderBy: { recorded_at: 'asc' },
      });

    // === GHÉP THEO TIMESTAMP CHÍNH XÁC ===
    const mergedData = await this.mergeHistoryData(
      locationHistory,
      cellHistory,
    );

    return {
      device,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      total_records: mergedData.length,
      data: mergedData,
    };
  }

  /**
   * MERGE lịch sử theo timestamp
   * → Không tìm "closest"
   * → Chỉ chọn cell có timestamp giống GPS
   */
  private async mergeHistoryData(
    locationHistory: LocationRecord[],
    cellHistory: CellTowerRecord[],
  ) {
    const result: any[] = [];

    for (const location of locationHistory) {
      // Lấy cell cùng timestamp
      const cellsAtSameTime = cellHistory.filter(
        (c) => c.recorded_at.getTime() === location.recorded_at.getTime(),
      );

      const servingCell = cellsAtSameTime.find((c) => c.is_serving) || null;

      const btsInfo = servingCell
        ? await this.lookupBtsStation(servingCell)
        : null;

      result.push({
        timestamp: location.recorded_at.toISOString(),
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        address: location.address ?? null,

        // Cell tower từ packet
        bts_cid: servingCell?.cid ?? null,
        bts_lac: servingCell?.lac ?? null,
        bts_mcc: servingCell?.mcc ?? null,
        bts_mnc: servingCell?.mnc ?? null,
        signal_dbm: servingCell?.rssi ?? null,
        is_serving: servingCell?.is_serving ?? false,

        // Station info
        bts_address: btsInfo?.address ?? null,
        bts_lat: btsInfo?.lat ?? null,
        bts_lon: btsInfo?.lon ?? null,

        // Có thể muốn thêm neighbor_cells
        neighbor_cells: cellsAtSameTime.filter((c) => !c.is_serving),
      });
    }

    return result;
  }

  private async lookupBtsStation(cell: CellTowerRecord) {
    if (!cell.cid || !cell.lac || !cell.mcc || !cell.mnc) return null;

    const station = await this.prisma.bts_stations.findUnique({
      where: {
        unique_cell_id: {
          cid: cell.cid,
          lac: cell.lac,
          mcc: cell.mcc,
          mnc: cell.mnc,
        },
      },
    });

    if (!station) return null;

    return {
      ...station,
      lat: Number(station.lat),
      lon: Number(station.lon),
    };
  }
}
// LOCATION HISTORY RECORD
interface LocationRecord {
  id: string;
  device_id: string;
  recorded_at: Date;
  latitude: Prisma.Decimal;
  longitude: Prisma.Decimal;
  address?: string | null;
}

// CELL TOWER RECORD
interface CellTowerRecord {
  id: string;
  device_id: string;
  recorded_at: Date;
  cid: number | null;
  lac: number | null;
  mcc: number | null;
  mnc: number | null;
  rssi?: number | null;
  is_serving?: boolean;
}

// BTS STATION
type BtsStation = {
  id: number;
  lat: number;
  lon: number;
  address: string | null;
  created_at: Date;
  mcc: number;
  mnc: number;
  lac: number;
  cid: number;
  radio: string | null;
  range: number | null;
  updated_at: Date;
};
