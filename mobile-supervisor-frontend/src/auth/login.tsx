import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./login.module.css";
import { useAuth } from "./AuthContext";
import authService from "../services/auth.ts";
import { FaEye, FaEyeSlash } from "react-icons/fa";

interface LoginFormData {
  username: string;
  password: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await authService.loginAdmin(
        formData.username,
        formData.password
      );
      login(res.user, res.accessToken);
      navigate("/", { replace: true });
    } catch (err) {
      console.log(err);
      setError("Đăng nhập thất bại. Vui lòng kiểm tra user và mật khẩu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginLayout}>
        <div className={styles.loginImage}></div>
        <div className={styles.loginCardWrapper}>
          <div className={styles.loginCard}>
            <div className={styles.loginHeader}>
              <h1 className={styles.loginTitle}>Đăng nhập</h1>
              <p className={styles.loginSubtitle}>
                Vui lòng đăng nhập vào tài khoản của bạn
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.loginForm}>
              {error && <div className={styles.errorMessage}>{error}</div>}

              <div className={styles.formGroup}>
                <label htmlFor="username" className={styles.formLabel}>
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className={styles.formInput}
                  placeholder="Nhập username"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="password" className={styles.formLabel}>
                  Mật khẩu
                </label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    placeholder="Nhập mật khẩu"
                    required
                  />

                  <span
                    className={styles.eyeIcon}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className={`${styles.loginButton} ${
                  isLoading ? styles.loading : ""
                }`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className={styles.buttonContent}>
                    <span className={styles.spinner}></span>
                    Đang đăng nhập...
                  </span>
                ) : (
                  "Đăng nhập"
                )}
              </button>
            </form>

            <div className={styles.loginFooter}>
              <p className={styles.forgotPassword}>
                Quên mật khẩu?
                <a href="#" className={styles.forgotLink}>
                  Nhấn vào đây
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
