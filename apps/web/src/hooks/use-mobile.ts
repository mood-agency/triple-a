import * as React from "react"
import { Capacitor } from '@capacitor/core'

function detectMobilePhone(): boolean {
  // Native Capacitor app (Android/iOS) is always considered mobile
  if (Capacitor.isNativePlatform()) return true

  const ua = navigator.userAgent
  // iPhone
  if (/iPhone/i.test(ua)) return true
  // Android phone (tablets don't include "Mobile" in UA)
  if (/Android/i.test(ua) && /Mobile/i.test(ua)) return true
  // Other mobile phones
  if (/webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true

  return false
}

export function useIsMobile() {
  const [isMobile] = React.useState(() => detectMobilePhone())
  return isMobile
}
