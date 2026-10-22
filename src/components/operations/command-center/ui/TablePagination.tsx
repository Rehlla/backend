import React from 'react';

import { Pagination } from '../Pagination';

/**
 * Name-compatible pagination export for the ops tables. The command-center
 * tables import `TablePagination` from './ui'; the shared primitive lives in
 * ../Pagination.tsx and is re-exported here under that name. `t` is accepted
 * for call-site compatibility with the tables' localized footer copy but the
 * primitive's counters are numeric and need no translation.
 */
export interface TablePaginationProps extends Omit<React.ComponentProps<typeof Pagination>, 'totalItems' | 'pageSize'> {
  t?: (key: string) => string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({ t: _t, ...props }) => (
  <Pagination totalItems={0} pageSize={0} {...props} />
);
