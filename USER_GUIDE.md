# PCM Requisition System - User Guide
**Version 1.0 | January 2026**

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Dashboard](#3-dashboard)
4. [Requisitions](#4-requisitions)
5. [Projects & Expense Accounts](#5-projects--expense-accounts)
6. [Reports](#6-reports)
7. [User Management](#7-user-management)
8. [Settings](#8-settings)
9. [Troubleshooting](#9-troubleshooting)
10. [Quick Reference](#10-quick-reference)

---

## 1. Introduction

### 1.1 What is PCM Requisition System?

The **PCM Requisition System** is a web-based procurement management application that streamlines the process of requesting, reviewing, and approving purchases within your organization.

### 1.2 Key Features

- ✅ **Create Requisitions** - Submit purchase requests with itemized line items
- ✅ **Approval Workflow** - Multi-stage review and approval process
- ✅ **Project-Based Budgeting** - Track spending against project budgets
- ✅ **Document Attachments** - Upload supporting documents (quotes, invoices)
- ✅ **Templates** - Save and reuse common requisitions
- ✅ **Reports & Analytics** - Export data and track spending trends
- ✅ **Multi-Organization** - Support for multiple organizations

### 1.3 User Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| **Submitter** | Regular users who create requisitions | Create, edit drafts, view own requisitions |
| **Reviewer** | First-level approval | Review and mark requisitions as reviewed |
| **Approver** | Final approval authority | Approve or reject reviewed requisitions |
| **Store Manager** | Handles goods receiving | Manage receipts and inventory |
| **Super Admin** | System administrator | Full access to all features and settings |

---

## 2. Getting Started

### 2.1 Accessing the System

1. Open your web browser (Chrome, Firefox, Safari, or Edge recommended)
2. Navigate to your organization's PCM URL
3. Enter your email address and password
4. Click **Sign In**

### 2.2 First-Time Login

1. You will receive an invitation email from your administrator
2. Click the link in the email to set your password
3. Create a strong password (minimum 8 characters, with numbers and special characters)
4. Complete your profile information
5. You're ready to start!

### 2.3 Navigating the Interface

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  PCM Requisition System          [User Menu] [Org] │
├─────────────────────────────────────────────────────────────┤
│  MAIN NAVIGATION                                            │
│  ├── Dashboard                                              │
│  ├── Requisitions                                           │
│  ├── Projects                                               │
│  ├── Expense Accounts                                       │
│  ├── Reports                                                │
│  ├── Users (Admin only)                                     │
│  └── Settings                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    MAIN CONTENT AREA                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 Organization Selector

If you belong to multiple organizations:
1. Click the organization name in the top-right corner
2. Select the organization you want to work with
3. The system will reload with data from the selected organization

---

## 3. Dashboard

### 3.1 Overview

The dashboard provides a quick summary of your requisition activity and pending tasks.

### 3.2 Dashboard Components

#### Quick Stats Cards
- **My Requisitions** - Total number of your requisitions
- **Pending Review** - Requisitions awaiting review (Reviewers/Admins)
- **Awaiting Approval** - Requisitions ready for approval (Approvers/Admins)
- **Drafts** - Your incomplete draft requisitions

#### Recent Activity
Shows the most recent requisition updates including:
- Newly submitted requisitions
- Status changes
- Approval decisions

#### Alerts & Notifications
- Urgent requisitions requiring attention
- Requisitions approaching their required date
- Budget warnings

### 3.3 Quick Actions

From the dashboard, you can quickly:
- **Create New Requisition** - Start a new purchase request
- **View Pending** - See requisitions awaiting your action
- **View Drafts** - Continue working on saved drafts

---

## 4. Requisitions

### 4.1 Requisition List

Navigate to **Requisitions** to see all your requisitions (or all requisitions if you're an admin).

#### Filtering Options
- **Search** - Search by requisition number, title, or project
- **Status Filter** - Filter by status (Draft, Pending, Approved, etc.)

#### Status Meanings

| Status | Color | Description |
|--------|-------|-------------|
| **Draft** | Yellow | Work in progress, not submitted |
| **Pending** | Orange | Submitted, awaiting review |
| **Under Review** | Blue | Being reviewed |
| **Reviewed** | Purple | Reviewed, awaiting approval |
| **Approved** | Green | Approved, ready for procurement |
| **Rejected** | Red | Rejected, requires revision |
| **Cancelled** | Gray | Cancelled by user |
| **Completed** | Indigo | Fully processed |

### 4.2 Creating a New Requisition

#### Step 1: Start a New Requisition
1. Click **New Requisition** button
2. Or use a template by clicking **Use Template**

#### Step 2: Enter Basic Information
- **Title** *(Required)* - A descriptive name for the requisition
- **Project** *(Required)* - Select the project this expense belongs to
- **Expense Account** *(Required)* - Select the budget category
- **Required By Date** - When you need the items
- **Mark as Urgent** - Check if this needs expedited processing
- **Description** - Additional details about the request
- **Justification** - Business reason for the purchase

#### Step 3: Add Line Items
1. Click **Add Item**
2. Search for an item from the catalog
3. Select the item
4. Enter:
   - **Quantity** - How many units you need
   - **Unit of Measure** - Each, Box, Pack, etc.
   - **Unit Price** - Price per unit
5. The system will:
   - Calculate the line total automatically
   - Warn you if the price differs significantly from the catalog price (>10%)
6. Repeat for each item needed

#### Step 4: Attach Documents (Optional)
1. Scroll to the **Attachments** section
2. Drag and drop files, or click **Browse**
3. Supported formats: PDF, JPEG, PNG (up to 5MB each)
4. Add quotes, specifications, or other supporting documents

#### Step 5: Review and Save
1. Check the **Grand Total** at the bottom
2. Click **Save Draft** to save without submitting
3. The system auto-saves every 30 seconds

#### Step 6: Submit for Review
1. When ready, click **Submit for Review**
2. The requisition becomes read-only
3. Reviewers will be notified

### 4.3 Editing a Draft

1. Go to **Requisitions** list
2. Filter by **Draft** status
3. Click on the requisition to open
4. Click **Edit** to modify
5. Make your changes
6. Click **Save Draft** or **Submit for Review**

### 4.4 Viewing Requisition Details

Click any requisition to view:
- **Header Information** - Title, project, dates, status
- **Line Items** - All items with quantities and prices
- **Attachments** - Uploaded documents
- **Comments** - Communication history
- **Approval History** - Who reviewed/approved and when

### 4.5 Using Templates

#### Creating a Template
1. Create a requisition with your common items
2. Click **Save as Template**
3. Enter a template name and description
4. Click **Save**

#### Using a Template
1. Go to **Requisitions** → **New Requisition**
2. Click **Use Template**
3. Select a template from the list
4. The form populates with template data
5. Modify as needed and submit

#### Managing Templates
1. Go to **Requisitions** → **Manage Templates**
2. View, edit, or delete your templates

### 4.6 Reviewing Requisitions (Reviewers)

If you're a **Reviewer**:

1. Go to **Dashboard** or **Requisitions**
2. Look for requisitions with **Pending** status
3. Click to open the requisition
4. Review the details:
   - Are items appropriate?
   - Is pricing reasonable?
   - Is justification adequate?
5. Add comments if needed
6. Click **Start Review** to begin
7. When satisfied, click **Mark as Reviewed**
8. Or click **Reject** if changes are needed

### 4.7 Approving Requisitions (Approvers)

If you're an **Approver**:

1. Go to **Dashboard** or **Requisitions**
2. Look for requisitions with **Reviewed** status
3. Click to open the requisition
4. Review the details and reviewer comments
5. Check budget availability
6. Add approval comments if needed
7. Click **Approve** to approve
8. Or click **Reject** with a reason if not approved

### 4.8 Printing Requisitions

1. Open the requisition you want to print
2. Click the **Print** icon
3. A print preview dialog opens
4. Choose to **Print** or **Download as PDF**
5. The printed version includes:
   - Organization header and logo
   - All requisition details
   - Line items table
   - Approval signatures

### 4.9 Exporting to Excel

1. Go to **Requisitions** list
2. Apply any filters you need
3. Click **Export to Excel**
4. A spreadsheet downloads with:
   - All visible requisitions
   - Full details including line items

---

## 5. Projects & Expense Accounts

### 5.1 Understanding Projects

Projects represent organizational units or initiatives with dedicated budgets.

#### Viewing Projects
1. Navigate to **Projects**
2. See all projects you're assigned to
3. View budget information:
   - **Total Budget** - Allocated funds
   - **Spent Amount** - Already used
   - **Available** - Remaining budget

### 5.2 Project Details

Click a project to see:
- **Overview** - Budget summary and status
- **Expense Accounts** - Categories under this project
- **Team Members** - Users assigned to the project
- **Requisitions** - All requisitions charged to this project

### 5.3 Expense Accounts

Expense accounts categorize spending within a project.

Examples:
- Office Supplies
- Equipment
- Travel
- Professional Services
- Maintenance

#### Viewing Expense Accounts
1. Navigate to **Expense Accounts**
2. Filter by project if needed
3. See account details and spending

---

## 6. Reports

### 6.1 Available Reports

| Report | Description | Access |
|--------|-------------|--------|
| **Requisition Summary** | Overview of all requisitions by status | All users |
| **Spending by Project** | Budget vs actual spending | Reviewers, Approvers, Admins |
| **Spending by Account** | Breakdown by expense category | Reviewers, Approvers, Admins |
| **User Activity** | Requisitions per user | Admins only |
| **Approval Metrics** | Approval times and bottlenecks | Admins only |

### 6.2 Generating Reports

1. Navigate to **Reports**
2. Select the report type
3. Set date range and filters
4. Click **Generate Report**
5. View on screen or export to Excel/PDF

### 6.3 Exporting Data

All reports can be exported:
- **Excel (.xlsx)** - For further analysis
- **PDF** - For printing and sharing
- **CSV** - For data import to other systems

---

## 7. User Management

*Available to Super Admins only*

### 7.1 Viewing Users

1. Navigate to **Users**
2. See all users in your organization
3. Filter by role, status, or department

### 7.2 Inviting New Users

1. Click **Invite User**
2. Enter user details:
   - Email address
   - Full name
   - Role (Submitter, Reviewer, Approver, etc.)
   - Department
3. Click **Send Invitation**
4. User receives an email to set up their account

### 7.3 Managing User Roles

1. Click on a user to view their profile
2. Click **Edit**
3. Change their role as needed
4. Assign them to projects
5. Click **Save**

### 7.4 Deactivating Users

1. Open the user's profile
2. Click **Deactivate User**
3. Confirm the action
4. User can no longer access the system

---

## 8. Settings

### 8.1 Profile Settings

1. Click your name in the top-right corner
2. Select **Profile**
3. Update your information:
   - Full name
   - Phone number
   - Department
   - Profile picture

### 8.2 Notification Preferences

1. Go to **Settings** → **Notifications**
2. Configure email notifications:
   - New requisitions assigned
   - Status changes
   - Approval requests
   - System announcements

### 8.3 Organization Settings

*Available to Super Admins only*

- **Organization Name** - Update organization details
- **Logo** - Upload organization logo
- **Currency** - Set default currency (e.g., UGX)
- **Approval Thresholds** - Set limits for automatic routing

---

## 9. Troubleshooting

### 9.1 Common Issues

#### "Cannot see any projects"
- Contact your administrator to be assigned to projects
- Ensure you're in the correct organization

#### "Cannot submit requisition"
- Ensure all required fields are filled (Title, Project, Expense Account)
- Add at least one line item
- Save as draft first, then submit

#### "Expense Account dropdown is empty"
- Select a project first
- Expense accounts are filtered by project
- Contact admin if no accounts appear for your project

#### "File upload failed"
- Check file size (max 5MB)
- Ensure file type is supported (PDF, JPEG, PNG)
- Try a different file or reduce file size

#### "Session expired"
- For security, sessions timeout after 30 minutes of inactivity
- Sign in again to continue

### 9.2 Getting Help

If you encounter issues:
1. Check this user guide first
2. Contact your organization's system administrator
3. For technical issues, provide:
   - Screenshot of the error
   - What you were trying to do
   - Your browser and device

---

## 10. Quick Reference

### 10.1 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save draft |
| `Tab` | Move to next field |
| `Shift + Tab` | Move to previous field |
| `Esc` | Close modal/dialog |

### 10.2 Requisition Workflow Diagram

```
┌─────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐     ┌───────────┐
│  DRAFT  │ ──▶ │ PENDING │ ──▶ │ REVIEWED │ ──▶ │ APPROVED │ ──▶ │ COMPLETED │
└─────────┘     └─────────┘     └──────────┘     └──────────┘     └───────────┘
     │               │                │                │
     │               │                │                │
     ▼               ▼                ▼                ▼
[User edits]   [Reviewer]       [Approver]      [Procurement]
               reviews &        approves or     processes order
               comments         rejects
```

### 10.3 Role Permissions Matrix

| Action | Submitter | Reviewer | Approver | Store Mgr | Super Admin |
|--------|:---------:|:--------:|:--------:|:---------:|:-----------:|
| Create requisitions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit own drafts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit requisitions | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all requisitions | ❌ | ✅ | ✅ | ✅ | ✅ |
| Review requisitions | ❌ | ✅ | ❌ | ❌ | ✅ |
| Approve requisitions | ❌ | ❌ | ✅ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage projects | ❌ | ❌ | ❌ | ❌ | ✅ |
| View reports | Own | All | All | Own | All |
| System settings | ❌ | ❌ | ❌ | ❌ | ✅ |

### 10.4 Status Colors at a Glance

```
🟡 Draft           - Yellow  - In progress
🟠 Pending         - Orange  - Awaiting review
🔵 Under Review    - Blue    - Being reviewed
🟣 Reviewed        - Purple  - Ready for approval
🟢 Approved        - Green   - Approved
🔴 Rejected        - Red     - Needs revision
⚫ Cancelled       - Gray    - Cancelled
🔵 Completed       - Indigo  - Fully processed
```

### 10.5 Contact Information

For system support:
- **Email:** [your-admin-email]
- **Phone:** [your-support-number]
- **Hours:** Monday - Friday, 8:00 AM - 5:00 PM

---

## Document Information

| Field | Value |
|-------|-------|
| **Version** | 1.0 |
| **Last Updated** | January 22, 2026 |
| **Author** | PCM Development Team |
| **Status** | Final |

---

*Thank you for using PCM Requisition System. We're here to make procurement simple!*
