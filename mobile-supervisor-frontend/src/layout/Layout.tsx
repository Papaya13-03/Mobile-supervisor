import Sidebar from "./sidebar/sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex" }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <main
          style={{
            paddingRight: 12,
            paddingLeft: 12,
            flex: 1,
            backgroundColor: "#f6f6f6",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
