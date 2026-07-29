import re

with open('C:/vaxplan/client/src/components/DataTable.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Props interface
content = content.replace(
    '  bulkActions?: React.ReactNode;',
    '  bulkActions?: React.ReactNode;\n  renderExpandedRow?: (item: T) => React.ReactNode;'
)

# 2. Props argument
content = content.replace(
    '  bulkActions,\n}: DataTableProps<T>) {',
    '  bulkActions,\n  renderExpandedRow,\n}: DataTableProps<T>) {'
)

# 3. State
content = content.replace(
    '  const [sortConfig, setSortConfig] = useState<{',
    '  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());\n\n  const toggleRowExpansion = (id: string | number) => {\n    const newExpanded = new Set(expandedRows);\n    if (newExpanded.has(id)) newExpanded.delete(id);\n    else newExpanded.add(id);\n    setExpandedRows(newExpanded);\n  };\n\n  const [sortConfig, setSortConfig] = useState<{'
)

# 4. Imports
if 'ChevronDown' not in content:
    content = content.replace('ChevronRight, ChevronsLeft', 'ChevronRight, ChevronDown, ChevronsLeft')

# 5. TableHead chevron column
content = content.replace(
    '              {columns.map((col) => {',
    '              {renderExpandedRow && <TableHead className=\"w-10 sticky top-0 bg-muted z-10\"></TableHead>}\n              {columns.map((col) => {'
)

# 6. Row rendering start
old_row = '''              ) : (
                paginatedData.map((item, index) => (
                  <TableRow
                    key={item.id ?? index}
                    className={onRowClick ? "cursor-pointer hover-elevate" : ""}
                    onClick={() => onRowClick?.(item)}
                    data-testid={	able-row-}
                  >'''

new_row = '''              ) : (
                paginatedData.map((item, index) => (
                  <React.Fragment key={item.id ?? index}>
                  <TableRow
                    className={onRowClick || renderExpandedRow ? "cursor-pointer hover-elevate" : ""}
                    onClick={() => {
                      if (renderExpandedRow && item.id !== undefined) toggleRowExpansion(item.id);
                      onRowClick?.(item);
                    }}
                    data-testid={	able-row-}
                  >
                    {renderExpandedRow && (
                      <TableCell className="w-10 text-center">
                        {expandedRows.has(item.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                    )}'''

content = content.replace(old_row, new_row)

# 7. Row rendering end
old_end = '''                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}'''

new_end = '''                    </TableCell>
                  ))}
                </TableRow>
                {renderExpandedRow && item.id !== undefined && expandedRows.has(item.id) && (
                  <TableRow>
                    <TableCell colSpan={columns.length + (enableSelection ? 1 : 0) + (renderExpandedRow ? 1 : 0)} className="p-0 border-b">
                      <div className="bg-muted/5 p-4 animate-in fade-in slide-in-from-top-2 border-t">
                        {renderExpandedRow(item)}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
              ))
            )}'''

content = content.replace(old_end, new_end)

with open('C:/vaxplan/client/src/components/DataTable.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("DataTable patched successfully")
