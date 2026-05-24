// ============================================================
// Core Types for PDF Markup Extractor & Issue Tracker
// ============================================================

export interface Markup {
  id: number;
  pdf_name: string;
  pdf_url: string | null;
  page_number: number;
  annotation_type: string;
  comment_text: string;
  author: string;
  created_date: string;
  modified_date: string;
  rectangle_coordinates: string;
  selected_text: string;
  assigned_to: string;
  priority: Priority;
  status: Status;
  remarks: string;
  color: string;
  created_at: string;
}

export type Status = 'Pending' | 'In Progress' | 'Resolved' | 'Closed' | 'Rejected';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export const STATUS_OPTIONS: Status[] = ['Pending', 'In Progress', 'Resolved', 'Closed', 'Rejected'];
export const PRIORITY_OPTIONS: Priority[] = ['Low', 'Medium', 'High', 'Critical'];

export interface Assignee {
  id: number;
  name: string;
  created_at: string;
}

export const DEFAULT_ASSIGNEES = [
  'Unassigned',
  'Admin',
  'Design Team',
  'Site Engineer',
  'Documentation Team',
  'Client Coordinator',
  'Developer',
];

export interface MarkupFilters {
  pdf_name?: string[];
  status?: Status[];
  priority?: Priority[];
  assigned_to?: string[];
  annotation_type?: string[];
}

export interface MarkupUpdate {
  assigned_to?: string;
  priority?: Priority;
  status?: Status;
  remarks?: string;
}

export interface DashboardMetrics {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  closed: number;
  critical: number;
}

export interface ExtractedAnnotation {
  pdf_name: string;
  pdf_url: string;
  page_number: number;
  annotation_type: string;
  comment_text: string;
  author: string;
  created_date: string;
  modified_date: string;
  rectangle_coordinates: string;
  selected_text: string;
  assigned_to: string;
  priority: Priority;
  status: Status;
  remarks: string;
  color: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface UploadResponse {
  count: number;
  pdf_url: string;
  pdf_name: string;
  is_scanned: boolean;
}
