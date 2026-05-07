# University Management System

This project is a role-based university management system built with React, Vite, and Supabase. It supports both staff and student workflows, with protected routes, dashboard summaries, and data-driven pages for managing applications, subjects, staff, students, reservations, and elective registration.

## What it does

- Staff can review applications, assign instructors, manage subjects, view student profiles, reserve rooms, and check professor schedules.
- Students can view their dashboard and register for electives.
- Authentication and route protection are handled through Supabase and the app's protected routing layer.
- Dashboard cards pull live counts from Supabase so the UI reflects current system data.

## Tech Stack

- React 19
- Vite
- React Router
- Supabase Auth and Postgres
- Lucide React icons

## Main Screens

- Login
- Staff dashboard
- Student dashboard
- Applications and application review
- Student profiles
- Assign instructors
- Subject management and subject catalog
- Room reservation and room availability
- Professor schedule
- Staff directory and staff management
- Elective registration

## Project Structure

- `src/App.jsx` contains the app shell, navigation, and route definitions.
- `src/context/AuthContext.jsx` manages authentication state and role-based access.
- `src/pages/` contains the individual feature pages.
- `src/lib/` contains Supabase data helpers and domain logic.
- `src/components/ProtectedRoute.jsx` guards authenticated routes.
- `supabase/` contains SQL setup scripts for the database schema and policies.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in `ums-project/` and add your Supabase credentials:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Start the development server:

```bash
npm run dev
```

4. Open the local app in your browser at the Vite URL shown in the terminal.

## Available Scripts

- `npm run dev` starts the local development server.
- `npm run build` creates a production build.
- `npm run lint` runs ESLint.
- `npm run preview` previews the production build locally.

## Supabase Notes

The app expects Supabase tables and policies for core data such as staff, students, subjects, applications, rooms, reservations, and elective registrations. The SQL files in `supabase/` are the place to start when setting up the backend schema.

## License

This project is for educational use.
