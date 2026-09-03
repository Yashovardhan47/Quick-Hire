import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import AdminDashboard from "./pages/AdminDashboard";
import CandidateDashboard from "./pages/CandidateDashboard";
import RecruiterDashboard from "./pages/RecruiterDashboard";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/candidate" replace />} />
        <Route path="candidate" element={<CandidateDashboard />} />
        <Route path="recruiter" element={<RecruiterDashboard />} />
        <Route path="admin" element={<AdminDashboard />} />
      </Route>
    </Routes>
  );
}

