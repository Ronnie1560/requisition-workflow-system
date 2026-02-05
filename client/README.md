# Requisition Workflow System - Frontend

A modern Requisition and Expense Management System built with React, Vite, and Supabase for Uganda-based organizations.

## Sprint 0: Project Setup - COMPLETED

### Technology Stack

- **Frontend Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Forms**: React Hook Form
- **Date Handling**: date-fns
- **Icons**: Lucide React
- **Routing**: React Router DOM

## Getting Started

### 1. Configure Environment Variables

Update the `.env.local` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_actual_supabase_url
VITE_SUPABASE_ANON_KEY=your_actual_anon_key
```

### 2. Install Dependencies

Dependencies are already installed, but if needed:

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

The application will open at `http://localhost:5173`

### 4. Test Supabase Connection

The app currently displays a **Connection Test Page** that will:
- Verify your Supabase credentials
- Check the connection status
- Display project information
- Provide troubleshooting tips if connection fails

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── auth/          # Authentication components
│   │   ├── layout/        # Layout components (Header, Sidebar, etc.)
│   │   ├── requisitions/  # Requisition-specific components
│   │   └── common/        # Reusable UI components
│   ├── pages/
│   │   ├── auth/          # Login, Register pages
│   │   ├── dashboard/     # Dashboard pages
│   │   ├── requisitions/  # Requisition pages
│   │   ├── admin/         # Admin pages
│   │   └── ConnectionTest.jsx  # Supabase connection test
│   ├── services/
│   │   └── api/           # API service functions
│   ├── utils/
│   │   ├── constants.js   # Status codes, roles, constants
│   │   └── formatters.js  # Date, currency, number formatters
│   ├── hooks/             # Custom React hooks
│   ├── context/           # React Context providers
│   ├── types/             # TypeScript types (if migrating)
│   └── lib/
│       └── supabase.js    # Supabase client configuration
├── .env.local             # Environment variables (your credentials)
├── .env.example           # Environment template
├── tailwind.config.js     # Tailwind configuration with custom colors
└── package.json
```

## Utility Files Created

### Constants ([src/utils/constants.js](src/utils/constants.js))

Defines:
- Requisition statuses (draft, pending, approval, approved, receiving, closed, rejected)
- User roles (admin, manager, staff, accountant, approver)
- Requisition types (purchase, expense, petty_cash)
- Date formats and pagination settings

### Formatters ([src/utils/formatters.js](src/utils/formatters.js))

Provides functions for:
- Date formatting (formatDate, formatDateTime, formatRelativeTime)
- Currency formatting (formatCurrency - UGX)
- Number formatting (formatNumber)
- File size formatting
- Phone number formatting (Uganda format)
- Text truncation

### Supabase Client ([src/lib/supabase.js](src/lib/supabase.js))

Configured with:
- Auto refresh tokens
- Session persistence
- Session detection in URL

## Tailwind Custom Colors

The following status colors are configured:

| Status | Color Code | Tailwind Class |
|--------|-----------|----------------|
| Draft | #BBDEFB | status-draft |
| Pending | #FFF9C4 | status-pending |
| Approval | #FFCCBC | status-approval |
| Approved | #C8E6C9 | status-approved |
| Receiving | #B2DFDB | status-receiving |
| Closed | #D7CCC8 | status-closed |
| Rejected | #FFCDD2 | status-rejected |

## Next Steps

After verifying your Supabase connection:

1. **Database Setup**
   - Create tables in Supabase (users, requisitions, items, approvals)
   - Set up Row Level Security (RLS) policies
   - Create database functions and triggers

2. **Authentication**
   - Implement login/register pages
   - Set up protected routes
   - Create auth context

3. **Core Features**
   - Build requisition forms
   - Implement approval workflows
   - Create dashboard views
   - Add reporting functionality

4. **Additional Features**
   - File uploads for receipts
   - Email notifications
   - Audit trails
   - Budget tracking

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Support

For issues or questions about:
- Supabase setup: [Supabase Documentation](https://supabase.com/docs)
- Vite: [Vite Documentation](https://vitejs.dev)
- React: [React Documentation](https://react.dev)
- Tailwind CSS: [Tailwind Documentation](https://tailwindcss.com)
