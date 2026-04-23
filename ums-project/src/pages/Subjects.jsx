import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Subjects() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const createSubject = async () => {
    await supabase.from("subjects").insert([
      { name, code, active: true }
    ]);
    alert("Subject created");
  };

  return (
    <div>
      <h2>Create Subject</h2>
      <input onChange={e => setName(e.target.value)} placeholder="Name" />
      <input onChange={e => setCode(e.target.value)} placeholder="Code" />
      <button onClick={createSubject}>Create</button>
    </div>
  );
}