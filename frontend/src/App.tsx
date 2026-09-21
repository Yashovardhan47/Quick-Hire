import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { ensureActiveSession, getSession, UserRole } from "./lib/api";
import { homeForRole } from "./lib/roles";
import AccountPage from "./pages/AccountPage";
import AuthActionPage from "./pages/AuthActionPage";
import AdminDashboard from "./pages/AdminDashboard";
import CandidateAssessment from "./pages/CandidateAssessment";
import CandidateDashboard from "./pages/CandidateDashboard";
import CandidateInterview from "./pages/CandidateInterview";
import CommunicationsPage from "./pages/CommunicationsPage";
import InterviewSchedulePage from "./pages/InterviewSchedulePage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import NotificationsPage from "./pages/NotificationsPage";
import RecruiterAssistantPage from "./pages/RecruiterAssistantPage";
import RecruiterDashboard from "./pages/RecruiterDashboard";

function RoleHome() {
  const role = getSession()?.user.role;
  return <Navigate to={role ? homeForRole(role) : "/login"} replace />;
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
      <Route path="/verify-email" element={<AuthActionPage action="verify" />} />
      <Route path="/reset-password" element={<AuthActionPage action="reset" />} />
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppShell />}>
        <Route path="candidate" element={<RoleRoute allowed={["candidate"]}><CandidateDashboard /></RoleRoute>} />
        <Route path="candidate/assessment/:jobId" element={<RoleRoute allowed={["candidate"]}><CandidateAssessment /></RoleRoute>} />
        <Route path="candidate/interview/:jobId" element={<RoleRoute allowed={["candidate"]}><CandidateInterview /></RoleRoute>} />
        <Route path="candidate/messages" element={<RoleRoute allowed={["candidate"]}><CommunicationsPage /></RoleRoute>} />
        <Route path="candidate/interviews" element={<RoleRoute allowed={["candidate"]}><InterviewSchedulePage /></RoleRoute>} />
        <Route path="recruiter" element={<RoleRoute allowed={["recruiter"]}><RecruiterDashboard /></RoleRoute>} />
        <Route path="recruiter/assistant" element={<RoleRoute allowed={["recruiter"]}><RecruiterAssistantPage /></RoleRoute>} />
        <Route path="recruiter/messages" element={<RoleRoute allowed={["recruiter"]}><CommunicationsPage /></RoleRoute>} />
        <Route path="recruiter/interviews" element={<RoleRoute allowed={["recruiter"]}><InterviewSchedulePage /></RoleRoute>} />
        <Route path="admin" element={<RoleRoute allowed={["admin"]}><AdminDashboard /></RoleRoute>} />
        <Route path="notifications" element={<RoleRoute allowed={["candidate", "recruiter", "admin"]}><NotificationsPage /></RoleRoute>} />
        <Route path="account" element={<RoleRoute allowed={["candidate", "recruiter", "admin"]}><AccountPage /></RoleRoute>} />
      </Route>
      <Route path="*" element={<RoleHome />} />
    </Routes>
  );
}
