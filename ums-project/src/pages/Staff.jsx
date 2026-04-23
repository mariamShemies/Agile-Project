import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Staff() {
  const [name, setName] = useState("");

  const addProfessor = async () => {
    await supabase.from("staff").insert([
      { name, role: "professor" }
    ]);
    alert("Professor added");
  };

  return (
    <div>
      <h2>Add Professor</h2>
      <input onChange={e => setName(e.target.value)} />
      <button onClick={addProfessor}>Add</button>
    </div>
  );
}