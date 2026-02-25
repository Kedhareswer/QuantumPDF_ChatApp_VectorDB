declare module '@xenova/transformers' {
  type PipelineHandler = (input: string | ArrayBuffer) => Promise<unknown>

  export function pipeline(task: string, model?: string): Promise<PipelineHandler>
}

