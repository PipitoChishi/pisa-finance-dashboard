import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Target, 
  History, 
  Settings,
  Plus,
  X
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
  Cell
} from 'recharts';
import './App.css';

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  description: string;
}

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    type: 'expense',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchData = () => {
    fetch(`${API_URL}/api/transactions`)
      .then(res => res.json())
      .then(data => setTransactions(data));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
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
        type: 'expense',
        category: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
    });
  };

  const totalBalance = transactions.reduce((acc, curr) => 
    curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const savingsRate = income > 0 ? ((income - totalExpenses) / income * 100).toFixed(1) : 0;

  const COLORS = ['#10b981', '#3b82f6', '#f43f5e', '#f59e0b', '#8b5cf6'];

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

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <h2 style={{ color: '#10b981', marginBottom: '2.5rem' }}>Pisa Finance</h2>
        <nav className="sidebar-nav">
          <a href="#" className="nav-item active"><LayoutDashboard size={20} /> Dashboard</a>
          <a href="#" className="nav-item"><History size={20} /> Transactions</a>
          <a href="#" className="nav-item"><Target size={20} /> Goals</a>
          <a href="#" className="nav-item"><Settings size={20} /> Settings</a>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>Dashboard Overview</h1>
          <button 
            onClick={() => setShowModal(true)}
            className="glass-card" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            <Plus size={20} /> Add Transaction
          </button>
        </header>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="glass-card">
            <div className="stat-label">Total Balance</div>
            <div className="stat-value">${totalBalance.toLocaleString()}</div>
          </div>
          <div className="glass-card">
            <div className="stat-label">Monthly Expenses</div>
            <div className="stat-value" style={{ color: '#f43f5e' }}>${totalExpenses.toLocaleString()}</div>
          </div>
          <div className="glass-card">
            <div className="stat-label">Monthly Income</div>
            <div className="stat-value" style={{ color: '#10b981' }}>${income.toLocaleString()}</div>
          </div>
          <div className="glass-card">
            <div className="stat-label">Savings Rate</div>
            <div className="stat-value">{savingsRate}%</div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-grid">
          <div className="glass-card" style={{ height: '300px' }}>
            <h3>Cash Flow</h3>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                />
                <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card" style={{ height: '300px' }}>
            <h3>Categories</h3>
            <ResponsiveContainer width="100%" height="80%">
              <PieChart>
                <Pie
                  data={pieData.length > 0 ? pieData : [{name: 'No data', value: 1}]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="glass-card" style={{ marginTop: '1.5rem' }}>
          <h3>Recent Transactions</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {transactions.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No transactions recorded yet.</p>
            ) : (
              transactions.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {t.type === 'income' ? <ArrowUpCircle color="#10b981" /> : <ArrowDownCircle color="#f43f5e" />}
                    <div>
                      <div>{t.category}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{t.date}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 'bold', color: t.type === 'income' ? '#10b981' : '#f43f5e' }}>
                    {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                  </div>
                </div>
              ))
            )}
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
            <form onSubmit={handleSubmit}>
              <select 
                value={formData.type} 
                onChange={e => setFormData({...formData, type: e.target.value as any})}
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <input 
                placeholder="Category (e.g., Food, Rent)" 
                required
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              />
              <input 
                type="number" 
                placeholder="Amount" 
                required
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
              />
              <input 
                type="date" 
                required
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
              />
              <textarea 
                placeholder="Description"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              ></textarea>
              <div className="button-group">
                <button type="button" className="glass-card btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="glass-card" style={{ background: '#10b981', border: 'none', color: 'white' }}>Save Transaction</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
