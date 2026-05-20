import os
import pandas as pd
import streamlit as st
from datetime import datetime
import database
import pdf_extractor
import report_generator

# Page configuration
st.set_page_config(
    page_title="PDF Markup Extractor & Issue Tracker",
    page_icon="📋",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Premium Theme Styling
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    
    /* Apply custom font */
    html, body, [class*="css"], .stApp {
        font-family: 'Outfit', sans-serif;
    }
    
    /* Custom metric card */
    div[data-testid="stMetric"] {
        background-color: var(--secondary-background-color);
        border: 1px solid var(--border-color);
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
        transition: all 0.3s ease;
    }
    div[data-testid="stMetric"]:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.08);
        border-color: var(--primary-color);
    }
    
    /* Headings styling */
    h1 {
        font-weight: 700;
        letter-spacing: -0.5px;
    }
    h2, h3 {
        font-weight: 600;
        letter-spacing: -0.2px;
    }
    
    /* Sidebar header styling */
    .sidebar-title {
        font-size: 1.2rem;
        font-weight: 700;
        margin-bottom: 1rem;
        color: var(--primary-color);
    }
</style>
""", unsafe_allow_html=True)

# ----------------- INITIALIZATION -----------------
# Ensure folders exist
for folder in ["uploads", "exports", "data"]:
    os.makedirs(folder, exist_ok=True)

# Initialize database
database.init_db()

# Check for success messages from session state
if "save_message" in st.session_state:
    st.success(st.session_state["save_message"])
    del st.session_state["save_message"]

# ----------------- SIDEBAR -----------------
st.sidebar.markdown("<div class='sidebar-title'>📋 Control Panel</div>", unsafe_allow_html=True)

# File Uploader
uploaded_file = st.sidebar.file_uploader(
    "Upload Reviewed PDF", 
    type=["pdf"],
    help="Upload a PDF file with comments, markups, or annotations."
)

# File details and Action Button
if uploaded_file is not None:
    # Save the file to uploads/
    uploaded_path = os.path.join("uploads", uploaded_file.name)
    with open(uploaded_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
        
    st.sidebar.markdown(f"""
    **File Details:**
    - 📁 Name: `{uploaded_file.name}`
    - ⚖️ Size: `{round(uploaded_file.size / 1024, 2)} KB`
    """)
    
    if st.sidebar.button("🔍 Extract Markups", type="primary", use_container_width=True):
        with st.spinner("Analyzing PDF and extracting annotations..."):
            try:
                markups = pdf_extractor.extract_annotations(uploaded_path, uploaded_file.name)
                if markups:
                    database.insert_markups(markups)
                    # Check if PDF might have text under markups or is scanned
                    is_scanned = True
                    try:
                        import fitz
                        doc = fitz.open(uploaded_path)
                        for page in doc:
                            if page.get_text("text").strip():
                                is_scanned = False
                                break
                        doc.close()
                    except Exception:
                        is_scanned = False
                    
                    msg = f"✅ Successfully extracted and saved {len(markups)} markup(s)!"
                    if is_scanned:
                        msg += "\n\n⚠️ Note: The document contains images/scans. Highlighted text could not be extracted automatically."
                    
                    st.session_state["save_message"] = msg
                    st.rerun()
                else:
                    # Check if pdf is scanned/image-based
                    is_scanned = True
                    try:
                        import fitz
                        doc = fitz.open(uploaded_path)
                        for page in doc:
                            if page.get_text("text").strip():
                                is_scanned = False
                                break
                        doc.close()
                    except Exception:
                        is_scanned = False
                    
                    if is_scanned:
                        st.sidebar.warning(
                            "This PDF may be scanned or image-based. Automatic annotation extraction may not work. Manual validation may be required."
                        )
                    else:
                        st.sidebar.info("No PDF annotations or markups found in this file.")
            except Exception as e:
                st.sidebar.error(f"Error extracting annotations: {str(e)}")

st.sidebar.markdown("---")

# Navigation & Views
st.sidebar.markdown("**View Actions**")
if st.sidebar.button("👁️ View All / Reset Filters", use_container_width=True):
    for key in ["filter_pdf", "filter_status", "filter_priority", "filter_assignee", "filter_type"]:
        if key in st.session_state:
            st.session_state[key] = []
    st.rerun()

# Database Clearing
st.sidebar.markdown("**System Actions**")
if st.sidebar.button("🗑️ Clear Database", use_container_width=True):
    database.clear_all_data()
    st.session_state["save_message"] = "🗑️ All database records have been deleted successfully."
    st.rerun()

# ----------------- MAIN PAGE -----------------
st.title("📋 PDF Markup Extractor & Issue Tracker")
st.markdown("Automate tracking of drawing reviews, client comments, and markup annotations. View details, assign tasks, and track status.")

# Fetch all issues from DB
all_records = database.fetch_markups()

if not all_records:
    # Empty state UI
    st.markdown("---")
    st.info("👋 Welcome! There is no data in the system yet. Please upload a PDF file containing annotations in the sidebar control panel and click **Extract Markups** to get started.")
    
    # Showcase standard PDF markup types
    st.markdown("### Supported Annotation Types")
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.markdown("💡 **Text Notes & FreeText**\nSticky notes, popup boxes, text overlays.")
    with col2:
        st.markdown("🖍️ **Highlights & Ink**\nColored highlights, hand-drawn circles/sketches.")
    with col3:
        st.markdown("📐 **Drawings (Square/Circle)**\nReview markups outlining specific zones.")
    with col4:
        st.markdown("⚡ **Lines, Arrows & Stamps**\nArrows pointing to errors, approved stamps.")
else:
    # ----------------- DASHBOARD METRICS -----------------
    # Compute counts
    total_issues = len(all_records)
    pending_issues = sum(1 for r in all_records if r["status"] == "Pending")
    progress_issues = sum(1 for r in all_records if r["status"] == "In Progress")
    resolved_issues = sum(1 for r in all_records if r["status"] == "Resolved")
    closed_issues = sum(1 for r in all_records if r["status"] == "Closed")
    critical_issues = sum(1 for r in all_records if r["priority"] == "Critical")
    
    st.markdown("---")
    
    # 6 columns for dashboard metrics
    m1, m2, m3, m4, m5, m6 = st.columns(6)
    m1.metric("Total Issues", total_issues)
    m2.metric("Pending", pending_issues)
    m3.metric("In Progress", progress_issues)
    m4.metric("Resolved", resolved_issues)
    m5.metric("Closed", closed_issues)
    m6.metric("Critical Priority", critical_issues)
    
    # ----------------- FILTERS SECTION -----------------
    st.markdown("### 🔍 Filters")
    
    # Fetch unique list of values for filters from db
    pdf_options = database.get_unique_values("pdf_name")
    status_options = ["Pending", "In Progress", "Resolved", "Closed", "Rejected"]
    priority_options = ["Low", "Medium", "High", "Critical"]
    assignee_options = ["Unassigned", "Admin", "Design Team", "Site Engineer", "Documentation Team", "Client Coordinator", "Developer"]
    type_options = database.get_unique_values("annotation_type")
    
    # Layout filters in columns
    f1, f2, f3 = st.columns(3)
    with f1:
        filter_pdf = st.multiselect("PDF File Name", options=pdf_options, key="filter_pdf")
        filter_type = st.multiselect("Markup Type", options=type_options, key="filter_type")
    with f2:
        filter_status = st.multiselect("Status", options=status_options, key="filter_status")
        filter_priority = st.multiselect("Priority", options=priority_options, key="filter_priority")
    with f3:
        filter_assignee = st.multiselect("Assigned To", options=assignee_options, key="filter_assignee")
        
    # Construct filters dict
    filters = {}
    if filter_pdf:
        filters["pdf_name"] = filter_pdf
    if filter_status:
        filters["status"] = filter_status
    if filter_priority:
        filters["priority"] = filter_priority
    if filter_assignee:
        filters["assigned_to"] = filter_assignee
    if filter_type:
        filters["annotation_type"] = filter_type
        
    # Fetch filtered data
    filtered_records = database.fetch_markups(filters)
    
    # ----------------- ISSUE TABLE -----------------
    st.markdown("### 📋 Interactive Issue List")
    st.caption("💡 Select dropdowns directly in the table to assign tasks, set priority, update status, and add remarks. Changes save automatically.")
    
    if filtered_records:
        df = pd.DataFrame(filtered_records)
        
        # Ensure correct column order and columns
        column_order = [
            "id", "pdf_name", "page_number", "annotation_type", "comment_text", 
            "author", "assigned_to", "priority", "status", "remarks"
        ]
        
        # Display editor
        column_config = {
            "id": st.column_config.NumberColumn("ID", disabled=True, width="small"),
            "pdf_name": st.column_config.TextColumn("PDF Name", disabled=True, width="medium"),
            "page_number": st.column_config.NumberColumn("Page", disabled=True, width="small"),
            "annotation_type": st.column_config.TextColumn("Type", disabled=True, width="small"),
            "comment_text": st.column_config.TextColumn("Comment Content", disabled=True, width="large"),
            "author": st.column_config.TextColumn("Author", disabled=True, width="medium"),
            "assigned_to": st.column_config.SelectboxColumn(
                "Assigned To",
                options=assignee_options,
                required=True,
                width="medium"
            ),
            "priority": st.column_config.SelectboxColumn(
                "Priority",
                options=priority_options,
                required=True,
                width="small"
            ),
            "status": st.column_config.SelectboxColumn(
                "Status",
                options=status_options,
                required=True,
                width="medium"
            ),
            "remarks": st.column_config.TextColumn("Remarks", width="medium")
        }
        
        # Render the data editor
        edited_df = st.data_editor(
            df[column_order],
            column_config=column_config,
            hide_index=True,
            width="stretch",
            key="issue_table_editor"
        )
        
        # Handle edits and sync back to SQLite
        if "issue_table_editor" in st.session_state:
            edits = st.session_state["issue_table_editor"].get("edited_rows", {})
            if edits:
                for row_idx_str, row_changes in edits.items():
                    row_idx = int(row_idx_str)
                    record_id = df.iloc[row_idx]["id"]
                    database.update_markup(record_id, row_changes)
                st.session_state["save_message"] = "💾 Changes auto-saved successfully!"
                st.rerun()
                
        # ----------------- SIDEBAR EXPORTS -----------------
        st.sidebar.markdown("<div class='sidebar-title'>📥 Export Reports</div>", unsafe_allow_html=True)
        
        # Generate export filenames
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_filename = f"PDF_Markups_Report_{timestamp}.csv"
        excel_filename = f"PDF_Markups_Report_{timestamp}.xlsx"
        
        # Full paths inside exports/ folder
        csv_path = os.path.join("exports", csv_filename)
        excel_path = os.path.join("exports", excel_filename)
        
        # Prepare datasets
        export_columns = [
            "pdf_name", "page_number", "annotation_type", "comment_text", 
            "author", "assigned_to", "priority", "status", "remarks", 
            "created_date", "modified_date"
        ]
        
        df_filtered_export = df[export_columns].rename(columns={
            "pdf_name": "PDF Name",
            "page_number": "Page Number",
            "annotation_type": "Annotation Type",
            "comment_text": "Comment Text",
            "author": "Author",
            "assigned_to": "Assigned To",
            "priority": "Priority",
            "status": "Status",
            "remarks": "Remarks",
            "created_date": "Created Date",
            "modified_date": "Modified Date"
        })
        
        df_all_export = pd.DataFrame(all_records)[export_columns].rename(columns={
            "pdf_name": "PDF Name",
            "page_number": "Page Number",
            "annotation_type": "Annotation Type",
            "comment_text": "Comment Text",
            "author": "Author",
            "assigned_to": "Assigned To",
            "priority": "Priority",
            "status": "Status",
            "remarks": "Remarks",
            "created_date": "Created Date",
            "modified_date": "Modified Date"
        })
        
        # Export Filtered
        st.sidebar.markdown("**Current Filtered Set**")
        
        # CSV Export Filtered
        report_generator.export_to_csv(df_filtered_export, csv_path)
        with open(csv_path, "rb") as f:
            st.sidebar.download_button(
                label="CSV - Filtered",
                data=f.read(),
                file_name=csv_filename,
                mime="text/csv",
                use_container_width=True
            )
            
        # Excel Export Filtered
        report_generator.export_to_excel(df_filtered_export, excel_path)
        with open(excel_path, "rb") as f:
            st.sidebar.download_button(
                label="Excel (Styled) - Filtered",
                data=f.read(),
                file_name=excel_filename,
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True
            )
            
        # Export All
        st.sidebar.markdown("**Full Database Set**")
        
        # CSV Export All
        all_csv_path = os.path.join("exports", f"PDF_Markups_All_{timestamp}.csv")
        report_generator.export_to_csv(df_all_export, all_csv_path)
        with open(all_csv_path, "rb") as f:
            st.sidebar.download_button(
                label="CSV - All Data",
                data=f.read(),
                file_name=f"PDF_Markups_All_{timestamp}.csv",
                mime="text/csv",
                use_container_width=True
            )
            
        # Excel Export All
        all_excel_path = os.path.join("exports", f"PDF_Markups_All_{timestamp}.xlsx")
        report_generator.export_to_excel(df_all_export, all_excel_path)
        with open(all_excel_path, "rb") as f:
            st.sidebar.download_button(
                label="Excel (Styled) - All Data",
                data=f.read(),
                file_name=f"PDF_Markups_All_{timestamp}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True
            )

        # ----------------- DETAILED INSPECTOR -----------------
        st.markdown("---")
        st.markdown("### 🔍 Detailed Issue Inspector")
        st.caption("Select an issue ID below to view full details including coordinates and underlying text context.")
        
        inspector_id = st.selectbox(
            "Select Issue ID for Detailed Inspection",
            options=["None"] + list(df["id"].values),
            format_func=lambda x: f"Issue #{x}" if x != "None" else "Choose an issue ID..."
        )
        
        if inspector_id != "None":
            # Retrieve the specific record (contains coordinates, selected_text, etc. which are not in the main table columns)
            record = next(r for r in all_records if r["id"] == inspector_id)
            
            c1, c2 = st.columns(2)
            with c1:
                st.markdown(f"""
                **Issue Details:**
                - 📂 **PDF Name:** `{record['pdf_name']}`
                - 📄 **Page Number:** `{record['page_number']}`
                - 🏷️ **Annotation Type:** `{record['annotation_type']}`
                - ✍️ **Author:** `{record['author']}`
                - ⏰ **Created Date:** `{record['created_date']}`
                - ⏰ **Modified Date:** `{record['modified_date']}`
                """)
            with c2:
                st.markdown(f"""
                **Location & Text Content:**
                - 📐 **Coordinates:** `{record['rectangle_coordinates'] or 'N/A'}`
                - 🖊️ **Highlighted / Selected Text:**
                """)
                if record['selected_text']:
                    st.info(f"\"{record['selected_text']}\"")
                else:
                    st.text("No underlying text selected (annotation is not text-based).")
                    
                st.markdown(f"""
                - 💬 **Comment Text:**
                """)
                st.warning(record['comment_text'])
                
    else:
        st.warning("⚠️ No issues match the selected filters. Click 'Reset Filters' in the sidebar or change your selections.")
