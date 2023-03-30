const NAMESPACE = 'automatisch'
const makeKey = (key: string) => `${NAMESPACE}.${key}`

export const setItem = (key: string, value: string) => {
  return localStorage.setItem(makeKey(key), value)
}

export const getItem = (key: string) => {
  return localStorage.getItem(makeKey(key))
}

export const setItemForSession = (key: string, value: string) => {
  return sessionStorage.setItem(makeKey(key), value)
}

export const getItemForSession = (key: string) => {
  return sessionStorage.getItem(makeKey(key))
}
