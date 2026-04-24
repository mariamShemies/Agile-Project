import { useEffect } from 'react';
import { supabase } from './supabaseClient';

function App() {
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase.from('your_table_name').select('*');
        if (error) {
          console.error('Error fetching data:', error.message);
        } else {
          console.log('Data fetched successfully:', data);
        }
      } catch (err) {
        console.error('Unexpected error:', err);
      }
    };

    fetchData();
  }, []);

  return <h1>UMS Project Running</h1>;
}

export default App;