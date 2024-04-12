export async function asyncTryJson<T>(asyncFn: Promise<T>): Promise<T | {}> {
  try {
    return await asyncFn;
  } catch (error) {
    return {};
  }
}
