import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hdwdswklbbxomcidbaso.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhkd2Rzd2tsYmJ4b21jaWRiYXNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5Njk5NzMsImV4cCI6MjA5MjU0NTk3M30.SXU1W0atezk-MltNGizX-cJBLIKeERMxid52dWQhyGQ';

export const supabase = createClient(supabaseUrl, supabaseKey);