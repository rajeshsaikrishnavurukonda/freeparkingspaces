import { useState } from 'react';
import 'leaflet/dist/leaflet.css';
import './App.css';
import { SearchPage } from './views/SearchPage/SearchPage';
import { PrivacyPolicy } from './views/common/PrivacyPolicy';

function App() {
  const [view, setView] = useState<'search' | 'privacy'>('search');

  if (view === 'privacy') {
    return <PrivacyPolicy onBack={() => setView('search')} />;
  }

  return <SearchPage onShowPrivacyPolicy={() => setView('privacy')} />;
}

export default App;
