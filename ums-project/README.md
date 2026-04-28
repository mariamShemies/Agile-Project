📅 Classroom Reservation System

A web-based application that allows scheduling coordinators to reserve classrooms efficiently, avoid conflicts, and manage bookings in real time.

🚀 Features
📌 Create classroom reservations
⏰ Select date, start time, and end time
🏫 Assign reservations to specific rooms
⚠️ Prevent double bookings (conflict handling)
🔄 Real-time database integration using Supabase
💻 Built with modern frontend tools (React + Vite)
🛠️ Tech Stack
Frontend: React (Vite)
Backend / Database: Supabase (PostgreSQL)
Version Control: Git & GitHub
📂 Project Structure
Agile-Project/
│── src/
│   ├── components/
│   ├── pages/
│   ├── supabaseClient.js
│   └── App.jsx
│── public/
│── package.json
│── vite.config.js
🗄️ Database Schema (Supabase)
Reservations Table
create table public.reservations (
  id uuid not null primary key,
  date date,
  start_time timestamp default now(),
  end_time timestamp,
  room_id uuid
);
⚙️ Getting Started

Follow these steps to run the project locally:

1️⃣ Clone the Repository
git clone https://github.com/mariamShemies/Agile-Project.git
cd Agile-Project
2️⃣ Install Dependencies
npm install
3️⃣ Setup Environment Variables

Create a .env file in the root folder and add:

VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

You can find these in your Supabase Project Settings.

4️⃣ Run the Development Server
npm run dev

If you get an error like:

Missing script: "dev"

Make sure your package.json includes:

"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
5️⃣ Open in Browser

Go to:

http://localhost:5173
⚠️ Important Notes
Ensure your Supabase table is created before running the app.
You may need to enable Row Level Security (RLS) and add policies if required.
Time conflict validation should be handled in frontend/backend logic.
