import '@/types/luxon-extensions'
import { Settings as LuxonSettings } from 'luxon'

// Force SGT date-time formatting no matter what
LuxonSettings.defaultZone = 'Asia/Singapore'
LuxonSettings.defaultLocale = 'en-SG'
