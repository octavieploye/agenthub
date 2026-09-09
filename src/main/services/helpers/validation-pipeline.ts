export interface ValidationCheck {
  name: string
  check: () => boolean | string
}

export interface ValidationResult {
  passed: boolean
  failures: string[]
}

export function runValidation(checks: ValidationCheck[]): ValidationResult {
  const failures: string[] = []
  for (const { name, check } of checks) {
    const result = check()
    if (result !== true) {
      failures.push(`${name}: ${result}`)
    }
  }
  return { passed: failures.length === 0, failures }
}
