import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import { getSession, Session, subscribeToSession, UserRole } from "./lib/api";
import AdminDashboard from "./pages/AdminDashboard";
import ApplicationTracker from "./pages/ApplicationTracker";
import CandidateAssessment from "./pages/CandidateAssessment";
import CandidateDashboard from "./pages/CandidateDashboard";
import CandidateInterview from "./pages/CandidateInterview";
import CommunicationCenter from "./pages/CommunicationCenter";
import JobMarketplace from "./pages/JobMarketplace";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RecruiterAssistant from "./pages/RecruiterAssistant";
import RecruiterDashboard from "./pages/RecruiterDashboard";

function useCurrentSession(): Session | null {
  const [session, setSession] = useState<Session | null>(() => getSession());
  useEffect(() => subscribeToSession(() => setSession(getSession())), []);
  return session;
}

function RoleHome() {
  const role = useCurrentSession()?.user.role;
  return <Navigate to={role ? `/${role}` : "/login"} replace />;
}

function RoleRoute({ allowed, children }: { allowed: UserRole[]; children: React.ReactNode }) {
  const role = useCurrentSession()?.user.role;
  if (!role) return <Navigate to="/login" replace />;
  if (!allowed.includes(role)) return <RoleHome />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/jobs" element={<JobMarketplace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/workspace" element={<RoleHome />} />
      <Route element={<AppShell />}>
        <Route path="candidate" element={<RoleRoute allowed={["candidate"]}><CandidateDashboard /></RoleRoute>} />
        <Route path="candidate/applications" element={<RoleRoute allowed={["candidate"]}><ApplicationTracker /></RoleRoute>} />
        <Route path="candidate/messages" element={<RoleRoute allowed={["candidate"]}><CommunicationCenter mode="messages" /></RoleRoute>} />
        <Route path="candidate/interviews" element={<RoleRoute allowed={["candidate"]}><CommunicationCenter mode="interviews" /></RoleRoute>} />
        <Route path="candidate/assessment/:jobId" element={<RoleRoute allowed={["candidate"]}><CandidateAssessment /></RoleRoute>} />
        <Route path="candidate/interview/:jobId" element={<RoleRoute allowed={["candidate"]}><CandidateInterview /></RoleRoute>} />
        <Route path="recruiter" element={<RoleRoute allowed={["recruiter"]}><RecruiterDashboard /></RoleRoute>} />
        <Route path="recruiter/assistant" element={<RoleRoute allowed={["recruiter"]}><RecruiterAssistant /></RoleRoute>} />
        <Route path="recruiter/messages" element={<RoleRoute allowed={["recruiter"]}><CommunicationCenter mode="messages" /></RoleRoute>} />
        <Route path="recruiter/interviews" element={<RoleRoute allowed={["recruiter"]}><CommunicationCenter mode="interviews" /></RoleRoute>} />
        <Route path="admin" element={<RoleRoute allowed={["admin"]}><AdminDashboard /></RoleRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
