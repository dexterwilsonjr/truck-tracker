export const MODULE_CODES = [
  "truck_tracker",
  "updates",
  "guide",
  "photos",
  "push",
  "face_mapping",
  "print",
] as const

export type ModuleCode = (typeof MODULE_CODES)[number]

export function isModuleCode(value: string): value is ModuleCode {
  return (MODULE_CODES as readonly string[]).includes(value)
}
