import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Applications() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const submitApplication = async () => {
    await supabase.from("applications").insert([
      { name, email, status: "pending" }
    ]);
    alert("Application submitted");
  };

  return (
    <div>
      <h2>Submit Application</h2>
      <input placeholder="Name" onChange={e => setName(e.target.value)} />
      <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <button onClick={submitApplication}>Submit</button>
    </div>
  );
}

const [applications, setApplications] = useState([]);

const fetchApplications = async () => {
  let { data } = await supabase.from("applications").select("*");
  setApplications(data);
};

const updateStatus = async (id, status) => {
  await supabase
    .from("applications")
    .update({ status })
    .eq("id", id);

  fetchApplications();
};
<button onClick={fetchApplications}>Load Applications</button>

{applications.map(app => (
  <div key={app.id}>
    {app.name} - {app.status}
    <button onClick={() => updateStatus(app.id, "approved")}>Approve</button>
    <button onClick={() => updateStatus(app.id, "rejected")}>Reject</button>
  </div>
))}