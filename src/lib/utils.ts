import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get initials from a name (first letter of first name + first letter of last name)
 * Example: "Liliana Ferro" -> "LF", "John" -> "J"
 */
export function getInitials(firstName: string, lastName?: string): string {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName?.trim().charAt(0).toUpperCase() || '';
  return first + last;
}
