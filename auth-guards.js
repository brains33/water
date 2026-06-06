const STORAGE_KEY   = 'pf_user'
const SESSION_TTL   = 8 * 60 * 60 * 1000   // 8 hours, matches index.html

export function getUser(requiredRole = null) {
  let user = null
  try { user = JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch (e) {}

  // No session at all
  if (!user) {
    window.location.href = './index.html'
    return null
  }

  // Session expired
  if (user._expires && Date.now() > user._expires) {
    localStorage.removeItem(STORAGE_KEY)
    window.location.href = './index.html'
    return null
  }

  // Wrong role for this page
  if (requiredRole && user.role !== requiredRole) {
    window.location.href = './index.html'
    return null
  }

  // Refresh session TTL on every page load (keep-alive)
  user._expires = Date.now() + SESSION_TTL
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))

  return user
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY)
  window.location.href = './index.html'
}
