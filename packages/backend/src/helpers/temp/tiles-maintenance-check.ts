import appConfig from '@/config/app'

export const withTilesMaintenanceCheck = <T extends (...args: any[]) => any>(
  resolver: T,
): T => {
  return ((...args: Parameters<T>) => {
    if (appConfig.isTilesUnderMaintenance) {
      throw new Error(
        'Tiles is temporarily unavailable for maintenance. Please try again later.',
      )
    }
    return resolver(...args)
  }) as T
}
