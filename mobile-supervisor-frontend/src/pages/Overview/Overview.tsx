import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Users,
  Smartphone,
  Radio,
  MapPin,
  Activity,
  AlertTriangle,
  Clock,
} from "lucide-react";
import dashboardService from "../../services/dashboard";
import styles from "./Overview.module.css";
import Loading from "../../components/loading/loading";

interface DashboardData {
  summary: {
    totalDevices: number;
    activeDevices: number;
    offlineDevices: number;
    totalUsers: number;
    activeBTS: number;
    alerts: number;
  };
  devicesByStatus: Array<{
    status: string;
    count: number;
    color: string;
  }>;
  signalQuality: Array<{
    range: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  topLocations: Array<{
    district: string;
    devices: number;
    percentage: number;
  }>;
  recentActivities: Array<{
    id: string;
    device: string;
    user: string;
    action: string;
    location: string;
    time: string;
    type: string;
  }>;
}

interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle?: string;
  color: string;
}

const fetchDashboardData = async (): Promise<DashboardData> => {
  try {
    const [overviewData, activitiesData] = await Promise.all([
      dashboardService.getOverview(),
      dashboardService.getActivities(10),
    ]);

    return {
      summary: overviewData.summary,
      devicesByStatus: overviewData.devicesByStatus,
      signalQuality: overviewData.signalQuality,
      topLocations: overviewData.topLocations,
      recentActivities: activitiesData,
    };
  } catch (error) {
    console.error("Error loading dashboard:", error);
    throw error;
  }
};

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
}) => {
  const colorClass = color.replace("text-", "");
  const bgColor = `bg-${colorClass.replace("600", "100")}`;

  return (
    <div className={styles.statCard}>
      <div className={styles.statCardContent}>
        <div className={styles.statCardInfo}>
          <p className={styles.statCardTitle}>{title}</p>
          <p className={`${styles.statCardValue} ${color}`}>{value}</p>
          {subtitle && <p className={styles.statCardSubtitle}>{subtitle}</p>}
        </div>
        <div className={`${styles.statCardIcon} ${bgColor}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setError(null);
      const result = await fetchDashboardData();
      setData(result);
    } catch (error: any) {
      console.error("Error loading dashboard:", error);
      setError(
        error.response?.data?.message || "Không thể tải dữ liệu dashboard"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <AlertTriangle className={styles.errorIcon} />
          <h2 className={styles.errorTitle}>Lỗi tải dữ liệu</h2>
          <p className={styles.errorMessage}>{error}</p>
          <button onClick={loadData} className={styles.errorButton}>
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case "connect":
        return <Activity className="w-5 h-5 text-green-600" />;
      default:
        return <MapPin className="w-5 h-5 text-blue-600" />;
    }
  };

  const getActivityBgColor = (type: string) => {
    switch (type) {
      case "alert":
        return "bg-red-100";
      case "connect":
        return "bg-green-100";
      default:
        return "bg-blue-100";
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.headerTop}>
            <div>
              <h1 className={styles.headerTitle}>Dashboard Tổng Quan</h1>
              <p className={styles.headerSubtitle}>
                <Clock className="w-4 h-4" />
                Hệ thống giám sát thiết bị di động - Cập nhật lúc{" "}
                {new Date().toLocaleTimeString("vi-VN")}
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className={styles.refreshButton}
            >
              <Activity
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {/* Stats Overview */}
        <div className={styles.statsGrid}>
          <StatCard
            icon={Smartphone}
            title="Tổng thiết bị"
            value={data.summary.totalDevices.toLocaleString()}
            subtitle={`${data.summary.activeDevices} đang hoạt động`}
            color="text-blue-600"
          />
          <StatCard
            icon={Users}
            title="Người dùng"
            value={data.summary.totalUsers.toLocaleString()}
            subtitle="Đã đăng ký"
            color="text-green-600"
          />
          <StatCard
            icon={Radio}
            title="Trạm BTS"
            value={data.summary.activeBTS.toLocaleString()}
            subtitle="Đang hoạt động"
            color="text-purple-600"
          />
        </div>

        {/* Charts */}
        <div className={styles.chartsGrid}>
          {/* Device Status */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Trạng thái thiết bị</h3>
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
            <div className={styles.chartContent}>
              {data.devicesByStatus.map((item, idx) => (
                <div key={idx} className={styles.chartItem}>
                  <div className={styles.chartItemHeader}>
                    <span className={styles.chartItemLabel}>{item.status}</span>
                    <span className={styles.chartItemValue}>
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${
                          (item.count / data.summary.totalDevices) * 100
                        }%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Signal Quality */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h3 className={styles.chartTitle}>Chất lượng tín hiệu</h3>
              <Activity className="w-5 h-5 text-gray-400" />
            </div>
            <div className={styles.chartContent}>
              {data.signalQuality.map((item, idx) => (
                <div key={idx} className={styles.chartItem}>
                  <div className={styles.chartItemHeader}>
                    <span className={styles.chartItemLabel}>{item.range}</span>
                    <span
                      className={styles.chartItemValue}
                      style={{ color: item.color }}
                    >
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activities & Locations */}
        <div className={styles.activitiesGrid}>
          {/* Recent Activities */}
          <div className={styles.activitiesCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Hoạt động gần đây</h3>
            </div>
            <div className={styles.activitiesList}>
              {data.recentActivities && data.recentActivities.length > 0 ? (
                data.recentActivities.map((activity) => (
                  <div key={activity.id} className={styles.activityItem}>
                    <div className={styles.activityContent}>
                      <div
                        className={`${styles.activityIcon} ${getActivityBgColor(
                          activity.type
                        )}`}
                      >
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className={styles.activityDetails}>
                        <div className={styles.activityTop}>
                          <div>
                            <p className={styles.activityDevice}>
                              {activity.device}
                            </p>
                            <p className={styles.activityUser}>
                              {activity.user}
                            </p>
                          </div>
                          <span className={styles.activityTime}>
                            {activity.time}
                          </span>
                        </div>
                        <p className={styles.activityLocation}>
                          {activity.action} • <MapPin className="w-3 h-3" />{" "}
                          {activity.location}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>Chưa có hoạt động nào</div>
              )}
            </div>
          </div>

          {/* Top Locations */}
          <div className={styles.locationsCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Khu vực phổ biến</h3>
            </div>
            <div className={styles.locationsContent}>
              {data.topLocations && data.topLocations.length > 0 ? (
                <div className={styles.locationsList}>
                  {data.topLocations.map((location, idx) => (
                    <div key={idx} className={styles.locationItem}>
                      <div className={styles.locationHeader}>
                        <span className={styles.locationName}>
                          {location.district}
                        </span>
                        <span className={styles.locationCount}>
                          {location.devices}
                        </span>
                      </div>
                      <div className={styles.locationBar}>
                        <div
                          className={styles.locationBarFill}
                          style={{ width: `${location.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>Chưa có dữ liệu vị trí</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
