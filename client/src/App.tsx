import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Target, 
  History, 
  Plus, 
  X, 
  LogOut, 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  BarChart3
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
  Bar
} from 'recharts';
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

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'history' | 'budgets' | 'yearly'>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authData, setAuthData] = useState({ email: '', password: '' });
  
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
    if (!session) return;
    try {
      console.log(`Fetching from: ${API_URL}`);
      const [transRes, budgetRes, allTransRes] = await Promise.all([
        fetch(`${API_URL}/api/transactions?month=${selectedMonth}`),
        fetch(`${API_URL}/api/budgets?month=${selectedMonth}`),
        fetch(`${API_URL}/api/transactions`)
      ]);

      if (!transRes.ok || !budgetRes.ok) {
        throw new Error('Failed to fetch data from server');
      }

      const transData = await transRes.json();
      const budgetData = await budgetRes.json();
      const allData = await allTransRes.json();
      setTransactions(transData);
      setBudgets(budgetData);
      setAllTransactions(allData);
    } catch (err: any) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    if (session) fetchData();
  }, [session, selectedMonth]);

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
    console.log('Submitting transaction to:', `${API_URL}/api/transactions`);
    
    fetch(`${API_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        amount: parseFloat(formData.amount),
        month: selectedMonth
      })
    })
    .then(async (res) => {
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.errors?.[0]?.msg || 'Failed to save transaction');
      }
      return res.json();
    })
    .then(() => {
      setShowModal(false);
      fetchData();
      setFormData({
        type: 'expense', category: '', amount: '',
        date: new Date().toISOString().split('T')[0], description: ''
      });
    })
    .catch(err => {
      console.error('Submit Error:', err);
      alert(`Error: ${err.message}. Check if your Backend URL is correct in Vercel settings.`);
    });
  };

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Submitting budget to:', `${API_URL}/api/budgets`);

    fetch(`${API_URL}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: budgetFormData.category,
        monthly_limit: parseFloat(budgetFormData.monthly_limit),
        month: selectedMonth
      })
    })
    .then(async (res) => {
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.errors?.[0]?.msg || 'Failed to save budget');
      }
      return res.json();
    })
    .then(() => {
      setShowBudgetModal(false);
      fetchData();
      setBudgetFormData({ category: '', monthly_limit: '' });
    })
    .catch(err => {
      console.error('Budget Error:', err);
      alert(`Error: ${err.message}. Check if your Backend URL is correct in Vercel settings.`);
    });
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

  // Auto Calculator - Current Month
  const currentMonthIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const currentMonthExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const currentMonthBalance = currentMonthIncome - currentMonthExpense;
  const currentSavingsRate = currentMonthIncome > 0 ? ((currentMonthIncome - currentMonthExpense) / currentMonthIncome * 100).toFixed(1) : 0;

  // Yearly Summary Data
  const yearlyData = MONTHS.map(m => {
    const monthTrans = allTransactions.filter(t => t.month === m);
    const income = monthTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = monthTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { name: m.substring(0, 3), income, expense, balance: income - expense };
  });

  const totalYearlyExpense = allTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

  const budgetProgress = budgets.map(b => {
    const spent = transactions
      .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase())
      .reduce((acc, t) => acc + t.amount, 0);
    return { name: b.category, spent, limit: b.monthly_limit };
  });

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h2 style={{ color: '#10b981', marginBottom: '2.5rem' }}>Pisa Finance</h2>
        <nav className="sidebar-nav">
          <div className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}><LayoutDashboard size={20} /> Dashboard</div>
          <div className={`nav-item ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}><History size={20} /> History</div>
          <div className={`nav-item ${view === 'budgets' ? 'active' : ''}`} onClick={() => setView('budgets')}><Target size={20} /> Budgets</div>
          <div className={`nav-item ${view === 'yearly' ? 'active' : ''}`} onClick={() => setView('yearly')}><BarChart3 size={20} /> Yearly View</div>
          <div className="nav-item" onClick={handleLogout} style={{ marginTop: 'auto' }}><LogOut size={20} /> Logout</div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1>{view.charAt(0).toUpperCase() + view.slice(1)}</h1>
            <select className="month-selector" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setShowBudgetModal(true)} className="glass-card btn-outline">Set Budget</button>
            <button onClick={() => setShowModal(true)} className="glass-card btn-primary"><Plus size={20} /> Add Entry</button>
          </div>
        </header>

        {view === 'dashboard' && (
          <div className="view-content">
            <div className="stats-grid">
              <div className="glass-card">
                <div className="stat-label">Month Balance</div>
                <div className="stat-value"><Wallet size={20} color="#3b82f6" /> ${currentMonthBalance.toLocaleString()}</div>
              </div>
              <div className="glass-card">
                <div className="stat-label">Month Expenses</div>
                <div className="stat-value" style={{ color: '#f43f5e' }}><TrendingDown size={20} /> ${currentMonthExpense.toLocaleString()}</div>
              </div>
              <div className="glass-card">
                <div className="stat-label">Month Income</div>
                <div className="stat-value" style={{ color: '#10b981' }}><TrendingUp size={20} /> ${currentMonthIncome.toLocaleString()}</div>
              </div>
              <div className="glass-card">
                <div className="stat-label">Savings Rate</div>
                <div className="stat-value">{currentSavingsRate}%</div>
              </div>
            </div>

            <div className="charts-grid">
              <div className="glass-card chart-container">
                <h3>{selectedMonth} Flow</h3>
                <ResponsiveContainer width="100%" height="85%">
                  <LineChart data={transactions.slice(0, 10).reverse().map(t => ({ name: t.date.split('-')[2], amount: t.type === 'expense' ? -t.amount : t.amount }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card chart-container">
                <h3>Item Expenses</h3>
                <div className="budget-list">
                  {budgetProgress.map(b => (
                    <div key={b.name} className="budget-item">
                      <div className="budget-item-info">
                        <span>{b.name}</span>
                        <span style={{ color: b.spent > b.limit ? '#f43f5e' : '#10b981' }}>${b.spent} / ${b.limit}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.min(100, (b.spent / b.limit) * 100)}%`, backgroundColor: b.spent > b.limit ? '#f43f5e' : '#10b981' }}></div>
                      </div>
                    </div>
                  ))}
                  {budgetProgress.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center' }}>No budgets set for {selectedMonth}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'yearly' && (
          <div className="view-content">
            <div className="stats-grid">
              <div className="glass-card">
                <div className="stat-label">Yearly Expenses</div>
                <div className="stat-value" style={{ color: '#f43f5e' }}>${totalYearlyExpense.toLocaleString()}</div>
              </div>
            </div>
            <div className="glass-card" style={{ height: '400px', marginTop: '1.5rem' }}>
              <h3>Yearly Overview</h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                  <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="glass-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {transactions.length === 0 ? <p>No transactions for {selectedMonth}</p> : 
                transactions.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{t.category}</div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t.date} - {t.description}</div>
                    </div>
                    <div style={{ color: t.type === 'income' ? '#10b981' : '#f43f5e', fontWeight: 'bold' }}>
                      {t.type === 'income' ? '+' : '-'}${t.amount}
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h2>Add Entry for {selectedMonth}</h2>
            <form onSubmit={handleTransactionSubmit}>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <input placeholder="Category" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
              <input type="number" placeholder="Amount" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
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
            <h2>Set {selectedMonth} Budget</h2>
            <form onSubmit={handleBudgetSubmit}>
              <input placeholder="Category" required value={budgetFormData.category} onChange={e => setBudgetFormData({...budgetFormData, category: e.target.value})} />
              <input type="number" placeholder="Monthly Limit" required value={budgetFormData.monthly_limit} onChange={e => setBudgetFormData({...budgetFormData, monthly_limit: e.target.value})} />
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
