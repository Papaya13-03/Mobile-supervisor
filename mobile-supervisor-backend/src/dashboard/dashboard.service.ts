import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lấy tổng quan dashboard
   */
  async getOverview() {
    // 1. Đếm tổng số thiết bị
    const totalDevices = await this.prisma.devices.count();

    // 2. Đếm thiết bị active (có hoạt động trong 5 phút)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const activeDevices = await this.prisma.devices.count({
      where: {
        last_seen: {
          gte: fiveMinutesAgo,
        },
      },
    });

    // 3. Thiết bị offline
    const offlineDevices = totalDevices - activeDevices;

    // 4. Tổng số người dùng
    const totalUsers = await this.prisma.users.count();

    // 5. Tổng số BTS stations
    const activeBTS = await this.prisma.bts_stations.count();

    // 6. Trạng thái thiết bị
    const devicesByStatus = [
      { status: 'Hoạt động', count: activeDevices, color: '#10b981' },
      { status: 'Offline', count: offlineDevices, color: '#ef4444' },
    ];

    // 7. Chất lượng tín hiệu (5 phút gần nhất)
    const signalStats = await this.getSignalQualityStats(fiveMinutesAgo);

    // 8. Top locations theo quận Hà Nội
    const topLocations = await this.getTopLocations();

    return {
      summary: {
        totalDevices,
        activeDevices,
        offlineDevices,
        totalUsers,
        activeBTS,
      },
      devicesByStatus,
      signalQuality: signalStats,
      topLocations,
    };
  }

  /**
   * Lấy hoạt động gần đây
   */
  async getRecentActivities(limit: number = 10) {
    // Lấy location history gần nhất
    const recentLocations = await this.prisma.location_history.findMany({
      take: limit,
      orderBy: { recorded_at: 'desc' },
      include: {
        device: {
          include: {
            user: true,
          },
        },
      },
    });

    // Format activities
    const activities = recentLocations.map((location) => {
      const timeDiff = Date.now() - location.recorded_at.getTime();
      const minutesAgo = Math.floor(timeDiff / 60000);

      let timeText = '';
      if (minutesAgo < 1) timeText = 'Vừa xong';
      else if (minutesAgo < 60) timeText = `${minutesAgo} phút trước`;
      else if (minutesAgo < 1440)
        timeText = `${Math.floor(minutesAgo / 60)} giờ trước`;
      else timeText = `${Math.floor(minutesAgo / 1440)} ngày trước`;

      return {
        id: location.id,
        device: location.device.model || 'Unknown Device',
        user: location.device.user?.full_name || 'Unknown User',
        action: 'Di chuyển',
        location: `${location.latitude.toNumber()}, ${location.longitude.toNumber()}`,
        time: timeText,
        type: 'move',
        timestamp: location.recorded_at,
      };
    });

    return activities;
  }

  /**
   * Thống kê chất lượng tín hiệu
   */
  private async getSignalQualityStats(since: Date) {
    // Lấy tất cả cell tower history gần đây
    const signals = await this.prisma.cell_tower_history.findMany({
      where: {
        recorded_at: { gte: since },
        is_serving: true, // Chỉ lấy serving cell
      },
      select: { rssi: true },
    });

    // Phân loại
    const excellent = signals.filter(
      (s) => s.rssi && s.rssi !== null && s.rssi >= -70,
    ).length;
    const good = signals.filter(
      (s) => s.rssi && s.rssi !== null && s.rssi < -70 && s.rssi >= -85,
    ).length;
    const fair = signals.filter(
      (s) => s.rssi && s.rssi !== null && s.rssi < -85 && s.rssi >= -100,
    ).length;
    const poor = signals.filter(
      (s) => s.rssi && s.rssi !== null && s.rssi < -100,
    ).length;

    const total = signals.length || 1; // Tránh chia cho 0

    return [
      {
        range: 'Xuất sắc (-50 đến -70 dBm)',
        count: excellent,
        percentage: Math.round((excellent / total) * 100),
        color: '#10b981',
      },
      {
        range: 'Tốt (-70 đến -85 dBm)',
        count: good,
        percentage: Math.round((good / total) * 100),
        color: '#3b82f6',
      },
      {
        range: 'Trung bình (-85 đến -100 dBm)',
        count: fair,
        percentage: Math.round((fair / total) * 100),
        color: '#f59e0b',
      },
      {
        range: 'Yếu (< -100 dBm)',
        count: poor,
        percentage: Math.round((poor / total) * 100),
        color: '#ef4444',
      },
    ];
  }

  /**
   * Top locations theo quận Hà Nội (Tối ưu với Raw Query)
   */
  private async getTopLocations() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Danh sách 30 quận/huyện Hà Nội
    const hanoiDistricts = [
      'Ba Đình',
      'Hoàn Kiếm',
      'Tây Hồ',
      'Long Biên',
      'Cầu Giấy',
      'Đống Đa',
      'Hai Bà Trưng',
      'Hoàng Mai',
      'Thanh Xuân',
      'Nam Từ Liêm',
      'Bắc Từ Liêm',
      'Hà Đông',
      'Sơn Tây',
      'Ba Vì',
      'Phúc Thọ',
      'Đan Phượng',
      'Hoài Đức',
      'Quốc Oai',
      'Thạch Thất',
      'Chương Mỹ',
      'Thanh Oai',
      'Thường Tín',
      'Phú Xuyên',
      'Ứng Hòa',
      'Mỹ Đức',
      'Sóc Sơn',
      'Đông Anh',
      'Gia Lâm',
      'Mê Linh',
      'Thanh Trì',
    ];

    // Raw query để tối ưu performance
    const result: any[] = await this.prisma.$queryRaw`
      SELECT 
        district,
        COUNT(DISTINCT device_id) as device_count
      FROM location_history
      WHERE 
        recorded_at >= ${fiveMinutesAgo}
        AND district IS NOT NULL
        AND district IN (${hanoiDistricts.join("', '")})
      GROUP BY district
      ORDER BY device_count DESC
      LIMIT 5
    `;

    // Nếu không có dữ liệu, trả về mảng rỗng
    if (!result || result.length === 0) {
      return [];
    }

    const max = Number(result[0]?.device_count) || 1;

    return result.map((item) => ({
      district: item.district,
      devices: Number(item.device_count),
      percentage: Math.round((Number(item.device_count) / max) * 100),
    }));
  }

  /**
   * Thống kê theo thời gian
   */
  async getStats(period: string) {
    let since: Date;
    const now = new Date();

    switch (period) {
      case 'today':
        since = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        since = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        since = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        since = new Date(now.setHours(0, 0, 0, 0));
    }

    // Hoạt động theo giờ (tối ưu với raw query)
    const hourlyData: any[] = await this.prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM recorded_at) as hour,
        COUNT(*) as count
      FROM location_history
      WHERE recorded_at >= ${since}
      GROUP BY EXTRACT(HOUR FROM recorded_at)
      ORDER BY hour
    `;

    // Map dữ liệu vào 24 giờ
    const hourCounts: Record<number, number> = {};
    hourlyData.forEach((item) => {
      hourCounts[Number(item.hour)] = Number(item.count);
    });

    const formattedHourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      count: hourCounts[i] || 0,
    }));

    return {
      period,
      hourlyActivity: formattedHourlyData,
    };
  }
}
