# Dialog-Based Reports & Print Preview Proposal

**Date**: 2026-01-18
**Status**: Proposal

---

## Current State

### Reports Page
- **Current**: Full page at `/reports`
- **Issues**:
  - Navigates away from current work
  - Can't quickly preview while working on requisition
  - Hard to compare reports side-by-side
  - Loses context when navigating back

### Requisition Print/PDF
- **Current**: Opens new browser window/tab
- **Issues**:
  - Popup blockers may prevent opening
  - New window clutters browser
  - No preview before committing to print
  - Can't see original requisition while previewing
  - User must select "Save as PDF" manually

---

## Proposed Solution: Dialog-Based UI

### Benefits
✅ **Stay in context** - No navigation, keep working
✅ **Faster workflow** - Quick preview and export
✅ **Better UX** - Modern modal experience
✅ **Side-by-side** - View preview alongside data
✅ **Progressive** - Preview → Adjust → Export
✅ **Responsive** - Works on all screen sizes

---

## Proposal 1: Requisition Print Preview Dialog 🎯 **RECOMMENDED**

### Current Flow
```
View Requisition → Click "PDF" → New Window Opens → Print Dialog → Save as PDF → Close Window
```

### New Flow
```
View Requisition → Click "Preview & Print" → Modal Opens → Preview → Choose Action:
  - Print (direct to printer)
  - Save as PDF (one-click download)
  - Email (future feature)
  - Close
```

### Implementation

**Component**: `RequisitionPrintDialog.jsx`

**Features**:
- **Live Preview**: See exact printable format in dialog
- **Multiple Actions**:
  - 🖨️ Print (opens print dialog)
  - 📄 Download PDF (generates PDF client-side)
  - 📧 Email (future)
  - 📊 Export CSV
- **Zoom Controls**: 50%, 75%, 100%, 150%
- **Page Layout**: Toggle portrait/landscape
- **Organization Branding**: Use actual logo/colors
- **Responsive**: Full-screen on mobile

**Technical Approach**:
```javascript
// Option A: Client-side PDF generation (RECOMMENDED)
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const generatePDF = async () => {
  const element = printPreviewRef.current
  const canvas = await html2canvas(element)
  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  pdf.addImage(imgData, 'PNG', 0, 0, 210, 297)
  pdf.save(`requisition_${requisition.requisition_number}.pdf`)
}

// Option B: React-PDF (Alternative)
import { PDFDownloadLink } from '@react-pdf/renderer'
```

**UI Design**:
```
┌─────────────────────────────────────────────────┐
│  Requisition Preview                        ✕   │
├─────────────────────────────────────────────────┤
│                                                  │
│  [🖨️ Print] [📄 PDF] [📊 CSV] [📧 Email]       │
│  [🔍- 50%] [100%] [150% 🔍+]                    │
│                                                  │
│  ┌───────────────────────────────────────────┐ │
│  │                                            │ │
│  │   [LIVE PREVIEW OF PRINTABLE FORMAT]      │ │
│  │                                            │ │
│  │   Organization Name                        │ │
│  │   PURCHASE REQUISITION                     │ │
│  │   REQ-2026-001                            │ │
│  │                                            │ │
│  │   Title: Office Supplies                  │ │
│  │   Project: Marketing Campaign             │ │
│  │   ...                                      │ │
│  │                                            │ │
│  │   [TABLE OF LINE ITEMS]                   │ │
│  │                                            │ │
│  │   Total: UGX 1,500,000                    │ │
│  │                                            │ │
│  │   [SIGNATURE LINES]                       │ │
│  │                                            │ │
│  └───────────────────────────────────────────┘ │
│                                                  │
│                        [Close]                   │
└─────────────────────────────────────────────────┘
```

---

## Proposal 2: Reports Quick View Dialog

### Current Flow
```
Dashboard → Navigate to /reports → Select report type → Filter → View → Export → Go back
```

### New Flow
```
Dashboard → Click "📊 Reports" icon → Dialog opens → Select report → Instant preview → Export → Stay in context
```

