import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Target, 
  History, 
  Settings,
  Plus,
  X,
  LogOut,
  Wallet,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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
}

interface Budget {
  id: number;
  category: string;
  monthly_limit: number;
}

const COLORS = ['#10b981', '#3b82f6', '#f43f5e', '#f59e0b', '#8b5cf6'];
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
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
      const [transRes, budgetRes] = await Promise.all([
        fetch(`${API_URL}/api/transactions`),
        fetch(`${API_URL}/api/budgets`)
      ]);
      const transData = await transRes.json();
      const budgetData = await budgetRes.json();
      setTransactions(transData);
      setBudgets(budgetData);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    if (session) fetchData();
  }, [session]);

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
        amount: parseFloat(formData.amount)
      })
    })
    .then(() => {
      setShowModal(false);
      fetchData();
      setFormData({
        type: 'expense', category: '', amount: '',
        date: new Date().toISOString().split('T')[0], description: ''
      });
    });
  };

  const handleBudgetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetch(`${API_URL}/api/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: budgetFormData.category,
        monthly_limit: parseFloat(budgetFormData.monthly_limit)
      })
    })
    .then(() => {
      setShowBudgetModal(false);
      fetchData();
      setBudgetFormData({ category: '', monthly_limit: '' });
    });
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (!session) {
    return (
      <div className="auth-container">
        <div className="glass-card auth-card">
          <h2 style={{ textAlign: 'center', color: '#10b981' }}>Pisa Finance</h2>
          <form onSubmit={handleAuth}>
            <input 
              type="email" placeholder="Email" required 
              value={authData.email} onChange={e => setAuthData({...authData, email: e.target.value})}
            />
            <input 
              type="password" placeholder="Password" required 
              value={authData.password} onChange={e => setAuthData({...authData, password: e.target.value})}
            />
            <button type="submit" className="glass-card btn-primary">
              {authMode === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1rem', cursor: 'pointer', color: '#94a3b8' }} onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
            {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
          </p>
        </div>
      </div>
    );
  }

  // Calculations for Auto Calculator
  const totalBalance = transactions.reduce((acc, curr) => 
    curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100).toFixed(1) : 0;

  const chartData = transactions.slice(0, 7).reverse().map(t => ({
    name: t.date,
    amount: t.type === 'expense' ? -t.amount : t.amount
  }));

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

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <h2 style={{ color: '#10b981', marginBottom: '2.5rem' }}>Pisa Finance</h2>
        <nav className="sidebar-nav">
          <a href="#" className="nav-item active"><LayoutDashboard size={20} /> Dashboard</a>
          <a href="#" className="nav-item"><History size={20} /> Transactions</a>
          <a href="#" className="nav-item" onClick={() => setShowBudgetModal(true)}><Target size={20} /> Set Budgets</a>
          <a href="#" className="nav-item" onClick={handleLogout}><LogOut size={20} /> Logout</a>
        </nav>
      </aside>

      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>Dashboard Overview</h1>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setShowBudgetModal(true)} className="glass-card btn-outline">Set Limits</button>
            <button onClick={() => setShowModal(true)} className="glass-card btn-primary"><Plus size={20} /> Add Transaction</button>
          </div>
        </header>

        {/* Auto Calculator / Stats */}
        <div className="stats-grid">
          <div className="glass-card">
            <div className="stat-label">Total Balance</div>
            <div className="stat-value"><Wallet size={20} color="#3b82f6" /> ${totalBalance.toLocaleString()}</div>
          </div>
          <div className="glass-card">
            <div className="stat-label">Total Expenses</div>
            <div className="stat-value" style={{ color: '#f43f5e' }}><TrendingDown size={20} /> ${totalExpenses.toLocaleString()}</div>
          </div>
          <div className="glass-card">
            <div className="stat-label">Total Income</div>
            <div className="stat-value" style={{ color: '#10b981' }}><TrendingUp size={20} /> ${totalIncome.toLocaleString()}</div>
          </div>
          <div className="glass-card">
            <div className="stat-label">Savings Rate</div>
            <div className="stat-value">{savingsRate}%</div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="glass-card" style={{ height: '300px' }}>
            <h3>Cash Flow Summary</h3>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card" style={{ height: '300px' }}>
            <h3>Budget Tracking</h3>
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={budgetProgress}>
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Bar dataKey="spent" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="limit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card" style={{ marginTop: '1.5rem' }}>
          <h3>Auto Calculation Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            {budgetProgress.map(b => (
              <div key={b.name} className="budget-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>{b.name}</span>
                  <span style={{ color: b.spent > b.limit ? '#f43f5e' : '#10b981' }}>
                    {Math.round((b.spent / b.limit) * 100)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ 
                    width: `${Math.min(100, (b.spent / b.limit) * 100)}%`,
                    backgroundColor: b.spent > b.limit ? '#f43f5e' : '#10b981'
                  }}></div>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                  ${b.spent} / ${b.limit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Transaction Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Add Transaction</h2>
              <X size={24} style={{ cursor: 'pointer' }} onClick={() => setShowModal(false)} />
            </div>
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

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Set Category Limit</h2>
              <X size={24} style={{ cursor: 'pointer' }} onClick={() => setShowBudgetModal(false)} />
            </div>
            <form onSubmit={handleBudgetSubmit}>
              <input placeholder="Category (e.g. Food)" required value={budgetFormData.category} onChange={e => setBudgetFormData({...budgetFormData, category: e.target.value})} />
              <input type="number" placeholder="Monthly Limit" required value={budgetFormData.monthly_limit} onChange={e => setBudgetFormData({...budgetFormData, monthly_limit: e.target.value})} />
              <div className="button-group">
                <button type="button" className="glass-card btn-secondary" onClick={() => setShowBudgetModal(false)}>Cancel</button>
                <button type="submit" className="glass-card btn-primary">Save Limit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
