import Sidebar from "./components/Sidebar";

export default function App() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-[#f0f0f4]">
      <div className="shadow-[0_16px_70px_rgba(0,0,0,0.12)] rounded-xl overflow-hidden">
        <Sidebar />
      </div>
    </div>
  );
}
