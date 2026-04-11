import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Target, 
  History, 
  Plus, 
  LogOut, 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Settings,
  Link as LinkIcon,
  RefreshCw
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { usePlaidLink } from 'react-plaid-link';
import { supabase } from './supabase';
import './App.css';

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
  month: string;
}

interface Budget {
  id: number;
  category: string;
  monthly_limit: number;
  month: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const COLORS = ['#10b981', '#3b82f6', '#f43f5e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];
const CURRENCIES = ['$', '₹', '£', '€', '¥', '₦', 'GH₵'];

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'history' | 'budgets' | 'yearly' | 'settings'>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [currency, setCurrency] = useState(localStorage.getItem('pisa_currency') || '$');
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authData, setAuthData] = useState({ email: '', password: '' });
  
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [formData, setFormData] = useState({
    type: 'expense',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [budgetFormData, setBudgetFormData] = useState({
    category: '',
    monthly_limit: ''
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!session?.user?.id) return;
    try {
      const userId = session.user.id;
      const [transRes, budgetRes, allTransRes] = await Promise.all([
        fetch(`${API_URL}/api/transactions?month=${selectedMonth}&user_id=${userId}`),
        fetch(`${API_URL}/api/budgets?month=${selectedMonth}&user_id=${userId}`),
        fetch(`${API_URL}/api/transactions?user_id=${userId}`)
      ]);

      if (!transRes.ok || !budgetRes.ok) throw new Error('Failed to fetch data');

      const transData = await transRes.json();
      const budgetData = await budgetRes.json();
      const allData = await allTransRes.json();
      setTransactions(transData);
      setBudgets(budgetData);
      setAllTransactions(allData);
    } catch (err: any) {
      console.error('Fetch Error:', err);
    }
  };

  useEffect(() => {
    if (session) fetchData();
  }, [session, selectedMonth]);

  // --- Plaid Integration ---
  
  const createLinkToken = useCallback(async () => {
    if (!session?.user?.id) return;
    const response = await fetch(`${API_URL}/api/create_link_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: session.user.id }),
    });
    const data = await response.json();
    setLinkToken(data.link_token);
  }, [session]);

  const onPlaidSuccess = useCallback(async (public_token: string, metadata: any) => {
    await fetch(`${API_URL}/api/exchange_public_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_token,
        user_id: session.user.id,
        institution_name: metadata.institution.name
      }),
    });
    alert('Bank connected successfully!');
    syncTransactions();
  }, [session]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  });

  const syncTransactions = async () => {
    if (!session?.user?.id) return;
    setSyncing(true);
    try {
      await fetch(`${API_URL}/api/sync_transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.user.id }),
      });
      fetchData();
    } catch (err) {
      console.error('Sync error:', err);
    }
    setSyncing(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = authMode === 'login' 
      ? await supabase.auth.signInWithPassword(authData)
      : await supabase.auth.signUp(authData);
    if (error) alert(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        user_id: session.user.id,
        amount: parseFloat(formData.amount),
        month: selectedMonth
      })
    })
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to save');
      setShowModal(false);
      fetchData();
      setFormData({
        type: 'expense', category: '', amount: '',
        date: new Date().toISOString().split('T')[0], description: ''
      });
    })
    .catch(err => alert(err.message));
  };

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API_URL}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: session.user.id,
        category: budgetFormData.category,
        monthly_limit: parseFloat(budgetFormData.monthly_limit),
        month: selectedMonth
      })
    })
    .then(async (res) => {
      if (!res.ok) throw new Error('Failed to save');
      setShowBudgetModal(false);
      fetchData();
      setBudgetFormData({ category: '', monthly_limit: '' });
    })
    .catch(err => alert(err.message));
  };

  const updateCurrency = (cur: string) => {
    setCurrency(cur);
    localStorage.setItem('pisa_currency', cur);
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (!session) {
    return (
      <div className="auth-container">
        <div className="glass-card auth-card">
          <h2 style={{ textAlign: 'center', color: '#10b981' }}>Pisa Finance</h2>
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Email" required value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})} />
            <input type="password" placeholder="Password" required value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} />
            <button type="submit" className="glass-card btn-primary">{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
            {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </p>
        </div>
      </div>
    );
  }

  // Monthly Calculations
  const currentMonthIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const currentMonthExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const currentMonthBalance = currentMonthIncome - currentMonthExpense;
  const currentSavingsRate = currentMonthIncome > 0 ? ((currentMonthIncome - currentMonthExpense) / currentMonthIncome * 100).toFixed(1) : 0;

  const pieData = Object.entries(
    transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const budgetProgress = budgets.map(b => {
    const spent = transactions
      .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase())
      .reduce((acc, t) => acc + t.amount, 0);
    return { name: b.category, spent, limit: b.monthly_limit };
  });

  const uniqueCategories = Array.from(new Set(allTransactions.map(t => t.category)));

  const yearlyData = MONTHS.map(m => {
    const monthTrans = allTransactions.filter(t => t.month === m);
    const income = monthTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = monthTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { name: m.substring(0, 3), income, expense };
  });

  const formatMoney = (val: number) => `${currency}${val.toLocaleString()}`;

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h2 style={{ color: '#10b981', marginBottom: '2.5rem' }}>Pisa Finance</h2>
        <nav className="sidebar-nav">
          <div className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}><LayoutDashboard size={20} /> Dashboard</div>
          <div className={`nav-item ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}><History size={20} /> History</div>
          <div className={`nav-item ${view === 'yearly' ? 'active' : ''}`} onClick={() => setView('yearly')}><BarChart3 size={20} /> Yearly View</div>
          <div className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}><Settings size={20} /> Settings</div>
          
          <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
            <div className="nav-item" onClick={() => { createLinkToken(); open(); }} style={{ color: '#3b82f6' }}><LinkIcon size={20} /> Connect Bank</div>
            <div className="nav-item" onClick={handleLogout}><LogOut size={20} /> Logout</div>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1>{view.charAt(0).toUpperCase() + view.slice(1)}</h1>
            {view === 'dashboard' && (
              <select className="month-selector" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={syncTransactions} disabled={syncing} className="glass-card btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={18} className={syncing ? 'spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Bank'}
            </button>
            <button onClick={() => setShowBudgetModal(true)} className="glass-card btn-outline">Set Budget</button>
            <button onClick={() => setShowModal(true)} className="glass-card btn-primary"><Plus size={20} /> Add Entry</button>
          </div>
        </header>

        {view === 'dashboard' && (
          <div className="view-content">
            <div className="stats-grid">
              <div className="glass-card">
                <div className="stat-label">Month Balance</div>
                <div className="stat-value"><Wallet size={20} color="#3b82f6" /> {formatMoney(currentMonthBalance)}</div>
              </div>
              <div className="glass-card">
                <div className="stat-label">Month Expenses</div>
                <div className="stat-value" style={{ color: '#f43f5e' }}><TrendingDown size={20} /> {formatMoney(currentMonthExpense)}</div>
              </div>
              <div className="glass-card">
                <div className="stat-label">Month Income</div>
                <div className="stat-value" style={{ color: '#10b981' }}><TrendingUp size={20} /> {formatMoney(currentMonthIncome)}</div>
              </div>
              <div className="glass-card">
                <div className="stat-label">Savings Rate</div>
                <div className="stat-value">{currentSavingsRate}%</div>
              </div>
            </div>

            <div className="charts-grid">
              <div className="glass-card chart-container">
                <h3>Expense Distribution</h3>
                <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie data={pieData.length > 0 ? pieData : [{name: 'No data', value: 1}]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card chart-container">
                <h3>Item Expenses (Budgets)</h3>
                <div className="budget-list">
                  {budgetProgress.map(b => (
                    <div key={b.name} className="budget-item">
                      <div className="budget-item-info">
                        <span>{b.name}</span>
                        <span style={{ color: b.spent > b.limit ? '#f43f5e' : '#10b981' }}>{formatMoney(b.spent)} / {formatMoney(b.limit)}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.min(100, (b.spent / b.limit) * 100)}%`, backgroundColor: b.spent > b.limit ? '#f43f5e' : '#10b981' }}></div>
                      </div>
                    </div>
                  ))}
                  {budgetProgress.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center' }}>No budgets set.</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'yearly' && (
          <div className="view-content">
            <div className="glass-card" style={{ height: '450px' }}>
              <h3>Yearly Performance ({currency})</h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="glass-card">
            <h3>Transaction History - {selectedMonth}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {transactions.length === 0 ? <p>No entries found.</p> : 
                transactions.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{t.category}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t.date} - {t.description}</div>
                    </div>
                    <div style={{ color: t.type === 'income' ? '#10b981' : '#f43f5e', fontWeight: 'bold' }}>
                      {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="glass-card" style={{ maxWidth: '400px' }}>
            <h3>Settings</h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Preferred Currency</label>
              <select className="month-selector" style={{ width: '100%' }} value={currency} onChange={(e) => updateCurrency(e.target.value)}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>More settings coming soon...</p>
          </div>
        )}
      </main>

      <datalist id="categories">
        {uniqueCategories.map(cat => <option key={cat} value={cat} />)}
      </datalist>

      {/* Modals */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h2>Add Entry</h2>
            <form onSubmit={handleTransactionSubmit}>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <input list="categories" placeholder="Category" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
              <input type="number" step="0.01" placeholder="Amount" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
              <input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              <textarea placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              <div className="button-group">
                <button type="button" className="glass-card btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="glass-card btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBudgetModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h2>Set Budget</h2>
            <form onSubmit={handleBudgetSubmit}>
              <input list="categories" placeholder="Category" required value={budgetFormData.category} onChange={e => setBudgetFormData({...budgetFormData, category: e.target.value})} />
              <input type="number" step="0.01" placeholder="Monthly Limit" required value={budgetFormData.monthly_limit} onChange={e => setBudgetFormData({...budgetFormData, monthly_limit: e.target.value})} />
              <div className="button-group">
                <button type="button" className="glass-card btn-secondary" onClick={() => setShowBudgetModal(false)}>Cancel</button>
                <button type="submit" className="glass-card btn-primary">Save Budget</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
