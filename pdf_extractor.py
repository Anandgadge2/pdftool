import os
import fitz
from datetime import datetime

def parse_pdf_date(date_str):
    """
    Parses a PDF date string (e.g. 'D:20260520220137Z' or 'D:20260520220137+05\'30\'')
    into a clean, human-readable format: YYYY-MM-DD HH:MM:SS.
    """
    if not date_str:
        return ""
    
    clean_date = date_str
    if clean_date.startswith("D:"):
        clean_date = clean_date[2:]
        
    # Replace single quotes in timezone offset (e.g. +05'30' -> +0530)
    clean_date = clean_date.replace("'", "")
    
    try:
        if len(clean_date) >= 14:
            year = clean_date[0:4]
            month = clean_date[4:6]
            day = clean_date[6:8]
            hour = clean_date[8:10]
            minute = clean_date[10:12]
            second = clean_date[12:14]
            
            tz = ""
            if len(clean_date) > 14:
                # e.g., +0530 or -0800 or Z
                tz_part = clean_date[14:]
                if tz_part == "Z":
                    tz = " UTC"
                else:
                    # format offset as e.g., +05:30
                    if len(tz_part) >= 5 and (tz_part[0] in ('+', '-')):
                        tz = f" (GMT{tz_part[0:3]}:{tz_part[3:5]})"
                    else:
                        tz = f" ({tz_part})"
            return f"{year}-{month}-{day} {hour}:{minute}:{second}{tz}"
        elif len(clean_date) >= 8:
            year = clean_date[0:4]
            month = clean_date[4:6]
            day = clean_date[6:8]
            return f"{year}-{month}-{day}"
    except Exception:
        pass
    
    return date_str

def get_annotation_type_name(annot_type_info):
    """
    Translates PyMuPDF annotation type representations to a clean string.
    Works across different PyMuPDF versions.
    """
    if isinstance(annot_type_info, tuple) and len(annot_type_info) == 2:
        return annot_type_info[1]
    
    if isinstance(annot_type_info, int):
        # Standard PDF Annotation Type Numbers mapping
        mapping = {
            0: 'Text',       # Sticky Note
            1: 'Link',
            2: 'FreeText',   # TextBox
            3: 'Line',
            4: 'Square',     # Rectangle
            5: 'Circle',
            6: 'Polygon',
            7: 'PolyLine',
            8: 'Highlight',
            9: 'Underline',
            10: 'Squiggly',
            11: 'StrikeOut',
            12: 'Stamp',
            13: 'Caret',
            14: 'Ink',       # Freehand drawing
            15: 'Popup',
            16: 'FileAttachment',
            17: 'Sound',
            18: 'Movie',
            19: 'Widget',
            20: 'Screen',
            21: 'PrinterMark',
            22: 'TrapNet',
            23: 'Watermark',
            24: '3D',
            25: 'Redact'
        }
        return mapping.get(annot_type_info, f"Unknown ({annot_type_info})")
    
    return str(annot_type_info)

def extract_annotations(pdf_path, pdf_name=None):
    """
    Opens a PDF and extracts all annotations/markups.
    Returns a list of dicts.
    """
    if not pdf_name:
        pdf_name = os.path.basename(pdf_path)
        
    extracted_markups = []
    
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        raise ValueError(f"Failed to open PDF file: {str(e)}")
        
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # page.annots() returns a generator of annotations on this page
        annots = page.annots()
        if not annots:
            continue
            
        for annot in annots:
            # Skip link annotations or widgets that are not markups
            # We map type first
            annot_type_info = annot.type
            annot_type = get_annotation_type_name(annot_type_info)
            
            if annot_type in ('Link', 'Widget'):
                continue
                
            info = annot.info
            rect = annot.rect
            
            # Extract coordinates as string [x0, y0, x1, y1]
            coords_str = ""
            if rect:
                coords_str = f"[{round(rect.x0, 1)}, {round(rect.y0, 1)}, {round(rect.x1, 1)}, {round(rect.y1, 1)}]"
                
            # Extract text comment/contents
            comment_text = info.get("content", "").strip()
            
            # If there's no comment text, use a placeholder based on type
            if not comment_text:
                comment_text = f"[{annot_type} Markup - No comment text]"
                
            # Extract author (title field in info is usually author name)
            author = info.get("title", "").strip()
            if not author:
                author = "Unknown Reviewer"
                
            # Extract and parse dates
            created_date_raw = info.get("creationDate", "")
            modified_date_raw = info.get("modDate", "")
            
            created_date = parse_pdf_date(created_date_raw)
            modified_date = parse_pdf_date(modified_date_raw)
            
            # If created date is empty, fallback to modification date or current time
            if not created_date:
                if modified_date:
                    created_date = modified_date
                else:
                    created_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            if not modified_date:
                modified_date = created_date
                
            # Extract underlying selected text if annotation is over readable text (e.g. highlight)
            selected_text = ""
            if rect and annot_type in ('Highlight', 'Underline', 'StrikeOut', 'Squiggly'):
                try:
                    selected_text = page.get_text("text", clip=rect).strip()
                except Exception:
                    pass
            
            extracted_markups.append({
                "pdf_name": pdf_name,
                "page_number": page_num + 1,  # 1-indexed for display
                "annotation_type": annot_type,
                "comment_text": comment_text,
                "author": author,
                "created_date": created_date,
                "modified_date": modified_date,
                "rectangle_coordinates": coords_str,
                "selected_text": selected_text,
                "assigned_to": "Unassigned",
                "priority": "Medium",
                "status": "Pending",
                "remarks": ""
            })
            
    doc.close()
    return extracted_markups