### Implementation

**Component**: `ReportsQuickViewDialog.jsx`

**Features**:
- **Report Tabs**: Switch between report types without closing
- **Live Filters**: Date range, project, user, status
- **Visual Charts**: Bar, pie, line charts
- **Data Table**: Sortable, searchable
- **Export Options**: CSV, Excel, PDF
- **Share**: Email, copy link
- **Favorites**: Save common report configs

**UI Design**:
```
┌──────────────────────────────────────────────────────┐
│  Reports                                          ✕   │
├──────────────────────────────────────────────────────┤
│                                                       │
│  [Status] [Submitter] [Project] [Spending] [Trends] │
│                                                       │
│  Filters: [📅 Date Range] [👤 User] [📁 Project]    │
│           [🔄 Refresh]                                │
│                                                       │
│  ┌─────────────────────────────────────────────────┐│
│  │                                                  ││
│  │  📊 Spending by Project (Jan 2026)             ││
│  │                                                  ││
│  │  [BAR CHART VISUALIZATION]                      ││
│  │                                                  ││
│  │  ┌──────────────────────────────────┐          ││
│  │  │ Project A    ████████ 45%        │          ││
│  │  │ Project B    ██████ 35%          │          ││
│  │  │ Project C    ███ 20%             │          ││
│  │  └──────────────────────────────────┘          ││
│  │                                                  ││
│  │  [DATA TABLE]                                   ││
│  │  Project      Amount        % of Total          ││
│  │  ──────────   ───────────   ─────────          ││
│  │  Project A    4,500,000     45%                 ││
│  │  Project B    3,500,000     35%                 ││
│  │  Project C    2,000,000     20%                 ││
│  │  ──────────   ───────────   ─────────          ││
│  │  TOTAL        10,000,000    100%                ││
│  │                                                  ││
│  └─────────────────────────────────────────────────┘│
│                                                       │
│  [📥 Export CSV] [📄 Export PDF] [📧 Email] [Close] │
└──────────────────────────────────────────────────────┘
```

---

## Proposal 3: Dashboard Widget Integration

### Add Quick Access Buttons

**Where**: Dashboard page
**What**: Quick action buttons for common tasks

```javascript
// Dashboard.jsx - Add to Quick Actions section
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <button onClick={() => setShowPrintDialog(true)}>
    🖨️ Print Latest Requisition
  </button>
  <button onClick={() => setShowReportsDialog(true)}>
    📊 View Reports
  </button>
  <button onClick={() => setShowExportDialog(true)}>
    📥 Export Data
  </button>
  <button onClick={() => navigate('/requisitions/create')}>
    ➕ New Requisition
  </button>
</div>
```

---

## Comparison: Current vs Proposed

| Feature | Current | Proposed Dialog |
|---------|---------|-----------------|
| **Navigation** | Changes page | Stays in place |
| **Context** | Lost | Preserved |
| **Speed** | Slow (page load) | Fast (instant) |
| **Preview** | New window | In-app modal |
| **Multi-task** | No | Yes |
| **PDF Generation** | Manual "Save as PDF" | One-click download |
| **Responsive** | Separate page | Adaptive modal |
| **UX** | Traditional | Modern |

---

## Implementation Priority

### Phase 1: Requisition Print Dialog (High Priority)
**Why First**:
- Most commonly used feature
- Biggest UX improvement
- Solves popup blocker issues
- Quick win

**Time**: 2-3 hours

**Files to Create**:
- `client/src/components/dialogs/RequisitionPrintDialog.jsx`
- `client/src/hooks/usePrintDialog.js`

**Files to Update**:
- `client/src/pages/requisitions/RequisitionDetail.jsx`

### Phase 2: Reports Dialog (Medium Priority)
**Why Second**:
- Less frequently used than print
- More complex (multiple report types)
- Requires chart library

**Time**: 4-5 hours

