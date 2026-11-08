import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from './components/RequireRole';
import { AdminLayout } from './components/layouts/AdminLayout';
import { CitizenLayout } from './components/layouts/CitizenLayout';
import { CommitteeLayout } from './components/layouts/CommitteeLayout';
import { PlainLayout } from './components/layouts/PlainLayout';
import { Root } from './components/layouts/Root';
import AdminDashboard from './pages/admin/Dashboard';
import Allocations from './pages/admin/Allocations';
import Notices from './pages/admin/Notices';
import Proxy from './pages/admin/Proxy';
import Stats from './pages/admin/Stats';
import CommitteeAdmin from './pages/admin/CommitteeAdmin';
import Draw from './pages/admin/Draw';
import MeetingDetail from './pages/admin/MeetingDetail';
import Migrate from './pages/admin/Migrate';
import ReviewDetail from './pages/admin/ReviewDetail';
import ReviewList from './pages/admin/ReviewList';
import Recruitments from './pages/admin/Recruitments';
import Warnings from './pages/admin/Warnings';
import ReviewNew from './pages/admin/ReviewNew';
import Apply from './pages/citizen/Apply';
import GardenDetail from './pages/citizen/GardenDetail';
import GardenSearch from './pages/citizen/GardenSearch';
import CitizenHome from './pages/citizen/Home';
import MyApplications from './pages/citizen/MyApplications';
import Helper from './pages/citizen/Helper';
import CitizenNotices from './pages/citizen/Notices';
import MyPlots from './pages/citizen/MyPlots';
import RealFarmDetail from './pages/citizen/RealFarmDetail';
import Register from './pages/citizen/Register';
import RegisterNew from './pages/citizen/RegisterNew';
import AgendaDetail from './pages/committee/AgendaDetail';
import MemberHome from './pages/committee/MemberHome';
import Ordinance from './pages/ordinance/Ordinance';
import Privacy from './pages/ordinance/Privacy';

// 백엔드 없는 정적 배포(GitHub Pages·Netlify·Vercel)에서도 새로고침이 깨지지 않도록 HashRouter를 쓴다.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Root />}>
          {/* 시민 · 텃밭 제공자 (한 계정이 겸용) */}
          <Route
            element={
              <RequireRole roles={['citizen', 'provider']}>
                <CitizenLayout />
              </RequireRole>
            }
          >
            <Route index element={<CitizenHome />} />
            <Route path="gardens" element={<GardenSearch />} />
            <Route path="gardens/:id" element={<GardenDetail />} />
            <Route path="farms/:id" element={<RealFarmDetail />} />
            <Route path="apply" element={<Apply />} />
            <Route path="my/applications" element={<MyApplications />} />
            <Route path="my/plots" element={<MyPlots />} />
            <Route path="notices" element={<CitizenNotices />} />
            <Route path="helper" element={<Helper />} />
            <Route path="register" element={<Register />} />
            <Route path="register/new" element={<RegisterNew />} />
          </Route>

          {/* 텃밭지원과 관리자(간사) */}
          <Route
            path="admin"
            element={
              <RequireRole roles={['admin']}>
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="review" element={<ReviewList />} />
            <Route path="review/new" element={<ReviewNew />} />
            <Route path="review/:id" element={<ReviewDetail />} />
            <Route path="committee" element={<CommitteeAdmin />} />
            <Route path="committee/meetings/:id" element={<MeetingDetail />} />
            <Route path="committee/migrate" element={<Migrate />} />
            <Route path="recruitments" element={<Recruitments />} />
            <Route path="draw" element={<Draw />} />
            <Route path="allocations" element={<Allocations />} />
            <Route path="warnings" element={<Warnings />} />
            <Route path="notices" element={<Notices />} />
            <Route path="stats" element={<Stats />} />
            <Route path="proxy" element={<Proxy />} />
          </Route>

          {/* 도시농업위원회 심의위원 */}
          <Route
            path="committee"
            element={
              <RequireRole roles={['member']}>
                <CommitteeLayout />
              </RequireRole>
            }
          >
            <Route index element={<MemberHome />} />
            <Route path="agendas/:id" element={<AgendaDetail />} />
          </Route>

          {/* 공통 */}
          <Route element={<PlainLayout />}>
            <Route path="ordinance" element={<Ordinance />} />
            <Route path="privacy" element={<Privacy />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
