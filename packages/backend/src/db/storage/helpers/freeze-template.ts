// Helper function to ensure templates cannot be modified
export function deepFreeze<T>(object: T): T {
  if (Array.isArray(object)) {
    object.forEach(deepFreeze)
  } else {
    // Freeze each property if it is an object
    Object.getOwnPropertyNames(object).forEach((name) => {
      const value = (object as any)[name]
      if (value && typeof value === 'object') {
        deepFreeze(value)
      }
    })
  }
  return Object.freeze(object)
}
