import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { 
  Configuration, 
  PlaidApi, 
  PlaidEnvironments, 
  Products, 
  CountryCode,
  TransactionsSyncRequest
} from 'plaid';
import supabase from './db';

import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- Plaid Configuration ---
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

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

app.get('/', (req: any, res: any) => {
  res.json({ status: 'OK', message: 'Pisa-finance tracker API is running' });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Pisa-finance tracker API is running' });
});

// --- Transactions Endpoints ---
app.get('/api/transactions', async (req: Request, res: Response) => {
  const { month, user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'User ID required' });

  let query = supabase.from('transactions').select('*').eq('user_id', user_id);
  
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
    body('user_id').isUUID().withMessage('Valid User ID required'),
    body('type').isIn(['income', 'expense']).withMessage('Type must be income or expense'),
    body('category').isString().trim().escape().notEmpty(),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('date').isString().trim().escape().notEmpty(),
    body('month').isString().trim().escape().notEmpty(),
    body('description').optional({ checkFalsy: true }).isString().trim().escape(),
    handleValidationErrors
  ],
  async (req: Request, res: Response) => {
    const { type, category, amount, date, description, month, user_id } = req.body;
    const { data, error } = await supabase
      .from('transactions')
      .insert([{ type, category, amount, date, description, month, user_id }])
      .select();
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data?.[0]?.id, success: true });
  }
);

// --- Budgets Endpoints ---
app.get('/api/budgets', async (req: Request, res: Response) => {
  const { month, user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: 'User ID required' });

  let query = supabase.from('budgets').select('*').eq('user_id', user_id);
  
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
    body('user_id').isUUID().withMessage('Valid User ID required'),
    body('category').isString().trim().escape().notEmpty(),
    body('monthly_limit').isNumeric().withMessage('Monthly limit must be a number'),
    body('month').isString().trim().escape().notEmpty(),
    handleValidationErrors
  ],
  async (req: Request, res: Response) => {
    const { category, monthly_limit, month, user_id } = req.body;
    const { data, error } = await supabase
      .from('budgets')
      .upsert({ category, monthly_limit, month, user_id }, { onConflict: 'user_id,category,month' })
      .select();
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data?.[0]?.id, success: true });
  }
);

// --- Plaid Endpoints ---

// 1. Create Link Token
app.post('/api/create_link_token', async (req: Request, res: Response) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'User ID required' });

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user_id },
      client_name: 'Pisa Finance',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Exchange Public Token for Access Token
app.post('/api/exchange_public_token', async (req: Request, res: Response) => {
  const { public_token, user_id, institution_name } = req.body;
  if (!public_token || !user_id) return res.status(400).json({ error: 'Missing data' });

  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });
    const { access_token, item_id } = response.data;

    // Save to Supabase
    const { error } = await supabase
      .from('plaid_items')
      .insert([{ user_id, access_token, item_id, institution_name }]);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Sync Transactions
app.post('/api/sync_transactions', async (req: Request, res: Response) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'User ID required' });

  try {
    // Get access tokens for user
    const { data: items, error: itemError } = await supabase
      .from('plaid_items')
      .select('access_token')
      .eq('user_id', user_id);

    if (itemError || !items) throw new Error('No linked accounts found');

    const MONTHS = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    for (const item of items) {
      const response = await plaidClient.transactionsSync({
        access_token: item.access_token,
      });

      const transactions = response.data.added.map(t => {
        const date = new Date(t.date);
        return {
          user_id,
          type: t.amount > 0 ? 'expense' : 'income',
          category: t.category?.[0] || 'Uncategorized',
          amount: Math.abs(t.amount),
          date: t.date,
          month: MONTHS[date.getMonth()],
          description: t.name,
        };
      });

      if (transactions.length > 0) {
        await supabase.from('transactions').insert(transactions);
      }
    }

    res.json({ success: true, message: 'Transactions synced' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
