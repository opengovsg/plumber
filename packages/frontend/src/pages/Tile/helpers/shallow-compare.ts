export function shallowCompare(obj1: any, obj2: any): boolean {
  // Check if both objects are null or undefined
  if (obj1 == null || obj2 == null) {
    return true
  }

  // Check if both objects have the same keys
  const obj1Keys = Object.keys(obj1)
  const obj2Keys = Object.keys(obj2)
  if (obj1Keys.length !== obj2Keys.length) {
    return false
  }

  // Check if the values of each key are the same
  for (const key of obj1Keys) {
    if (obj1[key] !== obj2[key]) {
      return false
    }
  }

  return true
}
