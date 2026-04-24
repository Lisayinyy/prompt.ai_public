import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vyuzkbdxsweaqftyqifh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_x_ruVcqxkYJNLEVDeQDwwg_H3my-InQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
