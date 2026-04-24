import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Rooms() {
  const [rooms, setRooms] = useState([])

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('*')
    setRooms(data ?? [])
  }

  return (
    <section className="page-card">
      <h2>Rooms</h2>
      {rooms.map((room) => (
        <div key={room.id} className="list-row">
          {room.name} - Capacity: {room.capacity}
        </div>
      ))}
    </section>
  )
}