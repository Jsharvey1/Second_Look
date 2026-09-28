import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Mark } from './Icons';

export function Layout({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="wordmark" aria-label="Second Look home">
            <Mark />
            Second Look
          </Link>
          {note && <div className="topbar-note">{note}</div>}
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          <span>Second Look — feedback on your work before it goes out.</span>
          <span>Prototype · BUS 131, Brandeis University</span>
        </div>
      </footer>
    </div>
  );
}
