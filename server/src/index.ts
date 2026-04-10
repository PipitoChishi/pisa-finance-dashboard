import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import supabase from './db';

import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- Security Middleware ---
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

// Global Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', globalLimiter);

// Auth Rate Limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts from this IP, please try again after 15 minutes.',
});
app.use('/api/auth/', authLimiter);

// Validation error handler
const handleValidationErrors = (req: Request, res: Response, next: Function) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// --- API Routes ---

// Health Check
app.get('/', (req: any, res: any) => {
  res.json({ status: 'OK', message: 'Pisa-finance tracker API is running' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Pisa-finance tracker API is running' });
});

// --- Transactions Endpoints ---
app.get('/api/transactions', async (req: Request, res: Response) => {
  const { month } = req.query;
  let query = supabase.from('transactions').select('*');
  
  if (month) {
    query = query.eq('month', month);
  }

  const { data, error } = await query.order('date', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post(
  '/api/transactions',
  [
    body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
    body('category').isString().trim().escape().notEmpty(),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('date').isString().trim().escape().notEmpty(),
    body('month').isString().trim().escape().notEmpty(),
    body('description').optional({ checkFalsy: true }).isString().trim().escape(),
    handleValidationErrors
  ],
  async (req: Request, res: Response) => {
    const { type, category, amount, date, description, month } = req.body;
    const { data, error } = await supabase
      .from('transactions')
      .insert([{ type, category, amount, date, description, month }])
      .select();
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data?.[0]?.id, success: true });
  }
);

// --- Budgets Endpoints ---
app.get('/api/budgets', async (req: Request, res: Response) => {
  const { month } = req.query;
  let query = supabase.from('budgets').select('*');
  
  if (month) {
    query = query.eq('month', month);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post(
  '/api/budgets',
  [
    body('category').isString().trim().escape().notEmpty(),
    body('monthly_limit').isNumeric().withMessage('Monthly limit must be a number'),
    body('month').isString().trim().escape().notEmpty(),
    handleValidationErrors
  ],
  async (req: Request, res: Response) => {
    const { category, monthly_limit, month } = req.body;
    const { data, error } = await supabase
      .from('budgets')
      .upsert({ category, monthly_limit, month }, { onConflict: 'category,month' })
      .select();
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data?.[0]?.id, success: true });
  }
);

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
