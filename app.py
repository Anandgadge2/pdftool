import os
import pandas as pd
import streamlit as st
from datetime import datetime
import database
import pdf_extractor
import report_generator

st.set_page_config(page_title="PDF Markup Extractor & Issue Tracker", page_icon="📋", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    html, body, [class*="css"], .stApp { font-family: 'Inter', sans-serif; scroll-behavior: smooth; }
    :root { color-scheme: light; }
    .stApp { background: linear-gradient(180deg, #f8fafc 0%, #ffffff 40%); }
    div[data-testid="stMetric"] { background:#fff; border:1px solid #e2e8f0; padding:12px 16px; border-radius:12px; }
    .section-card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:12px; }
    .stApp > header { visibility:hidden; }
</style>
""", unsafe_allow_html=True)

for folder in ["uploads", "exports", "data"]:
    os.makedirs(folder, exist_ok=True)
database.init_db()

if "save_message" in st.session_state:
    st.success(st.session_state.pop("save_message"))

st.sidebar.markdown("### 📋 Control Panel")
uploaded_file = st.sidebar.file_uploader("Upload Reviewed PDF", type=["pdf"])

if uploaded_file is not None:
    uploaded_path = os.path.join("uploads", uploaded_file.name)
    with open(uploaded_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
    st.sidebar.caption(f"**File:** {uploaded_file.name}  \\n**Size:** {round(uploaded_file.size/1024,2)} KB")
    if st.sidebar.button("🔍 Extract Markups", type="primary", use_container_width=True):
        with st.spinner("Analyzing PDF and extracting annotations..."):
            try:
                markups = pdf_extractor.extract_annotations(uploaded_path, uploaded_file.name)
                if markups:
                    database.insert_markups(markups)
                    st.session_state["save_message"] = f"✅ Successfully extracted and saved {len(markups)} markup(s)!"
                    st.rerun()
                st.sidebar.info("No PDF annotations or markups found in this file.")
            except Exception as e:
                st.sidebar.error(f"Error extracting annotations: {e}")

st.sidebar.markdown("---")
if st.sidebar.button("👁️ View All / Reset Filters", use_container_width=True):
    for key in ["filter_pdf", "filter_status", "filter_priority", "filter_assignee", "filter_type", "search_term"]:
        st.session_state.pop(key, None)
    st.rerun()

confirm_clear = st.sidebar.checkbox("I understand this will permanently delete all records", value=False)
if st.sidebar.button("🗑️ Clear Database", use_container_width=True):
    if confirm_clear:
        database.clear_all_data()
        st.session_state["save_message"] = "🗑️ All records have been deleted successfully."
        st.rerun()
    else:
        st.sidebar.warning("Please check the confirmation box before clearing data.")

st.title("📋 PDF Markup Extractor & Issue Tracker")
st.caption("Mobile-friendly issue tracking for PDF annotations.")

status_options = ["Pending", "In Progress", "Resolved", "Closed", "Rejected"]
priority_options = ["Low", "Medium", "High", "Critical"]
assignee_options = ["Unassigned", "Admin", "Design Team", "Site Engineer", "Documentation Team", "Client Coordinator", "Developer"]

if database.count_markups() == 0:
    st.info("No records available yet. Upload a PDF with annotations to get started.")
else:
    st.markdown("### 🔍 Filters")
    c1, c2, c3 = st.columns([1,1,1])
    with c1:
        filter_pdf = st.multiselect("PDF File Name", options=database.get_unique_values("pdf_name"), key="filter_pdf")
        filter_type = st.multiselect("Markup Type", options=database.get_unique_values("annotation_type"), key="filter_type")
    with c2:
        filter_status = st.multiselect("Status", options=status_options, key="filter_status")
        filter_priority = st.multiselect("Priority", options=priority_options, key="filter_priority")
    with c3:
        filter_assignee = st.multiselect("Assigned To", options=assignee_options, key="filter_assignee")
        search_term = st.text_input("Search", placeholder="Comment, PDF, author...", key="search_term")

    filters = {}
    if filter_pdf: filters["pdf_name"] = filter_pdf
    if filter_status: filters["status"] = filter_status
    if filter_priority: filters["priority"] = filter_priority
    if filter_assignee: filters["assigned_to"] = filter_assignee
    if filter_type: filters["annotation_type"] = filter_type

    total_issues = database.count_markups(filters, search_term)
    m1,m2,m3,m4 = st.columns(4)
    m1.metric("Total", total_issues)
    m2.metric("Pending", database.count_markups({**filters, "status": ["Pending"]}, search_term))
    m3.metric("In Progress", database.count_markups({**filters, "status": ["In Progress"]}, search_term))
    m4.metric("Resolved", database.count_markups({**filters, "status": ["Resolved"]}, search_term))

    st.markdown("### 📋 Interactive Issue List")
    p1,p2,p3 = st.columns([1,1,2])
    with p1:
        per_page = st.selectbox("Rows per page", options=[10,25,50,100], index=1)
    with p2:
        page = st.number_input("Page", min_value=1, max_value=max(1, (total_issues + per_page - 1)//per_page), value=1, step=1)
    with p3:
        sort_by = st.selectbox("Sort by", options=["id","page_number","status","priority","pdf_name","annotation_type"], index=0)
        sort_dir = st.radio("Order", ["DESC","ASC"], horizontal=True)

    rows = database.fetch_markups_paginated(filters=filters, search=search_term, limit=per_page, offset=(page-1)*per_page, sort_by=sort_by, sort_dir=sort_dir)

    if rows:
        df = pd.DataFrame(rows)
        df.insert(0, "sr_no", range((page-1)*per_page + 1, (page-1)*per_page + len(df) + 1))
        column_order = ["sr_no","id","pdf_name","page_number","annotation_type","comment_text","author","assigned_to","priority","status","remarks"]
        edited_df = st.data_editor(
            df[column_order],
            hide_index=True,
            width="stretch",
            column_config={"sr_no": st.column_config.NumberColumn("Sr. No.", disabled=True), "id": st.column_config.NumberColumn("ID", disabled=True)},
            key="issue_table_editor"
        )
        edits = st.session_state.get("issue_table_editor", {}).get("edited_rows", {})
        if edits:
            for row_idx_str, row_changes in edits.items():
                row_idx = int(row_idx_str)
                record_id = df.iloc[row_idx]["id"]
                database.update_markup(record_id, row_changes)
            st.session_state["save_message"] = "💾 Changes auto-saved successfully!"
            st.rerun()

        export_columns = ["pdf_name", "page_number", "annotation_type", "comment_text", "author", "assigned_to", "priority", "status", "remarks", "created_date", "modified_date"]
        df_export = pd.DataFrame(rows)[export_columns]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_path = os.path.join("exports", f"PDF_Markups_Page_{timestamp}.csv")
        report_generator.export_to_csv(df_export, csv_path)
        with open(csv_path, "rb") as f:
            st.sidebar.download_button("CSV - Current Page", f.read(), file_name=os.path.basename(csv_path), mime="text/csv", use_container_width=True)
    else:
        st.warning("No data found for current filters/search.")
