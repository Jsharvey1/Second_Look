import { Link, Route, Routes } from 'react-router-dom';
import { isConfigured } from './lib/api';
import { Home } from './pages/Home';
import { Artist } from './pages/Artist';
import { Mentor } from './pages/Mentor';
import { Layout } from './components/Layout';
import { CenterState } from './components/bits';

export default function App() {
  if (!isConfigured) {
    return (
      <Layout>
        <CenterState title="Almost there">
          <p>
            Second Look isn’t connected to its database yet. Add <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> in your hosting settings, then redeploy.
          </p>
        </CenterState>
      </Layout>
    );
  }
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/a/:token" element={<Artist />} />
      <Route path="/m/:token" element={<Mentor />} />
      <Route
        path="*"
        element={
          <Layout>
            <CenterState title="Page not found">
              <p>That address doesn’t lead anywhere.</p>
              <Link className="btn" to="/">Go to Second Look</Link>
            </CenterState>
          </Layout>
        }
      />
    </Routes>
  );
}
