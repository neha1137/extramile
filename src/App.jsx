import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Tasks from "./pages/Tasks";
import TaskDetails from "./pages/TaskDetails";
import Opportunities from "./pages/Opportunities";
import Leaderboard from "./pages/Leaderboard";
import Mentors from "./pages/Mentors";
import Notifications from "./pages/Notifications";
import Evaluations from "./pages/Evaluations";
import People from "./pages/People";
import Calendar from "./pages/Calendar";
import { AuthProvider } from "./context/AuthContext";

function Guard({ roles, children }) {
  return <ProtectedRoute allowedRoles={roles}>{children}</ProtectedRoute>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app" element={<Guard><DashboardLayout /></Guard>}>
            <Route index element={<Navigate to="/app/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="tasks" element={<Guard roles={["extra-miler"]}><Tasks /></Guard>} />
            <Route path="tasks/:taskId" element={<Guard roles={["extra-miler"]}><TaskDetails /></Guard>} />
            <Route path="opportunities" element={<Opportunities />} />
            <Route path="leaderboard" element={<Guard roles={["extra-miler", "admin"]}><Leaderboard /></Guard>} />
            <Route path="mentors" element={<Guard roles={["mentor", "admin"]}><Mentors /></Guard>} />
            <Route path="people" element={<People />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="evaluations" element={<Guard roles={["evaluator", "admin"]}><Evaluations /></Guard>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
