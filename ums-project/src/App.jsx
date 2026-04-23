import { useEffect } from 'react'
import { supabase } from './supabaseClient'

function App() {
  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase.from('your_table_name').select('*')
      console.log(data, error)
    }

    fetchData()
  }, [])

  return <h1>UMS Project Running</h1>
}

export default App