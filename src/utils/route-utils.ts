import * as R from "ramda";
import type { EntityRouteParams } from "../routes/entities.ts";

export async function asyncTryJson<T>(asyncFn: Promise<T>): Promise<T | {}> {
  try {
    return await asyncFn;
  } catch (error) {
    return {};
  }
}

const getPathRest = (
  path: string,
  { appName, envName, entityName }: EntityRouteParams,
): string => R.replace(`/apps/${appName}/${envName}/${entityName}`, "", path);

const getPathRestSegments = (path: string): string[] =>
  R.split("/", path).filter((p) => !R.isEmpty(p));

const getXPath = (
  pathRestSegments: string[],
  { appName, envName, entityName }: EntityRouteParams,
): string =>
  R.isEmpty(pathRestSegments)
    ? `${appName}/${envName}/${entityName}`
    : `${appName}/${envName}/${entityName}/${pathRestSegments.join("/")}`;

export const getCommonEntityRouteProps = (
  requestPath: string,
  entityRouteParams: EntityRouteParams,
): { pathRest: string; pathRestSegments: string[]; xpath: string } => {
  const pathRest = getPathRest(requestPath, entityRouteParams);
  const pathRestSegments = getPathRestSegments(pathRest);
  const xpath = getXPath(pathRestSegments, entityRouteParams);

  return {
    pathRest,
    pathRestSegments,
    xpath,
  };
};

export const isEntitiesList = (pathSegments: string[]) =>
  pathSegments.length % 2 == 0;
