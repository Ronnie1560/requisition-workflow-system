# Requisition Workflow System — User Manual

**Passion Christian Ministries**
*Version 1.0 — February 2026*

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Understanding the Workflow](#2-understanding-the-workflow)
3. [Submitter Guide](#3-submitter-guide)
4. [Approver Guide](#4-approver-guide)
5. [Common Features](#5-common-features)
6. [Frequently Asked Questions](#6-frequently-asked-questions)

---

## 1. Getting Started

### 1.1 What Is This System?

The Requisition Workflow System allows staff to request purchases and track them through a structured review-and-approval process. Every purchase request (called a **requisition**) follows a clear path from creation to approval, ensuring accountability and proper authorization before any money is spent.

### 1.2 Your Role

Your organization administrator assigns you a **workflow role** that determines what you can do in the system:

| Role | Primary Responsibility |
|------|----------------------|
| **Submitter** | Creates and submits requisitions for review |
| **Reviewer** | Reviews submitted requisitions for completeness and accuracy |
| **Approver** | Gives final authorization on reviewed requisitions |
| **Super Admin** | Full system access, manages settings and users |

> You may hold more than one role. This manual covers the **Submitter** and **Approver** roles in detail.

### 1.3 Signing In

1. Open the application URL provided by your administrator.
2. Enter your email address and password.
3. If you belong to multiple organizations, select the correct one from the organization switcher.
4. You will land on your **Dashboard**.

---

## 2. Understanding the Workflow

Every requisition moves through a series of stages. Understanding this flow helps you know what to expect after you take an action.

### 2.1 Requisition Lifecycle

```
 ┌──────────┐      ┌─────────────┐      ┌──────────────┐      ┌──────────┐      ┌──────────┐
 │  DRAFT   │─────>│   PENDING   │─────>│ UNDER REVIEW │─────>│ REVIEWED │─────>│ APPROVED │
 │          │      │   REVIEW    │      │              │      │          │      │          │
 └──────────┘      └──────┬──────┘      └──────┬───────┘      └────┬─────┘      └──────────┘
   Submitter         Submitter           Reviewer            Reviewer          Approver
   creates           submits          starts review       marks reviewed       approves
                           │                  │                   │
                           │                  │                   │
                           v                  v                   v
                      ┌──────────┐       ┌──────────┐       ┌──────────┐
                      │ REJECTED │       │ REJECTED │       │ REJECTED │
                      └──────────┘       └──────────┘       └──────────┘
                       Reviewer           Reviewer           Approver
                       rejects            rejects            rejects
```

### 2.2 Status Definitions

| Status | What It Means | Who Acts Next |
|--------|--------------|---------------|
| **Draft** | Requisition is being prepared. Not yet visible to reviewers for action. | Submitter |
| **Pending Review** | Submitted and waiting for a reviewer to pick it up. | Reviewer |
| **Under Review** | A reviewer is actively examining the requisition. | Reviewer |
| **Reviewed** | The reviewer has verified the requisition. It now awaits final approval. | Approver |
| **Approved** | Authorized for purchase. The requisition is complete and locked. | — (complete) |
| **Rejected** | Declined by a reviewer or approver. A reason is always provided. | Submitter (create a new one) |

### 2.3 Key Rules

- **Conflict of interest**: You cannot review or approve a requisition you submitted yourself.
- **Rejection requires a reason**: Whenever a requisition is rejected, the person rejecting it must explain why.
- **Locked after submission**: Once submitted, a requisition cannot be edited. If changes are needed after rejection, you must create a new requisition.
- **Requisition numbers**: A unique number (e.g., `REQ-000042`) is assigned automatically when you submit. Drafts do not have a number.

---

## 3. Submitter Guide

As a Submitter, your job is to create clear, complete purchase requests so that reviewers and approvers can process them efficiently.

### 3.1 Your Dashboard

When you sign in, your dashboard shows you:

- **Total Requisitions** — Everything you have created
- **Drafts** — Requisitions you started but have not submitted
- **Pending Review** — Submitted and waiting for a reviewer
- **Under Review** — Currently being reviewed
- **Reviewed** — Passed review, awaiting approval
- **Approved** — Fully authorized
- **Rejected** — Declined (with reason)
- **Total Amount** — Combined value of all your requisitions

**Quick Actions** appear at the top. Look for:
- **Draft Requisitions** — Jump to your unfinished drafts
- **New Requisition** — Start creating a new one

---

### 3.2 Creating a New Requisition

#### Step 1 — Start

Click **"New Requisition"** from the dashboard or the requisitions list page.

#### Step 2 — Fill in the Header

| Field | Required? | Description |
|-------|-----------|-------------|
| **Title** | Yes | A short, descriptive name (e.g., "Office Supplies for February") |
| **Project** | Yes | The project this purchase is for. This determines which expense accounts are available. |
| **Expense Account** | Yes | The budget line to charge. Options depend on the project you selected. |
| **Description** | No | Additional context about the purchase |
| **Justification** | No | Why this purchase is needed — especially helpful for unusual or large requests |
| **Required By** | No | The date you need the items by |
| **Delivery Location** | No | Where the items should be delivered |
| **Supplier Preference** | No | A preferred vendor, if any |
| **Urgent** | No | Toggle on if time-sensitive. An "Urgent" badge will appear on the requisition. |

> **Tip**: A clear title and justification help reviewers and approvers process your request faster.

#### Step 3 — Add Line Items

Every requisition must have **at least one line item**. Each line item represents something you want to purchase.

1. Click **"Add Item"** or select from the item catalog.
2. Fill in the details:

| Field | Required? | Description |
|-------|-----------|-------------|
| **Item** | Yes | Select from the catalog or describe the item |
| **Quantity** | Yes | How many units you need (must be greater than 0) |
| **Unit of Measure** | Yes | e.g., Each, Box, Pack, Kg |
| **Unit Price** | Yes | Price per unit (can be 0 for donated items) |
| **Notes** | No | Special instructions for this item |

The system automatically calculates:
- **Line Total** = Quantity × Unit Price
- **Grand Total** = Sum of all line totals

You can **reorder**, **edit**, or **remove** line items at any time while the requisition is in draft.

> **Price variance**: If you enter a price higher than the catalog price, the system flags it for reviewer attention. This does not prevent submission.

#### Step 4 — Add Attachments (Optional)

Supporting documents strengthen your request. Click **"Add File"** to upload:
- Supplier quotes
- Product specifications
- Supporting correspondence
- Photos or screenshots

Any file type is accepted. Each file shows its name, size, and upload date.

#### Step 5 — Save or Submit

You have two choices:

| Action | What Happens |
|--------|-------------|
| **Save as Draft** | Saves your work. You can come back and edit later. No one is notified. |
| **Submit for Review** | Sends the requisition to reviewers. You will be asked to confirm. Once submitted, you cannot edit it. |

> **Auto-save**: The system automatically saves your draft every 30 seconds while you are editing. Look for the "Last saved" timestamp at the bottom of the form.

---

### 3.3 Managing Your Drafts

Drafts are your work in progress. You can:

- **Edit** — Open the draft and modify any field
- **Delete** — Permanently remove a draft you no longer need
- **Submit** — Send it for review when ready

Find your drafts by:
1. Clicking **"Draft Requisitions"** on the dashboard, or
2. Going to the requisitions list and filtering by **Draft** status

---

### 3.4 Submitting a Requisition

When your requisition is complete:

1. Open the requisition (or click **"Submit for Review"** from the edit screen).
2. A **confirmation dialog** appears. Review the summary.
3. Click **"Confirm"** to submit.

**What happens next:**
- The status changes from **Draft** to **Pending Review**.
- A unique **requisition number** is assigned (e.g., `REQ-000042`).
- All reviewers in your organization receive a notification.
- The requisition is now **locked** — you can no longer edit it.

---

### 3.5 Tracking Your Requisitions

After submitting, you can monitor progress:

1. Go to **Requisitions** in the navigation menu.
2. Your list shows all requisitions you have created.
3. Use the **status filter** to focus on specific stages (e.g., show only "Pending Review").
4. Use the **search bar** to find requisitions by number, title, or project.
5. Click any requisition to see its full details, including:
   - Current status and status history
   - Comments from reviewers and approvers
   - Timestamps for each workflow step

#### Status Badges at a Glance

| Badge Color | Status |
|------------|--------|
| Gray | Draft |
| Yellow | Pending Review |
| Blue | Under Review / Reviewed |
| Green | Approved |
| Red | Rejected |

---

### 3.6 When a Requisition Is Rejected

If a reviewer or approver rejects your requisition:

1. You will receive a **notification**.
2. Open the requisition to see the **rejection reason** — this is always provided.
3. Review the comments for additional feedback.
4. **You cannot edit a rejected requisition.** Instead, create a **new requisition** incorporating the feedback.

> **Tip**: Use the **"Save as Template"** feature before submitting, so you can quickly recreate a similar requisition if it gets rejected.

---

### 3.7 Using Templates

Templates save you time on recurring purchases.

#### Saving a Template

1. While creating or editing a requisition, click **"Save as Template"**.
2. Enter a **Template Name** (e.g., "Monthly Office Supplies") and optional **Description**.
3. The template saves the project, expense account, all line items, and other header fields.

#### Creating from a Template

1. On the requisitions list page, click **"From Template"**.
2. Select a template from the list.
3. A new draft is created with all the template data pre-filled.
4. Adjust quantities, prices, or items as needed.
5. Submit when ready.

#### Managing Templates

Go to **Templates** (accessible from the requisitions section) to:
- View all your templates
- Edit template details and line items
- Activate or deactivate templates
- Delete templates you no longer need

---

### 3.8 Adding Comments

You can add comments on any requisition, including ones that have been submitted:

1. Open the requisition detail page.
2. Scroll to the **Comments** section.
3. Type your comment and click **"Post"**.

Comments are visible to all parties involved (submitter, reviewers, approvers). Use comments to:
- Respond to reviewer questions
- Provide additional context
- Clarify line item details

---

### 3.9 Printing and Exporting

#### Print or Download PDF

1. Open a requisition.
2. Click **"Preview & Export"**.
3. A print preview dialog opens showing the formatted requisition.
4. Use the **zoom controls** (50%–200%) to adjust the preview.
5. Choose:
   - **Print** — Opens your browser's print dialog
   - **Download PDF** — Saves a PDF file to your computer

The printout includes: requisition header, organization information, all line items with totals, and comments.

#### Export to Excel/CSV

- **Single requisition**: From the preview dialog, click **"Export CSV"**.
- **Multiple requisitions**: From the list page, click the **export** button to download all visible requisitions to Excel.

---

## 4. Approver Guide

As an Approver, you provide the final authorization on requisitions that have passed review. Your approval means the organization is authorized to proceed with the purchase.

### 4.1 Your Dashboard

Your dashboard highlights what needs your attention:

- **Total in Queue** — All requisitions that have reached the approval stage
- **Awaiting Approval** — Reviewed requisitions waiting for your decision (this is your action item)
- **Approved** — Requisitions you have approved
- **Rejected** — Requisitions you have rejected
- **Approved Amount** — Total monetary value of your approvals
- **Total Amount** — Combined value of all requisitions in your queue

**Quick Actions:**
- **Awaiting Approval** — Jump directly to requisitions that need your decision

> The **"Awaiting Approval"** card is highlighted when there are items that need your attention.

---

### 4.2 Finding Requisitions to Approve

Requisitions arrive in your queue after a reviewer marks them as **"Reviewed"**. To find them:

1. Click **"Awaiting Approval"** on your dashboard, or
2. Go to the requisitions list and filter by **"Reviewed"** status.

Each item in the list shows:
- Requisition number
- Title (with "Urgent" badge if applicable)
- Project name
- Total amount
- Status badge
- Date submitted
- Number of line items

---

### 4.3 Reviewing a Requisition Before Approval

Before making a decision, examine the requisition thoroughly:

1. **Click the requisition** to open its detail page.
2. Review the following sections:

#### Header Information
- Who submitted it and when
- Project and expense account
- Justification provided
- Whether it is marked urgent
- Required-by date

#### Line Items
- Verify each item, quantity, and price
- Check the grand total
- Look for any price variance flags (price exceeds catalog)

#### Attachments
- Open any supporting documents (quotes, specifications)
- Verify they match the line items

#### Comments & Activity
- Read the reviewer's comments
- Check if the submitter provided additional context
- Review the activity timeline to see when each step occurred

#### Review History
- Note who reviewed it and when
- Check any internal reviewer comments

---

### 4.4 Approving a Requisition

When you are satisfied that the requisition is valid and should proceed:

1. Click the **"Approve"** button (green).
2. Optionally add **approval comments** (e.g., "Approved — please use vendor XYZ for best pricing").
3. Confirm your decision.

**What happens:**
- Status changes from **Reviewed** to **Approved**.
- The submitter receives a notification that their requisition was approved.
- The requisition is **locked** — no further changes can be made.
- The approval is timestamped with your name for the audit trail.

> **Important**: You cannot approve a requisition that you submitted yourself. The Approve button will not appear on your own requisitions.

---

### 4.5 Rejecting a Requisition

If the requisition should not proceed:

1. Click the **"Reject"** button (red).
2. **You must provide a rejection reason** — this field is required. Be specific so the submitter understands what needs to change.
3. Confirm your decision.

**What happens:**
- Status changes to **Rejected**.
- The submitter receives a notification with your rejection reason.
- The requisition is closed. The submitter will need to create a new requisition if they wish to try again.

**Good rejection reasons:**
- "Budget for this project has been exhausted. Please resubmit under Project B."
- "Total exceeds authorized limit. Please split into two requisitions under $5,000 each."
- "Supplier quote is expired. Please obtain an updated quote and resubmit."

**Unhelpful rejection reasons:**
- "No" — Does not tell the submitter what to fix
- "Rejected" — Gives no actionable feedback

---

### 4.6 Adding Comments Without Approving or Rejecting

If you need more information before making a decision:

1. Scroll to the **Comments** section on the requisition detail page.
2. Type your question or feedback.
3. Click **"Post"**.

The submitter will be notified and can respond. You can then return to the requisition later to approve or reject.

> **Tip**: Use comments to ask questions rather than rejecting outright. Rejection is a final action that requires the submitter to start over.

---

### 4.7 Notifications

The system keeps you informed through **in-app notifications**:

- **Bell icon** in the top navigation bar shows your unread notification count.
- Click the bell to open the **Notification Center**.
- Each notification links directly to the relevant requisition.
- Click a notification to mark it as read and navigate to the requisition.

**Notifications you will receive:**
| Event | Notification |
|-------|-------------|
| Requisition is reviewed and ready for your approval | "Requisition REQ-XXXX is ready for approval" |
| Someone comments on a requisition in your queue | "New comment on REQ-XXXX" |

---

### 4.8 Exporting and Reporting

As an approver, you may need records for auditing or reporting:

- **Print/PDF**: Open any requisition → "Preview & Export" → Print or download
- **Excel Export**: From the list view, export filtered results to Excel
- **CSV Export**: From an individual requisition's preview dialog

Use the list page filters to generate focused exports:
- Filter by **Approved** status to see all authorized purchases
- Filter by date range to review a specific period
- Search by project to see spending by project

---

## 5. Common Features

These features are available to both Submitters and Approvers.

### 5.1 Navigation

The main navigation menu includes:
- **Dashboard** — Your role-specific overview and quick actions
- **Requisitions** — List of all requisitions you can access
- **Templates** — Saved requisition templates (Submitters)
- **Notifications** — Your notification center

### 5.2 Searching and Filtering

On the requisitions list page:
- **Search bar** — Find by requisition number, title, or project name
- **Status filter** — Show only requisitions in a specific status
- **Sort** — Click column headers to sort by number, title, date, or amount

### 5.3 Organization Switcher

If you belong to multiple organizations:
1. Click the organization name in the header.
2. Select a different organization.
3. Your dashboard and requisitions will update to show data for the selected organization.

> Each organization's data is completely separate. You will only see requisitions for your currently selected organization.

### 5.4 Profile and Sign Out

- Click your name or avatar in the top-right corner.
- Access profile settings or sign out.

---

## 6. Frequently Asked Questions

### For Submitters

**Q: Can I edit a requisition after submitting it?**
A: No. Once submitted, a requisition is locked. If changes are needed, you must create a new requisition. To avoid this, use the **Save as Draft** feature and review carefully before submitting.

**Q: What happens if my requisition is rejected?**
A: You will receive a notification with the rejection reason. Open the requisition to read the full feedback. To try again, create a new requisition that addresses the feedback. You cannot resubmit or edit the rejected one.

**Q: Can I delete a submitted requisition?**
A: No. Only **draft** requisitions can be deleted. Submitted requisitions are permanent records for audit purposes.

**Q: How do I know when my requisition is approved?**
A: You will receive an in-app notification. You can also check the requisition's status on the list page or your dashboard.

**Q: Can I see who reviewed and approved my requisition?**
A: Yes. Open the requisition detail page. The reviewer's and approver's names and timestamps are displayed in the activity section.

**Q: How do I create a requisition similar to one I made before?**
A: Use **Templates**. Either save a template before submitting a requisition, or go to the Templates page to create one from scratch. Then use "From Template" when creating a new requisition.

**Q: What does the "Urgent" flag do?**
A: It adds an "Urgent" badge to the requisition, making it visually prominent in the list. This helps reviewers and approvers prioritize your request, but it does not change the workflow steps.

**Q: My draft disappeared — where is it?**
A: Check the **Draft** filter on the requisitions list. If auto-save was interrupted (e.g., you closed the browser), the last auto-saved version should still be there. Drafts are saved every 30 seconds.

---

### For Approvers

**Q: Can I approve a requisition that has not been reviewed?**
A: No. As a standard Approver, you can only approve requisitions with **Reviewed** status. A reviewer must mark it as reviewed first. Super Admins can override this restriction.

**Q: I submitted a requisition — can I also approve it?**
A: No. The system prevents you from approving your own requisitions to maintain proper separation of duties. The Approve button will not appear on requisitions you submitted.

**Q: Can I undo an approval?**
A: No. Approval is a final action. If a mistake was made, contact your administrator to discuss options.

**Q: What if I need more information before approving?**
A: Use the **Comments** feature to ask the submitter for clarification. Do not reject the requisition just to ask a question — rejection is a final action and requires the submitter to start over.

**Q: How do I see the total value of everything I've approved?**
A: Your dashboard shows the **Approved Amount** — the sum of all requisitions you have approved. For more detail, filter the list by "Approved" status and export to Excel.

**Q: Can I delegate my approval authority to someone else?**
A: This feature is not currently available. If you will be unavailable, contact your administrator to arrange coverage.

---

*For technical support or access issues, contact your organization administrator.*
