-- Enable realtime for transactions table so wallet updates show in real-time
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;