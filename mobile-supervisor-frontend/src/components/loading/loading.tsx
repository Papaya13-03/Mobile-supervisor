import React from "react";
import styles from "./loading.module.css";

const Loading: React.FC = () => {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingContent}>
        <div className={styles.spinner}></div>
        <p className={styles.loadingText}>Đang tải dữ liệu...</p>
      </div>
    </div>
  );
};

export default Loading;
