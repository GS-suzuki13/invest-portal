import React from 'react';
import type { ClientReturn } from '../types';

interface Column {
  key: keyof ClientReturn | string;
  label: string;
  render?: (value: unknown, row: ClientReturn) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface ReturnsTableProps {
  data: ClientReturn[];
  columns: Column[];
}

export default function ReturnsTable({ data, columns }: ReturnsTableProps) {
  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  const formatIfDate = (value: unknown): React.ReactNode => {
    if (typeof value !== 'string') return value as React.ReactNode;

    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const [year, month, day] = value.split('T')[0].split('-');
      return `${day}/${month}/${year}`;
    }

    return value;
  };

  return (
    <div className="max-h-[320px] overflow-auto rounded-xl border border-ip-border-soft">
      <table className="w-full text-sm text-ip-text-dim">
        <thead className="sticky top-0 z-10 bg-ip-surface-2 ip-selo uppercase tracking-wider text-ip-text-mute">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-semibold ${getAlignClass(col.align)}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.length > 0 ? (
            data.map((row, index) => (
              <tr
                key={row.id ?? index}
                className="border-t border-ip-border-soft hover:bg-white/[0.03]"
              >
                {columns.map((col) => {
                  const rawValue = (row as unknown as Record<string, unknown>)[col.key];
                  const value = formatIfDate(rawValue);

                  return (
                    <td
                      key={col.key}
                      className={`px-4 py-3 tnum ${getAlignClass(col.align)}`}
                    >
                      {col.render ? col.render(rawValue, row) : value}
                    </td>
                  );
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-ip-text-mute"
              >
                Nenhum dado encontrado
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}