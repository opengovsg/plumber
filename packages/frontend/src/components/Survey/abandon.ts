/**
 * The editor, its settings pages, and the executions page for a pipe all have
 * the pipe's id in the path, so moving between them is not leaving the pipe.
 */
export function isStillOnPipe(pathname: string, flowId: string): boolean {
  return pathname.split('/').includes(flowId)
}
