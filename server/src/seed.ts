import supabase from './db';

const sampleTransactions = [
  { type: 'income', category: 'Salary', amount: 5000, date: '2026-04-01', description: 'Monthly paycheck' },
  { type: 'expense', category: 'Rent', amount: 1500, date: '2026-04-02', description: 'April rent' },
  { type: 'expense', category: 'Groceries', amount: 200, date: '2026-04-03', description: 'Weekly shop' },
  { type: 'expense', category: 'Entertainment', amount: 50, date: '2026-04-04', description: 'Movie night' },
  { type: 'expense', category: 'Utilities', amount: 120, date: '2026-04-05', description: 'Electricity bill' },
  { type: 'expense', category: 'Dining', amount: 80, date: '2026-04-06', description: 'Dinner with friends' },
  { type: 'income', category: 'Freelance', amount: 450, date: '2026-04-07', description: 'Design project' },
];

const seed = async () => {
  console.log('Seeding Supabase database...');

  // 1. Clear existing transactions
  const { error: deleteError } = await supabase
    .from('transactions')
    .delete()
    .neq('id', 0); // Hack to delete all rows

  if (deleteError) {
    console.error('Error clearing transactions:', deleteError.message);
    return;
  }

  // 2. Insert sample transactions
  const { error: insertError } = await supabase
    .from('transactions')
    .insert(sampleTransactions);

  if (insertError) {
    console.error('Error inserting transactions:', insertError.message);
  } else {
    console.log('Database successfully seeded with sample data!');
  }

  process.exit();
};

seed();
