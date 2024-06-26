export const getPaginationNumbers = ({
  page,
  perPage,
}: {
  page?: number;
  perPage?: number;
}): { skip: number; limit: number } => {
  let paginationLimit = perPage || 10;
  if (paginationLimit < 1) {
    paginationLimit = 10;
  }
  let paginationOffset = page ? page - 1 : 0;
  if (paginationOffset < 1) {
    paginationOffset = 0;
  }
  paginationOffset *= paginationLimit;
  return { skip: paginationOffset, limit: paginationLimit };
};

export const entityMetaResponse = ({
  hasMeta,
  entityName,
  appName,
  envName,
  id,
}: {
  hasMeta?: boolean;
  entityName: string;
  appName: string;
  envName: string;
  id: string;
}) => {
  return hasMeta
    ? {
        self: `/${appName}/${envName}/${entityName}/${id}`,
      }
    : undefined;
};
