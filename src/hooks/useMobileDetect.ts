import { useState, useEffect } from 'react';

/**
 * Hook to detect if the user is on a mobile device
 * Uses both user agent and screen width for reliable detection
 */
export function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return checkIsMobile();
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(checkIsMobile());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

function checkIsMobile(): boolean {
  // Check user agent for mobile devices
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android',
    'webos',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'opera mini',
    'mobile',
  ];

  const isMobileUserAgent = mobileKeywords.some((keyword) =>
    userAgent.includes(keyword)
  );

  // Also check screen width (768px is typical tablet/mobile breakpoint)
  const isMobileWidth = window.innerWidth < 768;

  // Consider mobile if user agent matches OR screen is small
  return isMobileUserAgent || isMobileWidth;
}

/**
 * Simple function to check mobile without hook (for initial redirect)
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return checkIsMobile();
}
