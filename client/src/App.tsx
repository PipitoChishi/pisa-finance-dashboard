import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  History, 
  Plus, 
  LogOut, 
  Wallet, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Settings,
  Edit2,
  Trash2,
  X,
  PlusCircle
} from 'lucide-react';
import { 
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
  const [showQuickAdd, setShowQuickAdd] = useState<string | null>(null);
  const [quickAddAmount, setQuickAddAmount] = useState('');
  const [editingItem, setEditingItem] = useState<Transaction | null>(null);
  
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authData, setAuthData] = useState({ email: '', password: '' });
  const [authMsg, setAuthMsg] = useState('');

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
    const userId = session.user.id;
    try {
      const [transRes, budgetRes, allTransRes] = await Promise.all([
        fetch(`${API_URL}/api/transactions?month=${selectedMonth}&user_id=${userId}`),
        fetch(`${API_URL}/api/budgets?month=${selectedMonth}&user_id=${userId}`),
        fetch(`${API_URL}/api/transactions?user_id=${userId}`)
      ]);
      const transData = await transRes.json();
      const budgetData = await budgetRes.json();
      const allData = await allTransRes.json();
      setTransactions(Array.isArray(transData) ? transData : []);
      setBudgets(Array.isArray(budgetData) ? budgetData : []);
      setAllTransactions(Array.isArray(allData) ? allData : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (session) fetchData();
  }, [session, selectedMonth]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg('');
    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp(authData);
      if (error) setAuthMsg(error.message);
      else setAuthMsg('Success! Check your email to confirm.');
    } else {
      const { error } = await supabase.auth.signInWithPassword(authData);
      if (error) setAuthMsg(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleTransactionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingItem ? 'PUT' : 'POST';
    const url = editingItem ? `${API_URL}/api/transactions/${editingItem.id}` : `${API_URL}/api/transactions`;
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...formData,
        user_id: session.user.id,
        amount: Math.abs(parseFloat(formData.amount)),
        month: selectedMonth
      })
    }).then(() => {
      setShowModal(false);
      setEditingItem(null);
      fetchData();
      setFormData({ category: '', amount: '', date: new Date().toISOString().split('T')[0], description: '' });
    });
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showQuickAdd || !quickAddAmount) return;
    fetch(`${API_URL}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: showQuickAdd,
        amount: Math.abs(parseFloat(quickAddAmount)),
        user_id: session.user.id,
        month: selectedMonth,
        date: new Date().toISOString().split('T')[0],
        description: 'Quick Add'
      })
    }).then(() => {
      setShowQuickAdd(null);
      setQuickAddAmount('');
      fetchData();
    });
  };

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API_URL}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: session.user.id,
        category: budgetFormData.category,
        monthly_limit: Math.abs(parseFloat(budgetFormData.monthly_limit)),
        month: selectedMonth
      })
    }).then(() => {
      setShowBudgetModal(false);
      fetchData();
      setBudgetFormData({ category: '', monthly_limit: '' });
    });
  };

  const handleDelete = (type: 'transaction' | 'budget', id: number) => {
    if (!window.confirm('Are you sure?')) return;
    fetch(`${API_URL}/api/${type === 'transaction' ? 'transactions' : 'budgets'}/${id}`, {
      method: 'DELETE'
    }).then(() => fetchData());
  };

  const startEdit = (item: Transaction) => {
    setEditingItem(item);
    setFormData({ category: item.category, amount: item.amount.toString(), date: item.date, description: item.description || '' });
    setShowModal(true);
  };

  const updateCurrency = (cur: string) => {
    setCurrency(cur);
    localStorage.setItem('pisa_currency', cur);
  };

  if (loading) return <div className="loading">Loading...</div>;

  // --- RENDER LOGIN PAGE ---
  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-card glass-card">
          <h2 style={{ textAlign: 'center', color: '#10b981' }}>Pisa Finance</h2>
          {authMsg && <div className="error-msg">{authMsg}</div>}
          <form onSubmit={handleAuth}>
            <input type="email" placeholder="Email" required value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})} />
            <input type="password" placeholder="Password" required value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})} />
            <button type="submit" className="glass-card btn-primary">{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1.5rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthMsg(''); }}>
            {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </p>
        </div>
      </div>
    );
  }

  // --- RENDER DASHBOARD ---
  const totalMonthlyBudget = budgets.reduce((acc, b) => acc + b.monthly_limit, 0);
  const totalMonthlyExpenses = transactions.reduce((acc, t) => acc + t.amount, 0);
  const remainingFunds = totalMonthlyBudget - totalMonthlyExpenses;
  const budgetSafety = totalMonthlyBudget > 0 ? Math.max(0, (remainingFunds / totalMonthlyBudget) * 100).toFixed(1) : 0;

  const pieData = Object.entries(transactions.reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }));
  const budgetProgress = budgets.map(b => {
    const spent = transactions.filter(t => t.category.toLowerCase() === b.category.toLowerCase()).reduce((acc, t) => acc + t.amount, 0);
    return { id: b.id, name: b.category, spent, limit: b.monthly_limit };
  });
  const uniqueCategories = Array.from(new Set(allTransactions.map(t => t.category)));
  const formatMoney = (val: number) => `${currency}${Math.abs(val).toLocaleString()}`;

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h2 style={{ color: '#10b981', marginBottom: '2.5rem' }}>Pisa Finance</h2>
        <nav className="sidebar-nav">
          <div className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')}><LayoutDashboard size={20} /> Dashboard</div>
          <div className={`nav-item ${view === 'history' ? 'active' : ''}`} onClick={() => setView('history')}><History size={20} /> History</div>
          <div className={`nav-item ${view === 'yearly' ? 'active' : ''}`} onClick={() => setView('yearly')}><BarChart3 size={20} /> Yearly View</div>
          <div className={`nav-item ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}><Settings size={20} /> Settings</div>
          <div className="nav-item" onClick={handleLogout} style={{ marginTop: 'auto' }}><LogOut size={20} /> Logout</div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1>{selectedMonth} Dashboard</h1>
            <select className="month-selector" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setShowBudgetModal(true)} className="glass-card btn-outline">Set Limits</button>
            <button onClick={() => { setEditingItem(null); setFormData({category:'', amount:'', date: new Date().toISOString().split('T')[0], description:''}); setShowModal(true); }} className="glass-card btn-primary"><Plus size={20} /> Add Expense</button>
          </div>
        </header>

        {view === 'dashboard' && (
          <div className="view-content">
            <div className="stats-grid">
              <div className="glass-card"><div className="stat-label">Monthly Allowance</div><div className="stat-value"><Wallet size={20} color="#3b82f6" /> {formatMoney(totalMonthlyBudget)}</div></div>
              <div className="glass-card"><div className="stat-label">Total Spent</div><div className="stat-value" style={{ color: '#f43f5e' }}><TrendingDown size={20} /> {formatMoney(totalMonthlyExpenses)}</div></div>
              <div className="glass-card"><div className="stat-label">Remaining Funds</div><div className="stat-value" style={{ color: '#10b981' }}><TrendingUp size={20} /> {formatMoney(remainingFunds)}</div></div>
              <div className="glass-card"><div className="stat-label">Budget Safety</div><div className="stat-value">{budgetSafety}%</div></div>
            </div>
            <div className="charts-grid">
              <div className="glass-card chart-container">
                <h3>Expense Breakdown</h3>
                <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie data={pieData.length > 0 ? pieData : [{name: 'Empty', value: 1}]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="glass-card chart-container">
                <h3>Auto-Addition (Budgets)</h3>
                <div className="budget-list">
                  {budgetProgress.map(b => (
                    <div key={b.name} className="budget-item">
                      <div className="budget-item-info">
                        <div style={{ display:'flex', gap:'8px', alignItems:'center'}}><span>{b.name}</span><Trash2 size={14} style={{cursor:'pointer', color:'#f43f5e'}} onClick={() => handleDelete('budget', b.id)} /><PlusCircle size={16} style={{cursor:'pointer', color:'#3b82f6'}} onClick={() => setShowQuickAdd(b.name)} /></div>
                        <span style={{ color: b.spent > b.limit ? '#f43f5e' : '#10b981' }}>{formatMoney(b.spent)} / {formatMoney(b.limit)}</span>
                      </div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(100, (b.spent / b.limit) * 100)}%`, backgroundColor: b.spent > b.limit ? '#f43f5e' : '#10b981' }}></div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="glass-card">
            <h3>Expense History - {selectedMonth}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {transactions.length === 0 ? <p>No expenses recorded.</p> : transactions.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 'bold' }}>{t.category}</div><div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t.date} - {t.description}</div></div>
                  <div style={{ display:'flex', gap:'1.5rem', alignItems:'center' }}><div style={{ color: '#f43f5e', fontWeight: 'bold' }}>{formatMoney(t.amount)}</div><div style={{ display:'flex', gap:'0.75rem' }}><Edit2 size={18} style={{cursor:'pointer', color:'#3b82f6'}} onClick={() => startEdit(t)} /><Trash2 size={18} style={{cursor:'pointer', color:'#f43f5e'}} onClick={() => handleDelete('transaction', t.id)} /></div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'yearly' && (
          <div className="view-content">
            <div className="glass-card" style={{ height: '450px' }}>
              <h3>Yearly Expenses ({currency})</h3>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={MONTHS.map(m => { const monthTrans = allTransactions.filter(t => t.month === m); return { name: m.substring(0, 3), expense: monthTrans.reduce((acc, t) => acc + t.amount, 0) }; })}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" /><XAxis dataKey="name" stroke="#94a3b8" /><YAxis stroke="#94a3b8" /><Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px' }} /><Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="glass-card" style={{ maxWidth: '400px' }}>
            <h3>Settings</h3>
            <div style={{ marginBottom: '1.5rem' }}><label style={{ display: 'block', marginBottom: '0.5rem', color: '#94a3b8' }}>Preferred Currency</label><select className="month-selector" style={{ width: '100%' }} value={currency} onChange={(e) => updateCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
        )}
      </main>

      <datalist id="categories">{uniqueCategories.map(cat => <option key={cat} value={cat} />)}</datalist>

      {showModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}><h2>{editingItem ? 'Edit Expense' : 'Add Expense'}</h2><X size={24} style={{cursor:'pointer'}} onClick={() => { setShowModal(false); setEditingItem(null); }} /></div>
            <form onSubmit={handleTransactionSubmit}><input list="categories" placeholder="Category" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} /><input type="number" step="0.01" placeholder="Amount" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} /><input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} /><textarea placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /><div className="button-group"><button type="submit" className="glass-card btn-primary">Save Entry</button></div></form>
          </div>
        </div>
      )}

      {showQuickAdd && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{maxWidth:'350px'}}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}><h2>Quick Add: {showQuickAdd}</h2><X size={24} style={{cursor:'pointer'}} onClick={() => setShowQuickAdd(null)} /></div><form onSubmit={handleQuickAdd}><input type="number" step="0.01" placeholder="Amount" autoFocus required value={quickAddAmount} onChange={e => setQuickAddAmount(e.target.value)} /><div className="button-group"><button type="submit" className="glass-card btn-primary">Add</button></div></form></div>
        </div>
      )}

      {showBudgetModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem'}}><h2>Set Category Limit</h2><X size={24} style={{cursor:'pointer'}} onClick={() => setShowBudgetModal(false)} /></div>
            <form onSubmit={handleBudgetSubmit}><input list="categories" placeholder="Category" required value={budgetFormData.category} onChange={e => setBudgetFormData({...budgetFormData, category: e.target.value})} /><input type="number" step="0.01" placeholder="Limit Amount" required value={budgetFormData.monthly_limit} onChange={e => setBudgetFormData({...budgetFormData, monthly_limit: e.target.value})} /><div className="button-group"><button type="submit" className="glass-card btn-primary">Save Limit</button></div></form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
