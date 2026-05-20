# 📋 PDF Markup Extractor & Issue Tracker - User Guide

Welcome to the **PDF Markup Extractor & Issue Tracker**. This tool automates the process of extracting review comments, drawing markups, highlights, and annotations from PDF documents and converts them into a centralized, interactive issue tracker.

---

## 🚀 1. Setup and Installation

### Prerequisites
- You must have Python installed (Python 3.8 or newer recommended).

### Installation Steps
1. Open your terminal or command prompt and navigate to the project folder.
2. Install the required dependencies by running:
   ```bash
   pip install -r requirements.txt
   ```

### Starting the Application
To start the application, run the following command in your terminal:
```bash
python -m streamlit run app.py
```
This will start a local server and automatically open the application in your default web browser at `http://localhost:8501`.

---

## 📖 2. Step-by-Step Usage Guide

### Step 1: Uploading a Reviewed PDF
1. Look at the **Control Panel** sidebar on the left side of the screen.
2. Click the **"Browse files"** button under **Upload Reviewed PDF**.
3. Select a PDF document from your computer that contains annotations (e.g., highlights, sticky notes, or drawn shapes).
4. Once uploaded, the file details (name and size) will appear in the sidebar.

### Step 2: Extracting Markups
1. After the PDF is uploaded, click the blue **🔍 Extract Markups** button in the sidebar.
2. The tool will scan every page of the PDF and extract all annotations.
3. A success message will appear confirming how many markups were found and saved to the local database.
> **Note:** If the PDF is a scanned image, the tool will warn you that underlying highlighted text cannot be automatically extracted, though the markup coordinates and comments will still be recorded.

### Step 3: Viewing the Dashboard
Once data is extracted, the main page will populate:
- **Dashboard Metrics**: At the top, you will see a quick summary of your project's health, including the total number of issues and counts for *Pending*, *In Progress*, *Resolved*, *Closed*, and *Critical Priority* items.

### Step 4: Using the Interactive Issue List
The core of the tool is the **Interactive Issue List** table.
- **Editing**: This table is fully interactive. You can click directly on the cells in the **Assigned To**, **Priority**, **Status**, and **Remarks** columns to change their values.
- **Auto-Save**: Any change you make in the table is **instantly saved** to the database in the background. You do not need to click a "Save" button.
- **Sorting**: Click on any column header (like *Page Number* or *Priority*) to sort the table.

### Step 5: Filtering Data
Above the table, you will find the **🔍 Filters** section.
- You can use the dropdown menus to filter the visible issues by **PDF File Name**, **Markup Type**, **Status**, **Priority**, or **Assigned To**.
- To reset all filters and see all data again, click the **👁️ View All / Reset Filters** button in the left sidebar.

### Step 6: Detailed Issue Inspector
For complex markups, the main table might not show enough detail.
1. Scroll down to the **🔍 Detailed Issue Inspector** section below the main table.
2. Use the dropdown to select specific **Issue ID**.
3. A detailed view will appear showing:
   - The exact **Coordinates** of the markup on the PDF page.
   - The **Highlighted / Selected Text** (the actual text from the PDF that was highlighted or struck through).
   - The full **Comment Text** left by the reviewer.

### Step 7: Generating Reports
You can export your data to share with your team or clients.
1. Go to the **📥 Export Reports** section at the bottom of the left sidebar.
2. You can choose to export either the **Current Filtered Set** (what you currently see in the table) or the **Full Database Set**.
3. Click the **CSV** button for raw data, or the **Excel (Styled)** button for a premium, color-coded spreadsheet that highlights statuses and priorities.
4. The downloaded reports will also be saved automatically in the `exports/` folder of the project directory.

### Step 8: Clearing Data
If you want to start fresh with a new project:
- Click the **🗑️ Clear Database** button in the sidebar. This will permanently delete all extracted records from the local SQLite database.

---

## 🎯 Supported Annotation Types
The tool recognizes and extracts a wide variety of PDF markup types, including:
- **Text & FreeText**: Sticky notes, popup comments, and text boxes.
- **Highlight, Underline, StrikeOut**: Text-based markups (the tool will extract the text beneath them).
- **Ink & Line**: Freehand drawings and straight lines (e.g., crossing out a section).
- **Square & Circle**: Rectangles and ellipses drawn around specific areas on the page.
- **Stamp**: Digital approval or review stamps.
