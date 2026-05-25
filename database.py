import os
import sqlite3
from datetime import datetime

DEFAULT_DB_PATH = os.path.join("data", "markups.db")

def get_connection(db_path=DEFAULT_DB_PATH):
    """
    Establishes a connection to the SQLite database.
    Ensures that the directory structure exists before connecting.
    """
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    return sqlite3.connect(db_path)

def init_db(db_path=DEFAULT_DB_PATH):
    """
    Initializes the database and creates the markups table if it does not exist.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS markups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pdf_name TEXT,
            page_number INTEGER,
            annotation_type TEXT,
            comment_text TEXT,
            author TEXT,
            created_date TEXT,
            modified_date TEXT,
            rectangle_coordinates TEXT,
            selected_text TEXT,
            assigned_to TEXT DEFAULT 'Unassigned',
            priority TEXT DEFAULT 'Medium',
            status TEXT DEFAULT 'Pending',
            remarks TEXT DEFAULT '',
            created_at TEXT
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_markups_status ON markups(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_markups_priority ON markups(priority)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_markups_pdf_name ON markups(pdf_name)")
    conn.commit()
    conn.close()

def insert_markups(markups_list, db_path=DEFAULT_DB_PATH):
    """
    Inserts a list of markup dictionaries into the database.
    Each dictionary should contain key-value pairs matching the table columns.
    """
    if not markups_list:
        return
    
    init_db(db_path)  # Ensure table exists
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    now_str = datetime.now().isoformat()
    
    insert_query = """
        INSERT INTO markups (
            pdf_name, page_number, annotation_type, comment_text, author, 
            created_date, modified_date, rectangle_coordinates, selected_text, 
            assigned_to, priority, status, remarks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    rows_to_insert = []
    for item in markups_list:
        rows_to_insert.append((
            item.get("pdf_name"),
            item.get("page_number"),
            item.get("annotation_type", "Unknown"),
            item.get("comment_text", ""),
            item.get("author", ""),
            item.get("created_date", ""),
            item.get("modified_date", ""),
            item.get("rectangle_coordinates", ""),
            item.get("selected_text", ""),
            item.get("assigned_to", "Unassigned"),
            item.get("priority", "Medium"),
            item.get("status", "Pending"),
            item.get("remarks", ""),
            now_str
        ))
        
    cursor.executemany(insert_query, rows_to_insert)
    conn.commit()
    conn.close()

def fetch_markups(filters=None, db_path=DEFAULT_DB_PATH):
    """
    Fetches all markups matching optional filters.
    filters: dictionary of column name to filter value (or list of values).
    Returns list of dicts.
    """
    init_db(db_path)
    conn = get_connection(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    query = "SELECT * FROM markups"
    params = []
    
    if filters:
        filter_clauses = []
        for col, val in filters.items():
            if val is None or val == "" or val == []:
                continue
            if isinstance(val, list):
                placeholders = ",".join(["?"] * len(val))
                filter_clauses.append(f"{col} IN ({placeholders})")
                params.extend(val)
            else:
                filter_clauses.append(f"{col} = ?")
                params.append(val)
        
        if filter_clauses:
            query += " WHERE " + " AND ".join(filter_clauses)
            
    query += " ORDER BY id DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    result = [dict(row) for row in rows]
    conn.close()
    return result

def update_markup(markup_id, updates_dict, db_path=DEFAULT_DB_PATH):
    """
    Updates specific fields for a single markup ID.
    updates_dict: dictionary of {column_name: new_value}
    """
    if not updates_dict:
        return
        
    init_db(db_path)
    # Validate columns that can be updated to prevent injection
    allowed_cols = {"assigned_to", "priority", "status", "remarks"}
    set_clauses = []
    params = []
    
    for col, val in updates_dict.items():
        if col in allowed_cols:
            set_clauses.append(f"{col} = ?")
            params.append(val)
            
    if not set_clauses:
        return
        
    params.append(markup_id)
    query = f"UPDATE markups SET {', '.join(set_clauses)} WHERE id = ?"
    
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute(query, params)
    conn.commit()
    conn.close()

def delete_markup(markup_id, db_path=DEFAULT_DB_PATH):
    """
    Deletes a markup record by ID.
    """
    init_db(db_path)
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM markups WHERE id = ?", (markup_id,))
    conn.commit()
    conn.close()

def clear_all_data(db_path=DEFAULT_DB_PATH):
    """
    Clears all markup records from the database.
    """
    init_db(db_path)
    conn = get_connection(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM markups")
    conn.commit()
    conn.close()

def get_unique_values(column_name, db_path=DEFAULT_DB_PATH):
    """
    Helper function to get distinct non-null values for a column.
    Useful for building filters in the UI.
    """
    init_db(db_path)
    conn = get_connection(db_path)
    cursor = conn.cursor()
    
    # Secure string formatting as column name is hardcoded in call sites
    allowed_columns = {"pdf_name", "annotation_type", "assigned_to", "priority", "status", "author"}
    if column_name not in allowed_columns:
        conn.close()
        raise ValueError(f"Invalid column name: {column_name}")
        
    cursor.execute(f"SELECT DISTINCT {column_name} FROM markups WHERE {column_name} IS NOT NULL AND {column_name} != '' ORDER BY {column_name}")
    rows = cursor.fetchall()
    conn.close()
    
    return [row[0] for row in rows]


def _build_filter_query(filters=None, search=None):
    query = " FROM markups"
    params = []
    clauses = []
    if filters:
        for col, val in filters.items():
            if val in (None, "", []):
                continue
            if isinstance(val, list):
                placeholders = ",".join(["?"] * len(val))
                clauses.append(f"{col} IN ({placeholders})")
                params.extend(val)
            else:
                clauses.append(f"{col} = ?")
                params.append(val)
    if search:
        clauses.append("(pdf_name LIKE ? OR comment_text LIKE ? OR author LIKE ? OR annotation_type LIKE ?)")
        pattern = f"%{search.strip()}%"
        params.extend([pattern, pattern, pattern, pattern])
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    return query, params

def count_markups(filters=None, search=None, db_path=DEFAULT_DB_PATH):
    init_db(db_path)
    conn = get_connection(db_path)
    cursor = conn.cursor()
    q, params = _build_filter_query(filters, search)
    cursor.execute("SELECT COUNT(*)" + q, params)
    total = cursor.fetchone()[0]
    conn.close()
    return total

def fetch_markups_paginated(filters=None, search=None, limit=25, offset=0, sort_by="id", sort_dir="DESC", db_path=DEFAULT_DB_PATH):
    init_db(db_path)
    conn = get_connection(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    allowed_sort = {"id", "page_number", "status", "priority", "pdf_name", "annotation_type"}
    safe_sort = sort_by if sort_by in allowed_sort else "id"
    safe_dir = "ASC" if str(sort_dir).upper() == "ASC" else "DESC"
    q, params = _build_filter_query(filters, search)
    query = f"SELECT *{q} ORDER BY {safe_sort} {safe_dir} LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
