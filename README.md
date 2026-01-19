# PCM Requisition System

Production-ready requisition management system for Passion Christian Ministries.

## Live Production

🚀 **Production URL**: https://pcm-requisition.vercel.app

## Features

- Complete requisition workflow (submit, review, approve)
- Project and expense account management
- Email notifications via Resend
- Reports and analytics
- Template management
- User management and permissions
- Organization settings

## Tech Stack

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Email**: Resend API
- **Hosting**: Vercel (Auto-deploy from GitHub)

## Development

### Quick Start (Recommended)

Use the automated startup scripts to ensure you're running the correct multi-tenant client (not the old prototype):

**Windows PowerShell:**
```powershell
.\start-dev.ps1
```

**Windows Command Prompt:**
```cmd
start-dev.bat
```

**Git Bash / WSL / Linux / Mac:**
```bash
./start-dev.sh
```

These scripts will:
1. ✅ Kill any old prototype servers (port 3000)
2. ✅ Kill any stuck dev servers (port 5173)
3. ✅ Start the correct multi-tenant client on http://localhost:5173

### Manual Setup

```bash
# Install dependencies
cd client
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

**Important:** Always use `http://localhost:5173` (not port 3000)

## Deployment

**Automatic**: Every push to `main` branch triggers automatic deployment to Vercel.

```bash
git add .
git commit -m "Your commit message"
git push
```

### Vercel Configuration

The project uses a custom [vercel.json](vercel.json) configuration to:
- Build from the `client` directory
- Output to `client/dist`
- Use Vite as the build tool

### Environment Variables

Required environment variables in Vercel:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon/public key

Required secrets in Supabase Edge Functions:
- `RESEND_API_KEY` - Your Resend API key for email notifications

## Repository

https://github.com/Ronnie1560/pcm-requisition-system

---

**Built for Passion Christian Ministries**
