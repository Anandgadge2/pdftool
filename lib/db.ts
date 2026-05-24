import { prisma } from './prisma';
import { Markup, MarkupFilters, MarkupUpdate, ExtractedAnnotation, Assignee } from './types';

// ============================================================
// Database initialization & Seeding
// ============================================================

export async function initDb(): Promise<void> {
  // Seed default assignees if table is empty
  const count = await prisma.assignee.count();
  if (count === 0) {
    const defaults = [
      'Unassigned',
      'Admin',
      'Design Team',
      'Site Engineer',
      'Documentation Team',
      'Client Coordinator',
      'Developer',
    ];
    await prisma.assignee.createMany({
      data: defaults.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }
}

// ============================================================
// Markup CRUD operations
// ============================================================

export async function insertMarkups(markups: ExtractedAnnotation[]): Promise<number> {
  if (!markups.length) return 0;

  const result = await prisma.markup.createMany({
    data: markups,
  });
  return result.count;
}

export async function fetchMarkups(filters?: MarkupFilters): Promise<Markup[]> {
  const where: any = {};

  if (filters) {
    if (filters.pdf_name?.length) {
      where.pdf_name = { in: filters.pdf_name };
    }
    if (filters.status?.length) {
      where.status = { in: filters.status };
    }
    if (filters.priority?.length) {
      where.priority = { in: filters.priority };
    }
    if (filters.assigned_to?.length) {
      where.assigned_to = { in: filters.assigned_to };
    }
    if (filters.annotation_type?.length) {
      where.annotation_type = { in: filters.annotation_type };
    }
  }

  const results = await prisma.markup.findMany({
    where,
    orderBy: {
      id: 'desc',
    },
  });

  // Map Prisma DateTime to ISO string to match existing Markup interface expectation
  return results.map((m) => ({
    ...m,
    created_at: m.created_at.toISOString(),
  })) as unknown as Markup[];
}

export async function updateMarkup(id: number, updates: MarkupUpdate): Promise<void> {
  const allowedCols = new Set(['assigned_to', 'priority', 'status', 'remarks']);
  const data: Record<string, any> = {};

  for (const [col, val] of Object.entries(updates)) {
    if (allowedCols.has(col) && val !== undefined) {
      data[col] = val;
    }
  }

  if (Object.keys(data).length === 0) return;

  await prisma.markup.update({
    where: { id },
    data,
  });
}

export async function deleteMarkup(id: number): Promise<void> {
  await prisma.markup.delete({
    where: { id },
  });
}

export async function clearAllData(): Promise<void> {
  await prisma.markup.deleteMany();
}

export async function getUniqueValues(column: string): Promise<string[]> {
  const allowedColumns = new Set(['pdf_name', 'annotation_type', 'assigned_to', 'priority', 'status', 'author', 'color']);
  if (!allowedColumns.has(column)) {
    throw new Error(`Invalid column name: ${column}`);
  }

  // Use dynamic raw unsafe SQL selection for DISTINCT column queries
  const query = `SELECT DISTINCT "${column}" FROM markups WHERE "${column}" IS NOT NULL AND "${column}" != '' ORDER BY "${column}"`;
  const result: any[] = await prisma.$queryRawUnsafe(query);
  return result.map((row) => row[column]);
}

// ============================================================
// Assignee operations
// ============================================================

export async function getAssignees(): Promise<Assignee[]> {
  const results = await prisma.assignee.findMany({
    orderBy: {
      id: 'asc',
    },
  });
  return results.map((a) => ({
    ...a,
    created_at: a.created_at.toISOString(),
  })) as unknown as Assignee[];
}

export async function addAssignee(name: string): Promise<Assignee> {
  try {
    const assignee = await prisma.assignee.create({
      data: { name },
    });
    return {
      ...assignee,
      created_at: assignee.created_at.toISOString(),
    } as unknown as Assignee;
  } catch (error) {
    throw new Error(`Assignee "${name}" already exists`);
  }
}

export async function deleteAssignee(id: number): Promise<void> {
  await prisma.assignee.delete({
    where: { id },
  });
}
