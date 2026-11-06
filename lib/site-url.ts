/** Sites are always served without www. */
export function stripWww(url: string): string {
  return url.replace(/^(https?:\/\/)www\./i, "$1");
}
