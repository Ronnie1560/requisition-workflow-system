import { useState, useEffect } from 'react'
import './App.css'
import { useStickyState } from './hooks/useStickyState'
import {
  INITIAL_PARTNERS,
  INITIAL_TRIPS,
  INITIAL_ITEMS,
  INITIAL_IMPACT_STATS,
  MOCK_TRIPS_HISTORICAL,
  MOCK_PASTORS
} from './data/initialData'

import Header from './components/Layout/Header'
import AdminDashboard from './components/Layout/AdminDashboard'
import PublicView from './components/Views/PublicView'
import { ToastProvider } from './components/UI/ToastProvider'

import AdminDashboardHome from './components/Modules/AdminDashboardHome'
import MissionTripsManager from './components/Modules/MissionTripsManager'
import MinistryPartnersManager from './components/Modules/MinistryPartnersManager'
import ItemCatalogManager from './components/Modules/ItemCatalogManager'
import SubBudgetManager from './components/Modules/SubBudgetManager'
import EnhancedPastorCRM from './components/Modules/EnhancedPastorCRM'
import BibleDistributionManager from './components/Modules/BibleDistributionManager'
import MercyBagManager from './components/Modules/MercyBagManager'
import MedicalOutreachManager from './components/Modules/MedicalOutreachManager'
import HistoricalReports from './components/Modules/HistoricalReports'
import SettingsPanel from './components/Modules/SettingsPanel'
import BibleInventory from './components/Modules/BibleInventory'

function App() {
  const [activeView, setActiveView] = useState('public'); // 'public' or 'admin'
  const [adminTab, setAdminTab] = useState('home');
  const [isOffline, setIsOffline] = useState(false);

  // --- STATE MANAGEMENT ---
  const [pastors, setPastors] = useStickyState(MOCK_PASTORS, 'fbcc_pastors');
  const [bibleQty, setBibleQty] = useStickyState(50, 'fbcc_bible_qty');
  const [bibleDistributions, setBibleDistributions] = useStickyState([], 'fbcc_bible_distributions');
  const [partners, setPartners] = useStickyState(INITIAL_PARTNERS, 'fbcc_partners');
  const [trips, setTrips] = useStickyState(INITIAL_TRIPS, 'fbcc_trips');
  const [items, setItems] = useStickyState(INITIAL_ITEMS, 'fbcc_items');
  const [budgets, setBudgets] = useStickyState([], 'fbcc_budgets');
  const [impactStats, setImpactStats] = useStickyState(INITIAL_IMPACT_STATS, 'fbcc_impact');
  const [mercyBagEntries, setMercyBagEntries] = useStickyState([], 'fbcc_mercy_bags');
  const [appSettings, setAppSettings] = useStickyState({ lockBudgets: false, offlineMode: false, defaultCurrency: 'UGX' }, 'fbcc_settings');

  useEffect(() => { if (isOffline) console.log("App is now in Offline Mode"); }, [isOffline]);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background pb-12">
        <Header activeView={activeView} setActiveView={setActiveView} isOffline={isOffline} setIsOffline={setIsOffline} />

        {activeView === 'public' ? (
          <PublicView
            pastors={pastors}
            bibleDistributions={bibleDistributions}
            medicalOutreachStats={impactStats.medicalOutreach}
            partners={partners}
            trips={trips}
            mercyBagEntries={mercyBagEntries}
          />
        ) : (
          <AdminDashboard activeTab={adminTab} setActiveTab={setAdminTab}>
            {adminTab === 'home' && (
              <AdminDashboardHome
                setActiveTab={setAdminTab}
                trips={trips}
                partners={partners}
                pastors={pastors}
                budgets={budgets}
                bibleDistributions={bibleDistributions}
                mercyBagEntries={mercyBagEntries}
                impactStats={impactStats}
              />
            )}
            {adminTab === 'trips' && <MissionTripsManager trips={trips} setTrips={setTrips} />}
            {adminTab === 'budgets' && <SubBudgetManager budgets={budgets} setBudgets={setBudgets} trips={trips} partners={partners} itemCatalog={items} appSettings={appSettings} />}
            {adminTab === 'items' && <ItemCatalogManager items={items} setItems={setItems} />}
            {adminTab === 'partners' && <MinistryPartnersManager partners={partners} setPartners={setPartners} />}
            {adminTab === 'pastors' && <EnhancedPastorCRM pastors={pastors} setPastors={setPastors} partners={partners} />}
            {adminTab === 'bibles' && <BibleDistributionManager trips={trips} partners={partners} bibleDistributions={bibleDistributions} setBibleDistributions={setBibleDistributions} />}
            {adminTab === 'mercy' && <MercyBagManager trips={trips} partners={partners} mercyBagEntries={mercyBagEntries} setMercyBagEntries={setMercyBagEntries} />}
            {adminTab === 'medical' && <MedicalOutreachManager impactStats={impactStats} setImpactStats={setImpactStats} trips={trips} />}
            {adminTab === 'reports' && <HistoricalReports historicalData={MOCK_TRIPS_HISTORICAL} />}
            {adminTab === 'settings' && <SettingsPanel settings={appSettings} setSettings={setAppSettings} />}
            {adminTab === 'inventory' && <BibleInventory bibleQty={bibleQty} setBibleQty={setBibleQty} />}
          </AdminDashboard>
        )}
      </div>
    </ToastProvider>
  )
}

export default App
