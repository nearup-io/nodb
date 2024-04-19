export type EntityRouteParams = {
  appName: string;
  envName: string;
  entityName: string;
};

export type EntityRequestDto = {
  id: string;
  [key: string]: any;
};

export type PostEntityRequestDto = Omit<EntityRequestDto, "id"> & {
  id?: string;
};

export type Order = "desc" | "asc";

export type SortBy = { name: string; order: Order };

export type EntityQueryMeta = {
  only?: string[];
  page?: number;
  perPage?: number;
  sortBy: SortBy[];
  hasMeta: boolean;
};

export type EntityQuery = {
  meta: EntityQueryMeta;
  [key: string]: unknown;
};

export type Pagination = {
  totalCount: number;
  items: number;
  next?: number;
  previous?: number;
  pages: number;
  page: number;
  current_page: string;
  first_page?: string;
  last_page?: string;
  previous_page?: string;
  next_page?: string;
};
