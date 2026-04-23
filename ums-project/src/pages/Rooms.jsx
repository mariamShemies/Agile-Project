import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    let { data } = await supabase.from("rooms").select("*");
    setRooms(data);
  };

  return (
    <div>
      <h2>Rooms</h2>
      {rooms.map(room => (
        <div key={room.id}>
          {room.name} - Capacity: {room.capacity}
        </div>
      ))}
    </div>
  );
}