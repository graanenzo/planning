// Publieke gegevens van het Supabase-project "graanenzo-app".
// De publishable key mag in de browser staan; de toegang wordt bewaakt door RLS in de database.
export const SUPABASE_URL = 'https://gxlbqxdloucaisnxmpky.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_1GtIrj9YZq1nuI206Fztfg_cod8_0e1';

// Medewerkers loggen in met hun gebruikersnaam; dat wordt dit e-mailadres.
export const LOGIN_EMAIL = (gebruikersnaam) => `medewerker+${gebruikersnaam}@graanenzo.nl`;
