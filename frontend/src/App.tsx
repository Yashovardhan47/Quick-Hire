import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { ensureActiveSession, getSession, UserRole } from "./lib/api";
import AccountPage from "./pages/AccountPage";
import AdminDashboard from "./pages/AdminDashboard";
import CandidateAssessment from "./pages/CandidateAssessment";
import CandidateDashboard from "./pages/CandidateDashboard";
import CandidateInterview from "./pages/CandidateInterview";
import LoginPage from "./pages/LoginPage";
import RecruiterDashboard from "./pages/RecruiterDashboard";

function RoleHome() {
  const role = getSession()?.user.role;
  return <Navigate to={role ? `/${role}` : "/login"} replace />;
}

function RoleRoute({ allowed, children }: { allowed: UserRole[]; children: React.ReactNode }) {
  const role = getSession()?.user.role;
  if (!role) return <Navigate to="/login" replace />;
  if (!allowed.includes(role)) return <RoleHome />;
  return children;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    void ensureActiveSession().finally(() => setAuthReady(true));
  }, []);

  if (!authReady) {
    return <main className="auth-loading"><span className="eyebrow">QUICKHIRE</span><h1>Securing your workspace…</h1></main>;
  }

  return (
    <Routes>
      <Route path="/login" element={getSession() ? <RoleHome /> : <LoginPage />} />
      <Route path="/" element={<RoleHome />} />
      <Route element={<AppShell />}>
        <Route path="candidate" element={<RoleRoute allowed={["candidate"]}><CandidateDashboard /></RoleRoute>} />
        <Route path="candidate/assessment/:jobId" element={<RoleRoute allowed={["candidate"]}><CandidateAssessment /></RoleRoute>} />
        <Route path="candidate/interview/:jobId" element={<RoleRoute allowed={["candidate"]}><CandidateInterview /></RoleRoute>} />
        <Route path="recruiter" element={<RoleRoute allowed={["recruiter"]}><RecruiterDashboard /></RoleRoute>} />
        <Route path="admin" element={<RoleRoute allowed={["admin"]}><AdminDashboard /></RoleRoute>} />
        <Route path="account" element={<RoleRoute allowed={["candidate", "recruiter", "admin"]}><AccountPage /></RoleRoute>} />
      </Route>
      <Route path="*" element={<RoleHome />} />
    </Routes>
  );
}
