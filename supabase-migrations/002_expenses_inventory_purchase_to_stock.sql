-- One-off: change existing expense purpose from "Inventory purchase" to "Stock"
UPDATE public.expenses
SET purpose = 'Stock'
WHERE purpose = 'Inventory purchase';