**Files to Create**:
- `client/src/components/dialogs/ReportsQuickViewDialog.jsx`
- `client/src/components/reports/ReportChart.jsx`

**Files to Update**:
- `client/src/components/layout/MainLayout.jsx` (add Reports icon)

### Phase 3: Dashboard Integration (Low Priority)
**Why Last**:
- Enhancement, not fix
- Depends on Phase 1 & 2

**Time**: 1 hour

---

## Technical Requirements

### Dependencies to Install

```bash
# For PDF generation
npm install jspdf html2canvas

# OR use React-PDF (alternative)
npm install @react-pdf/renderer

# For charts (if doing reports)
npm install recharts
```

### Dialog Component Library

Option 1: **Headless UI** (Recommended)
```bash
npm install @headlessui/react
```

Option 2: **Radix UI** (Alternative)
```bash
npm install @radix-ui/react-dialog
```

Option 3: **Build Custom** (Simplest for your use case)
- Use existing Tailwind classes
- Portal to body for overlay
- Focus trap for accessibility

---

## Example Code Snippet

### Custom Dialog Component (No dependencies)

```javascript
// components/ui/Dialog.jsx
export function Dialog({ isOpen, onClose, title, children }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold">{title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
```

### Usage in RequisitionDetail

```javascript
// RequisitionDetail.jsx
import { useState } from 'react'
import { Dialog } from '../../components/ui/Dialog'
import { generatePrintableHTML } from '../../utils/requisitionExport'

function RequisitionDetail() {
  const [showPrintDialog, setShowPrintDialog] = useState(false)

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPDF = async () => {
    const element = document.getElementById('print-preview')
    const canvas = await html2canvas(element)
    const imgData = canvas.toDataURL('image/png')

    const pdf = new jsPDF()
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297)
    pdf.save(`requisition_${requisition.requisition_number}.pdf`)
  }

  return (
    <>
      {/* Existing UI */}
      <button onClick={() => setShowPrintDialog(true)}>
        Preview & Print
      </button>

      {/* Print Dialog */}
      <Dialog
        isOpen={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        title="Requisition Preview"
      >
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button onClick={handlePrint}>🖨️ Print</button>
            <button onClick={handleDownloadPDF}>📄 Download PDF</button>
            <button onClick={() => exportRequisitionToCSV(requisition)}>📊 Export CSV</button>
          </div>

          {/* Preview */}
          <div
            id="print-preview"
            dangerouslySetInnerHTML={{
              __html: generatePrintableHTML(requisition, organizationName)
            }}
          />
        </div>
      </Dialog>
    </>
  )
}
```

---

## Recommended Approach

**Start with Phase 1**: Requisition Print Dialog

**Why**:
1. Biggest impact for users
2. Solves immediate popup blocker issues
3. Most commonly used feature
4. Quick to implement (2-3 hours)
5. Sets pattern for future dialogs

**Then**: Add Reports Dialog (Phase 2) if feedback is positive

---

## Questions for You

1. **Which would you like first?**
   - A) Requisition Print Dialog (recommended)
   - B) Reports Dialog
   - C) Both simultaneously

2. **PDF Library preference?**
   - A) jsPDF + html2canvas (simple, works with existing HTML)
   - B) @react-pdf/renderer (more control, React components)
   - C) Server-side PDF generation (better quality, slower)

3. **Dialog style preference?**
   - A) Custom Tailwind dialog (no dependencies)
   - B) Headless UI (accessible, more features)
   - C) Keep as-is (new window)

4. **Reports preference?**
   - A) Keep /reports page, add dialog for quick view
   - B) Replace page entirely with dialog
   - C) Keep page, remove from navigation (dialog-only access)

---

## Next Steps

Once you decide, I can immediately implement:

1. ✅ Create Dialog component
2. ✅ Build Requisition Print Dialog
3. ✅ Add PDF download capability
4. ✅ Update RequisitionDetail page
5. ✅ Test and refine
6. ✅ Commit changes

**Estimated time**: 2-3 hours for Phase 1 (Requisition Print Dialog)
